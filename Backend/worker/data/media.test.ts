import { describe, expect, it } from "vitest";
import type { Env } from "../env";
import { corpusKey } from "./corpus";
import { ensureMediaObject, mediaKey, mediaPrefix, projectMealMedia } from "./media";

function storageEnv() {
  type Row = {
    accountId: string;
    photoHash: string;
    objectKey: string;
    mimeType: string;
    byteSize: number;
    createdAt: string;
    storedAt: string | null;
  };
  const rows = new Map<string, Row>();
  const objects = new Map<string, Uint8Array>();
  let puts = 0;
  const DB = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (!sql.includes("FROM media_objects")) return null;
              return rows.get(`${values[0]}:${values[1]}`) ?? null;
            },
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO media_objects")) {
                const [accountId, photoHash, objectKey, mimeType, byteSize, createdAt] = values as [
                  string,
                  string,
                  string,
                  string,
                  number,
                  string,
                ];
                const id = `${accountId}:${photoHash}`;
                if (!rows.has(id)) {
                  rows.set(id, {
                    accountId,
                    photoHash,
                    objectKey,
                    mimeType,
                    byteSize,
                    createdAt,
                    storedAt: null,
                  });
                }
              }
              if (sql.includes("UPDATE media_objects SET stored_at")) {
                const [storedAt, accountId, photoHash] = values as [string, string, string];
                const row = rows.get(`${accountId}:${photoHash}`);
                if (row) row.storedAt = storedAt;
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  const MEDIA = {
    async head(key: string) {
      return objects.has(key) ? ({ key } as R2Object) : null;
    },
    async put(key: string, value: Uint8Array) {
      puts += 1;
      objects.set(key, new Uint8Array(value));
      return { key } as R2Object;
    },
  };
  return {
    env: { DB, MEDIA } as unknown as Env,
    objects,
    puts: () => puts,
  };
}

function deletionEnv(mealId: string, photoHash: string) {
  const legacyAccount = "device:original-phone";
  const objectKey = `media/legacy/${photoHash}.jpg`;
  const mealState = new Map<string, string | null>([[`${legacyAccount}:${mealId}`, photoHash]]);
  const media = new Map([
    [
      `${legacyAccount}:${photoHash}`,
      {
        accountId: legacyAccount,
        photoHash,
        objectKey,
        mimeType: "image/jpeg",
        byteSize: 4,
        createdAt: "2026-08-01T00:00:00Z",
        storedAt: "2026-08-01T00:00:01Z",
      },
    ],
  ]);
  const deletedObjects: string[] = [];
  const DB = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (sql.includes("SELECT photo_hash AS photoHash FROM meal_media")) {
                const value = mealState.get(`${values[0]}:${values[1]}`);
                return value === undefined ? null : { photoHash: value };
              }
              if (sql.includes("SELECT 1 AS used FROM meal_media")) {
                const account = values[0] as string;
                const hash = values[1] as string;
                return [...mealState.entries()].some(
                  ([key, value]) => key.startsWith(`${account}:`) && value === hash,
                )
                  ? { used: 1 }
                  : null;
              }
              if (sql.includes("FROM media_objects")) {
                return media.get(`${values[0]}:${values[1]}`) ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO meal_media")) {
                const [account, id, hash] = values as [string, string, string | null];
                mealState.set(`${account}:${id}`, hash);
              }
              if (sql.includes("DELETE FROM media_objects")) {
                media.delete(`${values[0]}:${values[1]}`);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  const MEDIA = {
    async delete(key: string) {
      deletedObjects.push(key);
    },
  };
  return {
    env: { DB, MEDIA } as unknown as Env,
    legacyAccount,
    objectKey,
    mealState,
    media,
    deletedObjects,
  };
}

describe("R2 object layout", () => {
  it("partitions private media by account for bounded account deletion", () => {
    const account = "device:0198F222AADB7E008000ABCDEF01";
    expect(mediaPrefix(account)).toBe("media/device%3A0198F222AADB7E008000ABCDEF01/");
    expect(mediaKey(account, "a".repeat(64), "image/jpeg", new Date("2026-08-05T00:00:00Z"))).toBe(
      `media/device%3A0198F222AADB7E008000ABCDEF01/2026-08/${"a".repeat(64)}.jpg`,
    );
  });

  it("content-addresses the corpus by the crop bytes, not source bytes", () => {
    expect(corpusKey("b".repeat(64))).toBe(`corpus/${"b".repeat(64)}.jpg`);
  });

  it("writes the exact model input once and repairs from the D1 reservation", async () => {
    const fake = storageEnv();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const first = await ensureMediaObject(
      fake.env,
      "device:phone",
      "a".repeat(64),
      "image/jpeg",
      bytes,
      new Date("2026-08-05T00:00:00Z"),
    );
    const second = await ensureMediaObject(
      fake.env,
      "device:phone",
      "a".repeat(64),
      "image/jpeg",
      bytes,
      new Date("2026-09-05T00:00:00Z"),
    );

    expect(second.objectKey).toBe(first.objectKey);
    expect(fake.puts()).toBe(1);
    expect(fake.objects.get(first.objectKey)).toEqual(bytes);
  });

  it("deletes media for a meal stored in an adopted device partition", async () => {
    const mealId = "0198f222-aadb-7e00-8000-abcdef012345";
    const photoHash = "a".repeat(64);
    const fake = deletionEnv(mealId, photoHash);

    await projectMealMedia(
      fake.env,
      "acct:one",
      [
        {
          id: "0198f333-aadb-7e00-8000-abcdef012345",
          occurredAt: 1_700_000_000_000,
          recordedAt: 1_700_000_000_100,
          payload: { kind: "meal_deleted", data: { mealID: mealId } },
        },
      ],
      ["acct:one", fake.legacyAccount],
    );

    expect(fake.mealState.get(`${fake.legacyAccount}:${mealId}`)).toBeNull();
    expect(fake.mealState.get(`acct:one:${mealId}`)).toBeNull();
    expect(fake.media.has(`${fake.legacyAccount}:${photoHash}`)).toBe(false);
    expect(fake.deletedObjects).toEqual([fake.objectKey]);
  });
});
