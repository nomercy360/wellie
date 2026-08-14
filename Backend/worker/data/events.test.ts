import { describe, expect, it } from "vitest";
import type { IngestEventsRequest } from "../../src/contracts";
import type { Env } from "../env";
import { purgeDeletedMealContent, reconcileEvents } from "./events";

type CapturedStatement = { sql: string; values: unknown[] };

function capturingDatabase() {
  const batches: CapturedStatement[][] = [];
  const database = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return { sql, values } as unknown as D1PreparedStatement;
        },
      };
    },
    async batch(statements: D1PreparedStatement[]) {
      batches.push(statements as unknown as CapturedStatement[]);
      return [];
    },
  };
  return { database: database as unknown as D1Database, batches };
}

const mealID = "0198f222-aadb-7e00-8000-abcdef012345";

function deletionEvents(): IngestEventsRequest["events"] {
  return [
    {
      id: "0198f333-aadb-7e00-8000-abcdef012345",
      occurredAt: 1_700_000_000_000,
      recordedAt: 1_700_000_000_100,
      payload: { kind: "meal_deleted", data: { mealID } },
    },
  ];
}

describe("meal deletion cleanup", () => {
  it("purges API meal content across every adopted account partition", async () => {
    const fake = capturingDatabase();

    await purgeDeletedMealContent(
      fake.database,
      ["acct:one", "device:original-phone", "acct:one"],
      deletionEvents(),
    );

    expect(fake.batches).toHaveLength(1);
    expect(fake.batches[0]).toHaveLength(2);
    expect(fake.batches[0]?.[0]?.sql).toContain("DELETE FROM meal_evals");
    expect(fake.batches[0]?.[1]?.sql).toContain("DELETE FROM events");
    expect(fake.batches[0]?.[1]?.sql).toContain("kind IN ('meal_logged', 'meal_revised')");
    expect(fake.batches[0]?.[0]?.values).toEqual(["acct:one", "device:original-phone", mealID]);
    expect(fake.batches[0]?.[1]?.values).toEqual(["acct:one", "device:original-phone", mealID]);
  });

  it("does not mutate API history when a batch has no deletion", async () => {
    const fake = capturingDatabase();
    const events = deletionEvents();
    const original = events[0];
    if (!original) throw new Error("Expected a deletion fixture.");
    events[0] = {
      ...original,
      payload: { kind: "message_deleted", data: { messageID: mealID } },
    };

    await purgeDeletedMealContent(fake.database, ["acct:one"], events);

    expect(fake.batches).toHaveLength(0);
  });
});

describe("phone-authoritative event reconciliation", () => {
  it("keeps local ids and deletes server-only ids across account partitions", async () => {
    const keep = "0198f333-aadb-7e00-8000-abcdef012341";
    const staleOne = "0198f333-aadb-7e00-8000-abcdef012342";
    const staleTwo = "0198f333-aadb-7e00-8000-abcdef012343";
    const captured: CapturedStatement[][] = [];
    const rows = new Map([
      [
        "acct:one",
        [
          { id: keep, recordedAt: 1 },
          { id: staleOne, recordedAt: 2 },
        ],
      ],
      ["device:old", [{ id: staleTwo, recordedAt: 3 }]],
    ]);
    const database = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              sql,
              values,
              async all() {
                if (sql.includes("FROM events")) {
                  return { results: rows.get(values[0] as string) ?? [] };
                }
                return { results: [] };
              },
            };
          },
        };
      },
      async batch(statements: D1PreparedStatement[]) {
        const batch = statements as unknown as CapturedStatement[];
        captured.push(batch);
        return batch.map((statement) => ({
          meta: { changes: statement.sql.includes("DELETE FROM events") ? 1 : 0 },
        }));
      },
    };

    const result = await reconcileEvents(
      { DB: database as unknown as D1Database } as Env,
      ["acct:one", "device:old"],
      { deviceId: "iphone-owner", eventIds: [keep] },
    );

    expect(result).toEqual({ desired: 1, present: 3, deleted: 2 });
    const eventDeletes = captured
      .flat()
      .filter((statement) => statement.sql.includes("DELETE FROM events"));
    expect(eventDeletes).toHaveLength(2);
    expect(eventDeletes[0]?.values).toEqual(["acct:one", staleOne]);
    expect(eventDeletes[1]?.values).toEqual(["device:old", staleTwo]);
  });

  it("treats an empty phone snapshot as an intentional API clear", async () => {
    const stale = "0198f333-aadb-7e00-8000-abcdef012344";
    let deletedID: unknown;
    const database = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              sql,
              values,
              async all() {
                return sql.includes("FROM events")
                  ? { results: [{ id: stale, recordedAt: 1 }] }
                  : { results: [] };
              },
            };
          },
        };
      },
      async batch(statements: D1PreparedStatement[]) {
        const batch = statements as unknown as CapturedStatement[];
        deletedID = batch.find((statement) => statement.sql.includes("DELETE FROM events"))
          ?.values[1];
        return batch.map((statement) => ({
          meta: { changes: statement.sql.includes("DELETE FROM events") ? 1 : 0 },
        }));
      },
    };

    const result = await reconcileEvents(
      { DB: database as unknown as D1Database } as Env,
      ["acct:one"],
      { deviceId: "iphone-owner", eventIds: [] },
    );

    expect(result.deleted).toBe(1);
    expect(deletedID).toBe(stale);
  });
});
