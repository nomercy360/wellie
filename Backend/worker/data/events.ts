import { and, asc, eq, gt, inArray, notInArray, or } from "drizzle-orm";
import {
  type IngestEventsRequest,
  mealDeleteDataSchema,
  mealEventDataSchema,
  type ReconcileEventsRequest,
} from "../../src/contracts";
import { createDb } from "../db/client";
import { events, mealEvals } from "../db/schema";
import type { Env } from "../env";
import { HttpError } from "../lib/http-error";
import { deleteMediaIfUnreferenced, projectMealMedia } from "./media";

const MAX_BATCH_BYTES = 1_000_000;
const RECONCILE_PAGE_SIZE = 500;
const DELETE_CHUNK_SIZE = 50;

type Cursor = { recordedAt: number; id: string };

function encodeCursor(cursor: Cursor): string {
  return `${cursor.recordedAt}:${cursor.id}`;
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  const recordedAt = Number(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (separator < 1 || !Number.isSafeInteger(recordedAt) || !id) {
    throw new HttpError(400, "Invalid event cursor.");
  }
  return { recordedAt, id };
}

export async function ingestEvents(
  env: Env,
  accountId: string,
  partitions: string[],
  input: IngestEventsRequest,
): Promise<{ accepted: number; inserted: number; replayed: number }> {
  const database = env.DB;
  const bytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  if (bytes > MAX_BATCH_BYTES) {
    throw new HttpError(413, "Event batch exceeds the 1 MB request limit.");
  }

  const receivedAt = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const eventStatementIndexes: number[] = [];

  for (const event of input.events) {
    eventStatementIndexes.push(statements.length);
    statements.push(
      database
        .prepare(
          `INSERT INTO events
            (id, account_id, device_id, occurred_at, recorded_at, kind, payload_json, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
        )
        .bind(
          event.id,
          accountId,
          input.deviceId,
          event.occurredAt,
          event.recordedAt,
          event.payload.kind,
          JSON.stringify(event.payload),
          receivedAt,
        ),
    );

    if (event.payload.kind !== "meal_logged" && event.payload.kind !== "meal_revised") continue;
    const meal = mealEventDataSchema.safeParse(event.payload.data);
    if (!meal.success || !meal.data.photoHash || !meal.data.recognitionEvidence) continue;
    const evidence = meal.data.recognitionEvidence;
    statements.push(
      database
        .prepare(
          `INSERT INTO meal_evals
            (event_id, account_id, device_id, meal_id, photo_hash, prompt_version,
             raw_model_json, initial_items_json, final_items_json, other_meals_visible,
             was_corrected, recorded_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(event_id) DO NOTHING`,
        )
        .bind(
          event.id,
          accountId,
          input.deviceId,
          meal.data.id,
          meal.data.photoHash.toLowerCase(),
          evidence.promptVersion,
          evidence.rawModelJSON,
          JSON.stringify(evidence.initialDishes),
          JSON.stringify(meal.data.dishes),
          0,
          meal.data.wasCorrected ? 1 : 0,
          event.recordedAt,
          receivedAt,
        ),
    );
  }

  const results = await database.batch(statements);
  const inserted = eventStatementIndexes.reduce((count, index) => {
    return count + (results[index]?.meta.changes === 1 ? 1 : 0);
  }, 0);
  await purgeDeletedMealContent(database, partitions, input.events);
  // The event log remains canonical. This projection is idempotent and applies
  // even on a replay, so a transient R2/D1 failure can be repaired by sending
  // the same event again without inventing a mutable meal endpoint.
  await projectMealMedia(env, accountId, input.events, partitions);
  return { accepted: input.events.length, inserted, replayed: input.events.length - inserted };
}

/**
 * A deletion tombstone remains in the phone's append-only log and therefore in
 * its API mirror, but the meal content it supersedes no longer belongs there. Purge
 * logged/revised payloads and their eval rows across the caller's full account
 * union. The local device log remains append-only and can safely replay the
 * same history: a later tombstone in that replay makes this idempotent.
 */
export async function purgeDeletedMealContent(
  database: D1Database,
  partitions: string[],
  input: IngestEventsRequest["events"],
): Promise<void> {
  const mealIDs = new Set<string>();
  for (const event of input) {
    if (event.payload.kind !== "meal_deleted") continue;
    const deleted = mealDeleteDataSchema.safeParse(event.payload.data);
    if (deleted.success) mealIDs.add(deleted.data.mealID);
  }
  if (mealIDs.size === 0 || partitions.length === 0) return;

  const owned = [...new Set(partitions)];
  const partitionMarks = owned.map(() => "?").join(", ");
  const ids = [...mealIDs];
  // Keep each D1 batch deliberately small. One request may carry 500 events,
  // while deletion is normally one; chunking prevents a bulk repair from
  // turning into an oversized statement batch.
  for (let start = 0; start < ids.length; start += 50) {
    const statements: D1PreparedStatement[] = [];
    for (const mealID of ids.slice(start, start + 50)) {
      statements.push(
        database
          .prepare(
            `DELETE FROM meal_evals
              WHERE account_id IN (${partitionMarks}) AND meal_id = ?`,
          )
          .bind(...owned, mealID),
        database
          .prepare(
            `DELETE FROM events
              WHERE account_id IN (${partitionMarks})
                AND kind IN ('meal_logged', 'meal_revised')
                AND json_extract(payload_json, '$.data.id') = ?`,
          )
          .bind(...owned, mealID),
      );
    }
    await database.batch(statements);
  }
}

/**
 * Make the API's event set match the phone's complete local log.
 *
 * The client uploads first and calls this only after every batch succeeds. We
 * therefore only need to remove server-only ids here; missing server ids have
 * already been inserted by `ingestEvents`. Scanning before deleting keeps the
 * cursor stable and makes an empty `eventIds` array a deliberate "clear my API
 * history" operation rather than a no-op.
 */
export async function reconcileEvents(
  env: Env,
  partitions: string[],
  input: ReconcileEventsRequest,
): Promise<{ desired: number; present: number; deleted: number }> {
  const bytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  if (bytes > MAX_BATCH_BYTES) {
    throw new HttpError(413, "Event snapshot exceeds the 1 MB request limit.");
  }

  const desired = new Set(input.eventIds);
  const owned = [...new Set(partitions)];
  const staleByPartition = new Map<string, string[]>();
  let present = 0;

  for (const partition of owned) {
    let cursor: Cursor | null = null;
    while (true) {
      const statement: D1PreparedStatement = cursor
        ? env.DB.prepare(
            `SELECT id, recorded_at AS recordedAt
               FROM events
              WHERE account_id = ?
                AND (recorded_at > ? OR (recorded_at = ? AND id > ?))
              ORDER BY recorded_at, id
              LIMIT ?`,
          ).bind(partition, cursor.recordedAt, cursor.recordedAt, cursor.id, RECONCILE_PAGE_SIZE)
        : env.DB.prepare(
            `SELECT id, recorded_at AS recordedAt
               FROM events
              WHERE account_id = ?
              ORDER BY recorded_at, id
              LIMIT ?`,
          ).bind(partition, RECONCILE_PAGE_SIZE);
      const page: D1Result<Cursor> = await statement.all<Cursor>();
      present += page.results.length;
      const stale = staleByPartition.get(partition) ?? [];
      for (const row of page.results) {
        if (!desired.has(row.id)) stale.push(row.id);
      }
      if (stale.length > 0) staleByPartition.set(partition, stale);
      const last: Cursor | undefined = page.results.at(-1);
      if (page.results.length < RECONCILE_PAGE_SIZE || !last) break;
      cursor = last;
    }
  }

  const mediaCandidates = new Map<string, { accountId: string; photoHash: string }>();
  let deleted = 0;
  for (const [partition, stale] of staleByPartition) {
    for (let start = 0; start < stale.length; start += DELETE_CHUNK_SIZE) {
      const ids = stale.slice(start, start + DELETE_CHUNK_SIZE);
      const marks = ids.map(() => "?").join(", ");
      const media = await env.DB.prepare(
        `SELECT account_id AS accountId, photo_hash AS photoHash
           FROM meal_media
          WHERE account_id = ? AND event_id IN (${marks}) AND photo_hash IS NOT NULL`,
      )
        .bind(partition, ...ids)
        .all<{ accountId: string; photoHash: string }>();
      for (const row of media.results) {
        mediaCandidates.set(`${row.accountId}:${row.photoHash}`, row);
      }

      const results = await env.DB.batch([
        env.DB.prepare(
          `DELETE FROM meal_evals WHERE account_id = ? AND event_id IN (${marks})`,
        ).bind(partition, ...ids),
        env.DB.prepare(
          `DELETE FROM meal_media WHERE account_id = ? AND event_id IN (${marks})`,
        ).bind(partition, ...ids),
        env.DB.prepare(`DELETE FROM events WHERE account_id = ? AND id IN (${marks})`).bind(
          partition,
          ...ids,
        ),
      ]);
      deleted += results[2]?.meta.changes ?? 0;
    }
  }

  for (const candidate of mediaCandidates.values()) {
    await deleteMediaIfUnreferenced(env, candidate.accountId, candidate.photoHash, owned);
  }

  return { desired: desired.size, present, deleted };
}

/**
 * Everything the caller may read, oldest first, across every partition their
 * account owns.
 *
 * The cursor is `(recordedAt, id)` — a total order over the stored union,
 * because `recordedAt` is server-visible EpochMillis and the id is a UUIDv7
 * that breaks ties the same way on every page. This endpoint is retained for
 * diagnostics and export; normal app sync reconciles from phone to API.
 *
 * `partitions` rather than one `accountId`: a partition is a fact about where a
 * row was written and never changes, so the union grows only when the account
 * adopts another device. See `data/accounts.ts`.
 */
export async function listEvents(
  database: D1Database,
  partitions: string[],
  cursorValue: string | undefined,
  limit: number,
) {
  const cursor = decodeCursor(cursorValue);
  const db = createDb(database);
  const cursorCondition = cursor
    ? or(
        gt(events.recordedAt, cursor.recordedAt),
        and(eq(events.recordedAt, cursor.recordedAt), gt(events.id, cursor.id)),
      )
    : undefined;
  // One partition stays a single-value IN, which SQLite plans against
  // `events_account_cursor_idx` exactly as the old equality did.
  const scope =
    partitions.length === 1
      ? eq(events.accountId, partitions[0] as string)
      : inArray(events.accountId, partitions);
  // Old builds could persist selection/editor events. They no longer belong to
  // the public event contract, so keep them out of account-history pages too.
  const publicScope = and(
    scope,
    notInArray(events.kind, ["habits_updated", "diet_saved", "diet_selected"]),
  );
  const rows = await db.query.events.findMany({
    where: cursorCondition ? and(publicScope, cursorCondition) : publicScope,
    orderBy: [asc(events.recordedAt), asc(events.id)],
    limit,
  });
  const last = rows.at(-1);
  return {
    events: rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      recordedAt: row.recordedAt,
      payload: row.payload,
      sourceDeviceId: row.deviceId,
    })),
    nextCursor: last
      ? encodeCursor({ recordedAt: last.recordedAt, id: last.id })
      : (cursorValue ?? null),
  };
}

export async function listMealEvals(database: D1Database, accountId: string, limit: number) {
  const db = createDb(database);
  return db.query.mealEvals.findMany({
    where: eq(mealEvals.accountId, accountId),
    orderBy: [asc(mealEvals.createdAt)],
    limit,
  });
}
