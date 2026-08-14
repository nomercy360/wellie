import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  corpusItemRequestSchema,
  createPostRequestSchema,
  createTableRequestSchema,
  evalListQuerySchema,
  eventListQuerySchema,
  ingestEventsRequestSchema,
  joinTableRequestSchema,
  markReadRequestSchema,
  reactionRequestSchema,
  recognitionRequestSchema,
  reconcileEventsRequestSchema,
  refinementRequestSchema,
  rerunRecognitionRequestSchema,
  sha256Schema,
  tableFeedQuerySchema,
  tablesListQuerySchema,
  updateTableNoteRequestSchema,
} from "../src/contracts";
import { apiKeyFor, modelFor } from "./ai/recognize";
import {
  deleteExpiredSessions,
  openBrowserSession,
  requireAuthenticatedPrincipal,
} from "./data/accounts";
import {
  acceptCoachPlan,
  activeGoal,
  checkInFor,
  coachMeals,
  coachProgress,
  coachThread,
  completeCoachWorkout,
  currentCoachPlan,
  draftCoachPlan,
  ensureCoachProfile,
  eraseCoachData,
  logCoachMeal,
  logWeight,
  recognizeCoachMeal,
  recordCheckIn,
  refineCoachMeal,
  startCoachWorkout,
  takeCoachTurn,
  todaySummary,
} from "./data/coach";
import { addCorpusItem, deleteAccountData, deleteOrphanCorpus, optOutCorpus } from "./data/corpus";
import { ingestEvents, listEvents, listMealEvals, reconcileEvents } from "./data/events";
import { deleteOrphanMedia, getMediaObject } from "./data/media";
import { callerMarket, recognizeMeal, rerunRecognition } from "./data/recognitions";
import { refineMeal, refineMealFromNote } from "./data/refinements";
import {
  createPost,
  createTable,
  deletePost,
  deleteTable,
  getFeed,
  getPostPhoto,
  joinTable,
  leaveTable,
  listTables,
  markRead,
  rotateInvite,
  setReaction,
  updateTableNote,
} from "./data/tables";
import type { Env } from "./env";
import { requireStableAccount } from "./lib/auth";
import { HttpError } from "./lib/http-error";
import { enforceRecognitionLimits, enforceSyncLimits } from "./lib/limits";
import { mintTranscriptionKey } from "./lib/soniox";
import { privacyPage } from "./privacy";

type AppContext = {
  Bindings: Env;
  Variables: {
    /** The partition new rows are written under. */
    accountId: string;
    /** Every partition this caller may read; contains `accountId`. */
    partitions: string[];
  };
};

export const app = new Hono<AppContext>().basePath("/api");

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Accept", "Authorization", "Content-Type", "X-Device-Id", "X-Session-Token"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86_400,
  }),
);

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  if (c.req.path === "/api/health" || c.req.path === "/api/v1/ping") return next();
  // This route creates the random browser credential used by the rest of the
  // API. There is deliberately no provider login or personal information.
  if (c.req.method === "POST" && c.req.path === "/api/v1/auth/device") return next();
  const principal = await requireAuthenticatedPrincipal(c.env, c.req.raw);
  c.set("accountId", principal.accountId);
  c.set("partitions", principal.partitions);
  return next();
});

app.get("/health", async (c) => {
  const database = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    ok: database?.ok === 1,
    database: { configured: true },
    storage: { configured: true, private: true },
    recognition: {
      provider: "orcarouter",
      model: modelFor(c.env),
      promptVersion: c.env.MEAL_PROMPT_VERSION,
      configured: Boolean(apiKeyFor(c.env)),
    },
  });
});

app.get("/v1/ping", async (c) => {
  const database = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  await c.env.MEDIA.head("__wellie_healthcheck__");
  return c.json({
    ok: database?.ok === 1,
    database: { ok: database?.ok === 1, schemaVersion: "coach-web-v2" },
    storage: { ok: true },
    agent: {
      configured: Boolean(apiKeyFor(c.env)),
      gateway: "orcarouter",
      chatModel: modelFor(c.env),
      planModel: modelFor(c.env),
      visionModel: modelFor(c.env),
    },
    voice: { configured: Boolean(c.env.SONIOX_API_KEY) },
    timestamp: new Date().toISOString(),
  });
});

app.post("/v1/auth/device", async (c) => {
  const opened = await openBrowserSession(c.env, c.req.raw);
  const profile = await ensureCoachProfile(c.env, opened.accountId);
  c.header("Cache-Control", "no-store");
  return c.json(
    {
      userId: opened.accountId,
      sessionToken: opened.sessionToken,
      expiresAt: opened.expiresAt,
      createdAccount: opened.createdAccount,
      profile,
    },
    201,
  );
});

app.get("/v1/me", async (c) =>
  c.json({ profile: await ensureCoachProfile(c.env, c.get("accountId")) }),
);

app.delete("/v1/me", async (c) =>
  c.json({ profile: await eraseCoachData(c.env, c.get("accountId")) }),
);

app.get("/v1/thread", async (c) => c.json(await coachThread(c.env, c.get("accountId"))));

app.post("/v1/onboarding/turn", async (c) => {
  const input = await c.req.json<Record<string, unknown>>();
  return c.json(await takeCoachTurn(c.env, c.get("accountId"), input));
});

app.get("/v1/goal", async (c) => c.json({ goal: await activeGoal(c.env, c.get("accountId")) }));

app.get("/v1/plan", async (c) =>
  c.json({ plan: await currentCoachPlan(c.env, c.get("accountId")) }),
);

app.post("/v1/plan", async (c) =>
  c.json({ plan: await draftCoachPlan(c.env, c.get("accountId")) }, 201),
);

app.post("/v1/plan/:id/accept", async (c) =>
  c.json({ plan: await acceptCoachPlan(c.env, c.get("accountId"), c.req.param("id")) }),
);

app.get("/v1/today", async (c) => {
  const day = c.req.query("day");
  const dayStart = Number(c.req.query("dayStart"));
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(dayStart)) {
    throw new HttpError(400, "day (YYYY-MM-DD) and dayStart (epoch millis) are required.");
  }
  return c.json(await todaySummary(c.env, c.get("accountId"), day, dayStart));
});

app.post("/v1/workouts", async (c) => {
  const workout = await startCoachWorkout(
    c.env,
    c.get("accountId"),
    await c.req.json<Record<string, unknown>>(),
  );
  return c.json({ workout }, 201);
});

app.post("/v1/workouts/:id/complete", async (c) =>
  c.json(
    await completeCoachWorkout(
      c.env,
      c.get("accountId"),
      c.req.param("id"),
      await c.req.json<Record<string, unknown>>(),
    ),
  ),
);

app.post("/v1/meals/recognize", async (c) =>
  c.json(
    await recognizeCoachMeal(
      c.env,
      c.get("accountId"),
      c.req.raw,
      await c.req.json<Record<string, unknown>>(),
    ),
  ),
);

app.post("/v1/meals", async (c) =>
  c.json(
    {
      meal: await logCoachMeal(
        c.env,
        c.get("accountId"),
        await c.req.json<Record<string, unknown>>(),
      ),
    },
    201,
  ),
);

app.post("/v1/meals/:id/refine", async (c) => {
  const input = await c.req.json<Record<string, unknown>>();
  if (typeof input.note !== "string" || !input.note.trim())
    throw new HttpError(400, "A correction note is required.");
  return c.json({
    meal: await refineCoachMeal(c.env, c.get("accountId"), c.req.param("id"), input.note.trim()),
  });
});

app.get("/v1/meals", async (c) => {
  const from = Number(c.req.query("from"));
  const to = Number(c.req.query("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to))
    throw new HttpError(400, "from and to (epoch millis) are required.");
  return c.json({ meals: await coachMeals(c.env, c.get("accountId"), from, to) });
});

app.get("/v1/check-ins/:day", async (c) =>
  c.json({ checkIn: await checkInFor(c.env, c.get("accountId"), c.req.param("day")) }),
);

app.post("/v1/check-ins", async (c) =>
  c.json(
    {
      checkIn: await recordCheckIn(
        c.env,
        c.get("accountId"),
        await c.req.json<Record<string, unknown>>(),
      ),
    },
    201,
  ),
);

app.get("/v1/progress", async (c) => c.json(await coachProgress(c.env, c.get("accountId"))));

app.post("/v1/measurements", async (c) => {
  await logWeight(c.env, c.get("accountId"), await c.req.json<Record<string, unknown>>());
  return c.json({ ok: true as const }, 201);
});

app.post("/v1/recognitions", zValidator("json", recognitionRequestSchema), async (c) => {
  await enforceRecognitionLimits(c.env, c.req.raw);
  const input = c.req.valid("json");
  if (!apiKeyFor(c.env)) {
    throw new HttpError(503, "Recognition is not configured. Add ORCA_API_KEY to .dev.vars.");
  }
  const result = await recognizeMeal(c.env, c.get("accountId"), input, callerMarket(c.req.raw));
  c.header("Cache-Control", "no-store");
  return c.json(result, result.cached ? 200 : 201);
});

app.post(
  "/v1/recognitions/:hash/rerun",
  zValidator("json", rerunRecognitionRequestSchema),
  async (c) => {
    await enforceRecognitionLimits(c.env, c.req.raw);
    const accountId = requireStableAccount(c.get("accountId"));
    const photoHash = sha256Schema.safeParse(c.req.param("hash"));
    if (!photoHash.success) throw new HttpError(400, "Invalid photo hash.");
    const input = c.req.valid("json");
    if (!apiKeyFor(c.env)) {
      throw new HttpError(503, "Recognition is not configured. Add ORCA_API_KEY to .dev.vars.");
    }
    const result = await rerunRecognition(
      c.env,
      accountId,
      photoHash.data.toLowerCase(),
      input,
      callerMarket(c.req.raw),
    );
    c.header("Cache-Control", "no-store");
    return c.json(result, result.cached ? 200 : 201);
  },
);

app.post(
  "/v1/recognitions/:hash/refine",
  zValidator("json", refinementRequestSchema),
  async (c) => {
    await enforceRecognitionLimits(c.env, c.req.raw);
    const accountId = requireStableAccount(c.get("accountId"));
    const photoHash = sha256Schema.safeParse(c.req.param("hash"));
    if (!photoHash.success) throw new HttpError(400, "Invalid photo hash.");
    const result = await refineMeal(
      c.env,
      accountId,
      photoHash.data.toLowerCase(),
      c.req.valid("json"),
    );
    c.header("Cache-Control", "no-store");
    return c.json(result, 201);
  },
);

// The same correction for a meal with no photograph — typed in by hand, or one
// whose reading failed. Not keyed on a hash because there is nothing to key on.
app.post("/v1/refinements", zValidator("json", refinementRequestSchema), async (c) => {
  await enforceRecognitionLimits(c.env, c.req.raw);
  const accountId = requireStableAccount(c.get("accountId"));
  const result = await refineMealFromNote(c.env, accountId, c.req.valid("json"));
  c.header("Cache-Control", "no-store");
  return c.json(result, 201);
});

// A dictation is about to become a recognition, so it shares the recognition
// rate limit. The key returned is single-use and dies in minutes; the real
// Soniox key never leaves the server, and no audio passes through it either —
// the device opens the transcription websocket itself.
app.post("/v1/voice/key", async (c) => {
  await enforceRecognitionLimits(c.env, c.req.raw);
  const key = await mintTranscriptionKey(c.env);
  c.header("Cache-Control", "no-store");
  return c.json(key, 201);
});

app.post("/v1/events/batch", zValidator("json", ingestEventsRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  const result = await ingestEvents(
    c.env,
    c.get("accountId"),
    c.get("partitions"),
    c.req.valid("json"),
  );
  return c.json(result, result.inserted === 0 ? 200 : 201);
});

app.post("/v1/events/reconcile", zValidator("json", reconcileEventsRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  requireStableAccount(c.get("accountId"));
  return c.json(await reconcileEvents(c.env, c.get("partitions"), c.req.valid("json")));
});

app.get("/v1/media/:hash", async (c) => {
  const accountId = c.get("accountId");
  const parsed = sha256Schema.safeParse(c.req.param("hash"));
  if (!parsed.success) throw new HttpError(400, "Invalid photo hash.");
  requireStableAccount(accountId);
  const object = await getMediaObject(c.env, c.get("partitions"), parsed.data.toLowerCase());
  if (!object) throw new HttpError(404, "Photo not found.");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  return new Response(object.body, { headers });
});

app.post("/v1/corpus/items", zValidator("json", corpusItemRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  const result = await addCorpusItem(c.env, c.get("accountId"), c.req.valid("json"));
  return c.json(result, result.cached ? 200 : 201);
});

app.delete("/v1/corpus/consent", async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await optOutCorpus(c.env, c.get("accountId")));
});

app.delete("/v1/account", async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await deleteAccountData(c.env, c.get("partitions")));
});

app.get("/v1/events", zValidator("query", eventListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  return c.json(await listEvents(c.env.DB, c.get("partitions"), query.cursor, query.limit));
});

app.get("/v1/evals", zValidator("query", evalListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  return c.json({ evals: await listMealEvals(c.env.DB, c.get("accountId"), query.limit) });
});

// --- Tables: a small group feed of shared meals. ---------------------------
//
// Every route reads and writes through `data/tables.ts`; the design decisions
// live there and in `src/contracts.ts`. Membership is checked over the same
// partition union event reads use, and nothing here ever returns a partition
// string to another member. Sync-rate-limited: this is chat-shaped traffic,
// not model-shaped.

function tableCaller(c: { get(key: "accountId"): string; get(key: "partitions"): string[] }) {
  requireStableAccount(c.get("accountId"));
  return { accountId: c.get("accountId"), partitions: c.get("partitions") };
}

app.post("/v1/tables", zValidator("json", createTableRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  const table = await createTable(c.env, tableCaller(c), c.req.valid("json"));
  c.header("Cache-Control", "no-store");
  return c.json(table, 201);
});

app.post("/v1/tables/join", zValidator("json", joinTableRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  const table = await joinTable(c.env, tableCaller(c), c.req.valid("json"));
  c.header("Cache-Control", "no-store");
  return c.json(table);
});

app.get("/v1/tables", zValidator("query", tablesListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  c.header("Cache-Control", "no-store");
  return c.json(await listTables(c.env, tableCaller(c), query.since));
});

app.get("/v1/tables/:id/feed", zValidator("query", tableFeedQuerySchema), async (c) => {
  const query = c.req.valid("query");
  c.header("Cache-Control", "no-store");
  return c.json(await getFeed(c.env, tableCaller(c), c.req.param("id"), query));
});

app.post("/v1/tables/:id/posts", zValidator("json", createPostRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  const post = await createPost(c.env, tableCaller(c), c.req.param("id"), c.req.valid("json"));
  c.header("Cache-Control", "no-store");
  return c.json(post, 201);
});

app.put(
  "/v1/tables/:id/posts/:postId/note",
  zValidator("json", updateTableNoteRequestSchema),
  async (c) => {
    await enforceSyncLimits(c.env, c.req.raw);
    const result = await updateTableNote(
      c.env,
      tableCaller(c),
      c.req.param("id"),
      c.req.param("postId"),
      c.req.valid("json").note,
    );
    return c.json(result);
  },
);

app.delete("/v1/tables/:id/posts/:postId", async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await deletePost(c.env, tableCaller(c), c.req.param("id"), c.req.param("postId")));
});

app.put("/v1/tables/:id/reactions", zValidator("json", reactionRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await setReaction(c.env, tableCaller(c), c.req.param("id"), c.req.valid("json")));
});

app.put("/v1/tables/:id/read", zValidator("json", markReadRequestSchema), async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await markRead(c.env, tableCaller(c), c.req.param("id"), c.req.valid("json").seq));
});

app.post("/v1/tables/:id/invite", async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  c.header("Cache-Control", "no-store");
  return c.json(await rotateInvite(c.env, tableCaller(c), c.req.param("id")));
});

app.post("/v1/tables/:id/leave", async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await leaveTable(c.env, tableCaller(c), c.req.param("id")));
});

app.delete("/v1/tables/:id", async (c) => {
  await enforceSyncLimits(c.env, c.req.raw);
  return c.json(await deleteTable(c.env, tableCaller(c), c.req.param("id")));
});

// The shared photo. Same headers as the private media route; the difference is
// the check — table membership, not object ownership — and the bucket prefix,
// which is the table's own. The sharer's `media/<account>/` object is never
// served to anyone but the sharer.
app.get("/v1/tables/:id/media/:postId", async (c) => {
  const object = await getPostPhoto(
    c.env,
    tableCaller(c),
    c.req.param("id"),
    c.req.param("postId"),
  );
  if (!object) throw new HttpError(404, "Photo not found.");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  return new Response(object.body, { headers });
});

app.notFound((c) => c.json({ error: "API route not found." }, 404));

app.onError((error) => {
  if (!(error instanceof HttpError)) console.error(error);
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
});

export default {
  // The policy is checked before the API, and before the auth middleware: it is
  // a published document, and a published document behind a bearer token is not
  // published. Everything else falls through to the `/api` router as before.
  fetch(request, env, context) {
    return privacyPage(request) ?? app.fetch(request, env, context);
  },
  scheduled(_controller, env, context) {
    context.waitUntil(
      Promise.all([
        deleteOrphanMedia(env),
        deleteOrphanCorpus(env),
        deleteExpiredSessions(env),
      ]).then(([media, corpus, sessions]) => {
        console.log(
          `orphan cleanup deleted ${media} media, ${corpus} corpus objects and ${sessions} expired sessions`,
        );
      }),
    );
  },
} satisfies ExportedHandler<Env>;
