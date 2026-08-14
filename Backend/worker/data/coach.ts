import type { MealRecognitionPayload, RecognitionRequest } from "../../src/contracts";
import { decodeBase64Image, sha256Hex } from "../ai/image";
import type { Env } from "../env";
import { HttpError } from "../lib/http-error";
import { callerMarket, recognizeMeal } from "./recognitions";

type ProfileRow = {
  accountId: string;
  displayName: string | null;
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  sex: string | null;
  activityLevel: string | null;
  trainingLocation: string | null;
  equipmentJson: string;
  sessionsPerWeek: number | null;
  timeZone: string | null;
  onboardingState: string;
  pendingSuggestionsJson: string;
  createdAt: number;
  updatedAt: number;
};

type Goal = {
  id: string;
  kind: string;
  originalMessage: string;
  targetValue: number | null;
  targetKind: "change" | "absolute" | null;
  targetUnit: string | null;
  targetDate: number | null;
  baselineValue: number | null;
  createdAt: number;
};

type Meal = {
  id: string;
  loggedAt: number;
  title: string;
  summary: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string | null;
  hasPhoto: boolean;
};

const PROFILE_COLUMNS = `account_id AS accountId, display_name AS displayName,
  height_cm AS heightCm, weight_kg AS weightKg, birth_year AS birthYear, sex,
  activity_level AS activityLevel, training_location AS trainingLocation,
  equipment_json AS equipmentJson, sessions_per_week AS sessionsPerWeek,
  time_zone AS timeZone, onboarding_state AS onboardingState,
  pending_suggestions_json AS pendingSuggestionsJson, created_at AS createdAt,
  updated_at AS updatedAt`;

function jsonArray(value: string | null | undefined): string[] {
  try {
    const result = JSON.parse(value || "[]");
    return Array.isArray(result) ? result.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function profile(row: ProfileRow) {
  return {
    id: row.accountId,
    displayName: row.displayName,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    birthYear: row.birthYear,
    sex: row.sex,
    activityLevel: row.activityLevel,
    trainingLocation: row.trainingLocation,
    equipment: jsonArray(row.equipmentJson),
    sessionsPerWeek: row.sessionsPerWeek,
    timeZone: row.timeZone,
    onboardingState: row.onboardingState === "ready" ? "ready" : "collecting",
  } as const;
}

export async function ensureCoachProfile(env: Env, accountId: string) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO coach_profiles (account_id, created_at, updated_at)
     VALUES (?, ?, ?) ON CONFLICT(account_id) DO NOTHING`,
  )
    .bind(accountId, now, now)
    .run();
  const row = await env.DB.prepare(
    `SELECT ${PROFILE_COLUMNS} FROM coach_profiles WHERE account_id = ?`,
  )
    .bind(accountId)
    .first<ProfileRow>();
  if (!row) throw new HttpError(500, "The coach profile could not be opened.");
  return profile(row);
}

export async function activeGoal(env: Env, accountId: string): Promise<Goal | null> {
  return env.DB.prepare(
    `SELECT id, kind, original_message AS originalMessage, target_value AS targetValue,
      target_kind AS targetKind, target_unit AS targetUnit, target_date AS targetDate,
      baseline_value AS baselineValue, created_at AS createdAt
     FROM coach_goals WHERE account_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(accountId)
    .first<Goal>();
}

async function messageCount(env: Env, accountId: string) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM coach_messages WHERE account_id = ? AND role = 'user'",
  )
    .bind(accountId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function addMessage(env: Env, accountId: string, role: "user" | "coach", text: string) {
  const createdAt = Date.now();
  const item = { id: crypto.randomUUID(), role, text, createdAt };
  await env.DB.prepare(
    "INSERT INTO coach_messages (id, account_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(item.id, accountId, role, text, createdAt)
    .run();
  return item;
}

export async function coachThread(env: Env, accountId: string) {
  await ensureCoachProfile(env, accountId);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM coach_messages WHERE account_id = ?",
  )
    .bind(accountId)
    .first<{ count: number }>();
  if (!count?.count) {
    await addMessage(env, accountId, "coach", "Hi, I'm Wellie. So — what are you chasing?");
  }
  const rows = await env.DB.prepare(
    `SELECT id, role, text, created_at AS createdAt FROM coach_messages
     WHERE account_id = ? ORDER BY created_at ASC`,
  )
    .bind(accountId)
    .all<{ id: string; role: "user" | "coach"; text: string; createdAt: number }>();
  const current = await env.DB.prepare(
    "SELECT pending_suggestions_json AS suggestions FROM coach_profiles WHERE account_id = ?",
  )
    .bind(accountId)
    .first<{ suggestions: string }>();
  return { messages: rows.results, suggestions: jsonArray(current?.suggestions) };
}

function firstNumber(pattern: RegExp, text: string): number | null {
  const value = pattern.exec(text)?.[1];
  return value ? Number(value) : null;
}

function extractGoal(text: string, weightKg: number | null) {
  const lower = text.toLowerCase();
  let kind: string | null = null;
  if (/lose|fat|lean|slim|減量|痩せ/.test(lower)) kind = "lose_weight_fat";
  else if (/muscle|gain|bulk|strong|筋肉|増量/.test(lower)) kind = "gain_weight_muscle";
  else if (/run|race|marathon|5k|10k|走/.test(lower)) kind = "event_performance";
  else if (/fit|health|energy|move|体力|健康/.test(lower)) kind = "general_fitness";
  if (!kind) return null;
  const absolute = firstNumber(/(?:to|reach|目標)\s*(\d{2,3}(?:\.\d+)?)\s*kg/i, text);
  const change = firstNumber(/(\d{1,2}(?:\.\d+)?)\s*kg/i, text);
  return {
    kind,
    originalMessage: text,
    targetValue: absolute ?? change,
    targetKind:
      absolute != null ? ("absolute" as const) : change != null ? ("change" as const) : null,
    targetUnit: absolute != null || change != null ? "kg" : null,
    targetDate: null,
    baselineValue: weightKg,
  };
}

function onboardingPatch(text: string, current: Awaited<ReturnType<typeof ensureCoachProfile>>) {
  const lower = text.toLowerCase();
  const values: Record<string, unknown> = {};
  let height = firstNumber(/(\d{3}(?:\.\d+)?)\s*(?:cm|centimet)/i, text);
  let weight = firstNumber(/(\d{2,3}(?:\.\d+)?)\s*(?:kg|kilo)/i, text);
  if (height == null && weight == null) {
    const numbers = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    if (numbers.length >= 2 && numbers[0] >= 130 && numbers[0] <= 230) {
      [height, weight] = numbers;
    }
  }
  if (height && height >= 120 && height <= 240) values.height_cm = height;
  if (weight && weight >= 30 && weight <= 300) values.weight_kg = weight;

  const sessions = firstNumber(/([1-7])\s*(?:evenings?|days?|times?|sessions?|回)/i, text);
  if (sessions) values.sessions_per_week = sessions;
  else if (!current.sessionsPerWeek && /^[1-7]$/.test(text.trim()))
    values.sessions_per_week = Number(text.trim());

  if (/\bhome\b|自宅/.test(lower)) values.training_location = "home";
  else if (/\bgym\b|ジム/.test(lower)) values.training_location = "gym";
  else if (/outdoor|outside|屋外/.test(lower)) values.training_location = "outdoors";

  if (/mostly sitting|desk|座り/.test(lower)) values.activity_level = "mostly_sitting";
  else if (/on my feet|standing|歩/.test(lower)) values.activity_level = "on_my_feet";
  else if (/train regularly|regularly|定期/.test(lower)) values.activity_level = "trains_regularly";
  else if (/train sometimes|sometimes|時々/.test(lower)) values.activity_level = "trains_sometimes";

  if (/non.?binary|ノンバイナリー/.test(lower)) values.sex = "non_binary";
  else if (/\bfemale\b|\bwoman\b|女性/.test(lower)) values.sex = "female";
  else if (/\bmale\b|\bman\b|男性/.test(lower)) values.sex = "male";

  const statedAge = /(?:age|aged|年齢)\s*(\d{2})(?!\d)/i.exec(text)?.[1];
  const conversationalAge = /(?:i'm|i am)\s*(\d{2})(?!\d)(?:\s*years?(?:\s*old)?)?(?!\s*cm)/i.exec(
    text,
  )?.[1];
  const age = Number(statedAge ?? conversationalAge ?? 0) || null;
  if (age && age >= 16 && age <= 100) values.birth_year = new Date().getUTCFullYear() - age;

  const equipment = [
    /dumbbell|ダンベル/.test(lower) && "dumbbells",
    /band|バンド/.test(lower) && "resistance band",
    /kettlebell|ケトルベル/.test(lower) && "kettlebell",
    /barbell|バーベル/.test(lower) && "barbell",
  ].filter((item): item is string => Boolean(item));
  if (equipment.length) values.equipment_json = JSON.stringify(equipment);
  return values;
}

function nextQuestion(
  value: Awaited<ReturnType<typeof ensureCoachProfile>>,
  goal: Goal | null,
): { reply: string; suggestions: string[]; missing: string[] } {
  const missing: string[] = [];
  if (!goal) missing.push("goal");
  if (value.heightCm == null) missing.push("height");
  if (value.weightKg == null) missing.push("weight");
  if (value.sessionsPerWeek == null) missing.push("sessions per week");
  if (value.trainingLocation == null) missing.push("where you train");
  if (value.activityLevel == null) missing.push("current activity");
  if (value.sex == null) missing.push("sex");

  if (!goal)
    return {
      reply: "What result matters most right now?",
      suggestions: ["Lose fat", "Build muscle", "Feel fitter"],
      missing,
    };
  if (value.heightCm == null || value.weightKg == null) {
    return {
      reply: "Got it. What are your height in cm and current weight in kg?",
      suggestions: [],
      missing,
    };
  }
  if (value.sessionsPerWeek == null) {
    return {
      reply: "How many sessions can you honestly protect each week?",
      suggestions: ["2", "3", "4"],
      missing,
    };
  }
  if (value.trainingLocation == null) {
    return {
      reply: "Where will most of those sessions happen?",
      suggestions: ["At home", "Gym", "Outdoors"],
      missing,
    };
  }
  if (value.activityLevel == null) {
    return {
      reply: "Outside training, which sounds closest to your usual week?",
      suggestions: ["Mostly sitting", "On my feet", "Train sometimes"],
      missing,
    };
  }
  return {
    reply:
      "That is enough to build a useful first week. I’ll start it deliberately manageable and adjust from what you actually complete.",
    suggestions: [],
    missing,
  };
}

export async function takeCoachTurn(
  env: Env,
  accountId: string,
  input: { message?: unknown; timeZone?: unknown },
) {
  const text = typeof input.message === "string" ? input.message.trim() : "";
  if (!text) throw new HttpError(400, "A message is required.");
  const before = await ensureCoachProfile(env, accountId);
  const patch = onboardingPatch(text, before);
  if (typeof input.timeZone === "string" && input.timeZone.length <= 80)
    patch.time_zone = input.timeZone;
  const assignments = Object.keys(patch).map((key) => `${key} = ?`);
  if (assignments.length) {
    await env.DB.prepare(
      `UPDATE coach_profiles SET ${assignments.join(", ")}, updated_at = ? WHERE account_id = ?`,
    )
      .bind(...Object.values(patch), Date.now(), accountId)
      .run();
  }
  const updated = await ensureCoachProfile(env, accountId);
  let goal = await activeGoal(env, accountId);
  if (!goal) {
    const extracted = extractGoal(text, updated.weightKg);
    if (extracted) {
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      await env.DB.prepare(
        `INSERT INTO coach_goals (id, account_id, kind, original_message, target_value,
          target_kind, target_unit, target_date, baseline_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          accountId,
          extracted.kind,
          extracted.originalMessage,
          extracted.targetValue,
          extracted.targetKind,
          extracted.targetUnit,
          extracted.targetDate,
          extracted.baselineValue,
          createdAt,
        )
        .run();
      goal = { id, createdAt, ...extracted };
    }
  }
  const count = await messageCount(env, accountId);
  let after = await ensureCoachProfile(env, accountId);
  const ready = Boolean(goal && after.heightCm && after.weightKg && after.sessionsPerWeek);
  if (ready && after.onboardingState !== "ready") {
    await env.DB.prepare(
      "UPDATE coach_profiles SET onboarding_state = 'ready', updated_at = ? WHERE account_id = ?",
    )
      .bind(Date.now(), accountId)
      .run();
    after = await ensureCoachProfile(env, accountId);
  }
  const next = nextQuestion(after, goal);
  const replyText = ready
    ? "That is enough to build a useful first week. I’ll start it deliberately manageable and adjust from what you actually complete."
    : next.reply;
  await addMessage(env, accountId, "user", text);
  const reply = await addMessage(env, accountId, "coach", replyText);
  await env.DB.prepare(
    "UPDATE coach_profiles SET pending_suggestions_json = ? WHERE account_id = ?",
  )
    .bind(JSON.stringify(ready ? [] : next.suggestions), accountId)
    .run();
  return {
    reply,
    profile: after,
    goal,
    suggestions: ready ? [] : next.suggestions,
    missing: next.missing,
    ready,
    turn: count + 1,
  };
}

type Plan = {
  id: string;
  version: number;
  status: "draft" | "active" | "superseded";
  headline: string;
  rationale: string;
  kcalTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  weeklyRateKg: number | null;
  sessions: Array<{
    id: string;
    queueLabel: string;
    dayOfWeek?: number;
    title: string;
    focus: string;
    durationMin: number;
    startMinute?: number | null;
    exercises: Array<{ name: string; sets: number; reps: string; load: string }>;
  }>;
  meals: Array<{ id: string; name: string; timeLabel: string; kcal: number }>;
  createdAt: number;
};

function planFromRow(row: { payload: string; status: Plan["status"] }) {
  const plan = JSON.parse(row.payload) as Plan;
  const fallbackLabels = ["Legs", "Push", "Pull", "Legs"];
  return {
    ...plan,
    status: row.status,
    sessions: plan.sessions.map((session, index) => ({
      ...session,
      queueLabel: session.queueLabel || fallbackLabels[index % fallbackLabels.length],
    })),
  };
}

export async function currentCoachPlan(env: Env, accountId: string): Promise<Plan | null> {
  const row = await env.DB.prepare(
    `SELECT payload_json AS payload, status FROM coach_plans WHERE account_id = ?
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at DESC LIMIT 1`,
  )
    .bind(accountId)
    .first<{ payload: string; status: Plan["status"] }>();
  return row ? planFromRow(row) : null;
}

function trainingDeck(location: string | null, equipment: string[]) {
  const loaded =
    location === "gym" || equipment.some((item) => /dumbbell|kettlebell|barbell/.test(item));
  const load = loaded ? "comfortable load · 3 reps in reserve" : "bodyweight · controlled";
  return [
    {
      queueLabel: "Legs",
      title: "Lower body strength",
      focus: "Squat pattern, legs, and trunk control",
      exercises: [
        { name: loaded ? "Goblet squat" : "Bodyweight squat", sets: 3, reps: "8–10", load },
        { name: "Reverse lunge", sets: 2, reps: "8 / side", load },
        { name: "Dead bug", sets: 2, reps: "8 / side", load: "slow and controlled" },
      ],
    },
    {
      queueLabel: "Push",
      title: "Push strength",
      focus: "Chest, shoulders, and trunk control",
      exercises: [
        { name: loaded ? "Dumbbell floor press" : "Incline push-up", sets: 3, reps: "8–12", load },
        { name: loaded ? "Dumbbell shoulder press" : "Pike push-up", sets: 3, reps: "8–10", load },
        { name: "Side plank", sets: 2, reps: "25 sec / side", load: "bodyweight" },
      ],
    },
    {
      queueLabel: "Pull",
      title: "Pull + posterior chain",
      focus: "Back, hips, and postural strength",
      exercises: [
        { name: loaded ? "One-arm row" : "Backpack row", sets: 3, reps: "10 / side", load },
        { name: loaded ? "Romanian deadlift" : "Hip hinge", sets: 3, reps: "10", load },
        { name: "Bird dog", sets: 2, reps: "8 / side", load: "slow and controlled" },
      ],
    },
    {
      queueLabel: "Legs",
      title: "Lower body conditioning",
      focus: "Repeatable squat work and leg endurance",
      exercises: [
        { name: loaded ? "Goblet squat" : "Tempo squat", sets: 3, reps: "10", load },
        { name: "Split squat", sets: 2, reps: "8 / side", load },
        { name: "Fast march", sets: 4, reps: "40 sec", load: "conversational pace" },
      ],
    },
  ];
}

export async function draftCoachPlan(env: Env, accountId: string): Promise<Plan> {
  const person = await ensureCoachProfile(env, accountId);
  const goal = await activeGoal(env, accountId);
  if (!goal) throw new HttpError(409, "Finish the goal conversation before building a plan.");
  const count = Math.max(1, Math.min(6, person.sessionsPerWeek || 3));
  const weight = person.weightKg || 70;
  const proteinG = Math.round(weight * 1.8);
  const fatG = Math.round(weight * 0.75);
  const baseKcal = Math.round(weight * 30);
  const isLoss = goal.kind === "lose_weight_fat";
  const isGain = goal.kind === "gain_weight_muscle";
  const kcalTarget = Math.max(1400, baseKcal + (isLoss ? -350 : isGain ? 220 : 0));
  const carbsG = Math.max(80, Math.round((kcalTarget - proteinG * 4 - fatG * 9) / 4));
  const templates = trainingDeck(person.trainingLocation, person.equipment);
  const now = Date.now();
  const versionRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(version), 0) AS version FROM coach_plans WHERE account_id = ?",
  )
    .bind(accountId)
    .first<{ version: number }>();
  const id = crypto.randomUUID();
  const plan: Plan = {
    id,
    version: (versionRow?.version ?? 0) + 1,
    status: "draft",
    headline: `A four-card rotation for about ${count} sessions a week`,
    rationale:
      "The deck advances only when you finish a session. Skip a day and nothing becomes overdue—the next card simply waits for you.",
    kcalTarget,
    proteinG,
    carbsG,
    fatG,
    weeklyRateKg: isLoss ? -0.35 : isGain ? 0.2 : null,
    sessions: templates.map((template) => ({
      id: crypto.randomUUID(),
      durationMin: 35,
      ...template,
    })),
    meals: [
      {
        id: crypto.randomUUID(),
        name: "Breakfast",
        timeLabel: "Morning",
        kcal: Math.round(kcalTarget * 0.25),
      },
      {
        id: crypto.randomUUID(),
        name: "Lunch",
        timeLabel: "Midday",
        kcal: Math.round(kcalTarget * 0.35),
      },
      {
        id: crypto.randomUUID(),
        name: "Dinner",
        timeLabel: "Evening",
        kcal: Math.round(kcalTarget * 0.4),
      },
    ],
    createdAt: now,
  };
  await env.DB.prepare(
    "INSERT INTO coach_plans (id, account_id, version, status, payload_json, created_at) VALUES (?, ?, ?, 'draft', ?, ?)",
  )
    .bind(id, accountId, plan.version, JSON.stringify(plan), now)
    .run();
  return plan;
}

export async function acceptCoachPlan(env: Env, accountId: string, planId: string) {
  const row = await env.DB.prepare(
    "SELECT payload_json AS payload FROM coach_plans WHERE id = ? AND account_id = ?",
  )
    .bind(planId, accountId)
    .first<{ payload: string }>();
  if (!row) throw new HttpError(404, "That plan is not on file.");
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE coach_plans SET status = 'superseded' WHERE account_id = ? AND status = 'active'",
    ).bind(accountId),
    env.DB.prepare("UPDATE coach_plans SET status = 'active' WHERE id = ? AND account_id = ?").bind(
      planId,
      accountId,
    ),
  ]);
  return planFromRow({ payload: row.payload, status: "active" });
}

function mealFromRow(row: {
  id: string;
  loggedAt: number;
  title: string;
  summary: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string | null;
  photoKey: string | null;
}): Meal {
  return { ...row, hasPhoto: Boolean(row.photoKey) };
}

export async function coachMeals(env: Env, accountId: string, from: number, to: number) {
  const rows = await env.DB.prepare(
    `SELECT id, logged_at AS loggedAt, title, summary, kcal, protein_g AS proteinG,
      carbs_g AS carbsG, fat_g AS fatG, note, photo_key AS photoKey
     FROM coach_meals WHERE account_id = ? AND logged_at >= ? AND logged_at < ? ORDER BY logged_at ASC`,
  )
    .bind(accountId, from, to)
    .all<Parameters<typeof mealFromRow>[0]>();
  return rows.results.map(mealFromRow);
}

function recognitionSummary(recognition: MealRecognitionPayload) {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  const items: Array<{ name: string; grams: number | null }> = [];
  let alternatives = 0;
  for (const dish of recognition.dishes) {
    for (const ingredient of dish.ingredients) {
      const factor = ingredient.grams / 100;
      kcal += ingredient.per_100g.kcal * factor;
      proteinG += ingredient.per_100g.protein * factor;
      carbsG += ingredient.per_100g.carbohydrate * factor;
      fatG += ingredient.per_100g.fat * factor;
      alternatives += ingredient.alternatives.length;
      items.push({ name: ingredient.label, grams: Math.round(ingredient.grams) });
    }
    if (!dish.ingredients.length && dish.panel) {
      kcal += dish.panel.calories ?? 0;
      proteinG += dish.panel.protein ?? 0;
      carbsG += dish.panel.carbohydrate ?? 0;
      fatG += dish.panel.fat ?? 0;
    }
  }
  const names = recognition.dishes.map((dish) => dish.name).filter(Boolean);
  const title = names.join(" + ") || "Meal";
  const confidence = alternatives === 0 ? "high" : alternatives <= 2 ? "medium" : "low";
  return {
    title,
    summary: `${Math.round(kcal)} kcal and ${Math.round(proteinG)} g protein, estimated from ${names.length === 1 ? names[0] : "the foods shown"}.`,
    items,
    kcal: Math.round(kcal),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
    confidence,
  };
}

export async function recognizeCoachMeal(
  env: Env,
  accountId: string,
  request: Request,
  input: Record<string, unknown>,
) {
  const imageBase64 = typeof input.imageBase64 === "string" ? input.imageBase64 : undefined;
  const said = typeof input.said === "string" ? input.said : undefined;
  if (!imageBase64 && !said?.trim())
    throw new HttpError(400, "Add a photograph or describe the meal.");
  const recognitionInput: RecognitionRequest = imageBase64
    ? {
        imageBase64,
        mimeType:
          input.mimeType === "image/png" || input.mimeType === "image/webp"
            ? input.mimeType
            : "image/jpeg",
        photoHash: await sha256Hex(decodeBase64Image(imageBase64)),
        ...(said && { said }),
      }
    : { said };
  const result = await recognizeMeal(env, accountId, recognitionInput, callerMarket(request));
  return {
    recognition: recognitionSummary(result.recognition),
    photoKey: result.photoKey,
    model: result.model,
  };
}

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function logCoachMeal(env: Env, accountId: string, input: Record<string, unknown>) {
  const loggedAt = Date.now();
  const row = {
    id: crypto.randomUUID(),
    loggedAt,
    title: typeof input.title === "string" ? input.title.slice(0, 160) : "Meal",
    summary: typeof input.summary === "string" ? input.summary.slice(0, 600) : "Meal logged.",
    kcal: Math.max(0, Math.round(finite(input.kcal))),
    proteinG: Math.max(0, finite(input.proteinG)),
    carbsG: Math.max(0, finite(input.carbsG)),
    fatG: Math.max(0, finite(input.fatG)),
    note: typeof input.note === "string" ? input.note.slice(0, 500) : null,
    photoKey: typeof input.photoKey === "string" ? input.photoKey : null,
  };
  await env.DB.prepare(
    `INSERT INTO coach_meals (id, account_id, logged_at, title, summary, kcal,
      protein_g, carbs_g, fat_g, note, photo_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      accountId,
      row.loggedAt,
      row.title,
      row.summary,
      row.kcal,
      row.proteinG,
      row.carbsG,
      row.fatG,
      row.note,
      row.photoKey,
    )
    .run();
  return mealFromRow(row);
}

export async function refineCoachMeal(env: Env, accountId: string, mealId: string, note: string) {
  const row = await env.DB.prepare(
    `SELECT id, logged_at AS loggedAt, title, summary, kcal, protein_g AS proteinG,
      carbs_g AS carbsG, fat_g AS fatG, note, photo_key AS photoKey
     FROM coach_meals WHERE id = ? AND account_id = ?`,
  )
    .bind(mealId, accountId)
    .first<Parameters<typeof mealFromRow>[0]>();
  if (!row) throw new HttpError(404, "That meal is not on file.");
  // Corrections can change identity as well as portion, so a multiplier is not
  // enough. Ask the current Orca model to re-price the complete corrected meal.
  const modelResult = await recognizeMeal(
    env,
    accountId,
    {
      said: [
        `Previously logged meal: ${row.title}.`,
        `Previous estimate: ${row.kcal} kcal, ${row.proteinG} g protein, ${row.carbsG} g carbohydrate, ${row.fatG} g fat.`,
        `The person corrected it with: "${note}"`,
        "Return the whole corrected meal. The person's correction overrides the previous estimate.",
      ].join("\n"),
    },
    null,
  );
  const corrected = recognitionSummary(modelResult.recognition);
  const updated = {
    ...row,
    title: corrected.title,
    kcal: corrected.kcal,
    proteinG: corrected.proteinG,
    carbsG: corrected.carbsG,
    fatG: corrected.fatG,
    note: [row.note, note].filter(Boolean).join(" · "),
    summary: corrected.summary,
  };
  await env.DB.prepare(
    `UPDATE coach_meals SET title = ?, summary = ?, kcal = ?, protein_g = ?, carbs_g = ?,
      fat_g = ?, note = ? WHERE id = ? AND account_id = ?`,
  )
    .bind(
      updated.title,
      updated.summary,
      updated.kcal,
      updated.proteinG,
      updated.carbsG,
      updated.fatG,
      updated.note,
      mealId,
      accountId,
    )
    .run();
  return mealFromRow(updated);
}

export async function checkInFor(env: Env, accountId: string, day: string) {
  const row = await env.DB.prepare(
    "SELECT payload_json AS payload FROM coach_check_ins WHERE account_id = ? AND day = ?",
  )
    .bind(accountId, day)
    .first<{ payload: string }>();
  return row ? JSON.parse(row.payload) : null;
}

export async function recordCheckIn(env: Env, accountId: string, input: Record<string, unknown>) {
  const day =
    typeof input.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : null;
  if (!day) throw new HttpError(400, "day must be YYYY-MM-DD.");
  const reading =
    input.reading && typeof input.reading === "object"
      ? (input.reading as Record<string, unknown>)
      : {};
  const note = typeof input.note === "string" ? input.note.slice(0, 1000) : null;
  const sleepMinutes = typeof reading.sleepMinutes === "number" ? reading.sleepMinutes : null;
  const impacts: Array<{
    behaviour: string;
    effect: string;
    direction: "helped" | "hurt" | "neutral";
  }> = [];
  if (note && sleepMinutes != null && /beer|alcohol|late|stress|酒|遅/.test(note.toLowerCase())) {
    impacts.push({
      behaviour: note.slice(0, 80),
      effect: `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m sleep recorded`,
      direction: sleepMinutes < 420 ? "hurt" : "neutral",
    });
  }
  const createdAt = Date.now();
  const result = {
    id: crypto.randomUUID(),
    day,
    sleepMinutes,
    deepSleepMinutes:
      typeof reading.deepSleepMinutes === "number" ? reading.deepSleepMinutes : null,
    hrvMs: typeof reading.hrvMs === "number" ? reading.hrvMs : null,
    restingHr: typeof reading.restingHr === "number" ? reading.restingHr : null,
    steps: typeof reading.steps === "number" ? reading.steps : null,
    note,
    reply:
      sleepMinutes == null
        ? "I have your note, but no measured sleep to connect it to. Keep today as planned and use effort, not guilt, to decide the pace."
        : sleepMinutes < 420
          ? "That was a short night. Keep the session, but stop each set while the reps still look clean."
          : "Recovery looks workable from what you measured. Keep today’s plan unchanged.",
    impacts,
    adjustment:
      sleepMinutes != null && sleepMinutes < 360
        ? "Keep the exercises, but take one set off each movement today."
        : null,
    createdAt,
  };
  await env.DB.prepare(
    `INSERT INTO coach_check_ins (id, account_id, day, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, day)
     DO UPDATE SET id = excluded.id, payload_json = excluded.payload_json, created_at = excluded.created_at`,
  )
    .bind(result.id, accountId, day, JSON.stringify(result), createdAt)
    .run();
  return result;
}

function goalTarget(goal: Goal | null, baseline: number | null) {
  if (!goal?.targetValue) return null;
  if (goal.targetKind === "absolute") return goal.targetValue;
  if (baseline == null) return null;
  return baseline + (goal.kind === "gain_weight_muscle" ? 1 : -1) * Math.abs(goal.targetValue);
}

export function queuedSession<T>(sessions: T[], completedCount: number) {
  const safeCount = Math.max(0, Math.floor(completedCount));
  const queueIndex = sessions.length ? safeCount % sessions.length : null;
  return {
    completedCount: safeCount,
    queueIndex,
    sessionNumber: sessions.length ? safeCount + 1 : null,
    session: queueIndex == null ? null : sessions[queueIndex],
  };
}

async function completedQueueWorkoutCount(env: Env, accountId: string, plan: Plan) {
  const sessionIds = plan.sessions.map((session) => session.id);
  if (!sessionIds.length) return 0;
  const placeholders = sessionIds.map(() => "?").join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM coach_workouts
     WHERE account_id = ? AND status = 'completed' AND plan_session_id IN (${placeholders})`,
  )
    .bind(accountId, ...sessionIds)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function todaySummary(env: Env, accountId: string, day: string, dayStart: number) {
  const person = await ensureCoachProfile(env, accountId);
  const [goal, plan, meals, checkIn] = await Promise.all([
    activeGoal(env, accountId),
    currentCoachPlan(env, accountId),
    coachMeals(env, accountId, dayStart, dayStart + 86_400_000),
    checkInFor(env, accountId, day),
  ]);
  const queue =
    plan?.status === "active"
      ? queuedSession(plan.sessions, await completedQueueWorkoutCount(env, accountId, plan))
      : queuedSession<Plan["sessions"][number]>([], 0);
  const session = queue.session;
  const kcalConsumed = meals.reduce((sum, meal) => sum + meal.kcal, 0);
  const proteinConsumedG = meals.reduce((sum, meal) => sum + meal.proteinG, 0);
  const firstWeight = await env.DB.prepare(
    "SELECT weight_kg AS weightKg FROM coach_measurements WHERE account_id = ? ORDER BY recorded_at ASC LIMIT 1",
  )
    .bind(accountId)
    .first<{ weightKg: number }>();
  const lastWeight = await env.DB.prepare(
    "SELECT weight_kg AS weightKg FROM coach_measurements WHERE account_id = ? ORDER BY recorded_at DESC LIMIT 1",
  )
    .bind(accountId)
    .first<{ weightKg: number }>();
  const baseline = goal?.baselineValue ?? firstWeight?.weightKg ?? person.weightKg;
  const weightDeltaKg =
    lastWeight && baseline != null ? Math.round((lastWeight.weightKg - baseline) * 10) / 10 : null;
  const target = goalTarget(goal, baseline);
  const weightRemainingKg =
    target != null && lastWeight
      ? Math.round(Math.abs(target - lastWeight.weightKg) * 10) / 10
      : null;
  return {
    day,
    greeting:
      new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening",
    headline: session
      ? `Next up is ${session.queueLabel.toLowerCase()}.`
      : "Your next card will appear here.",
    cards: [
      {
        kind: "workout",
        title: session?.title || "No active deck",
        subtitle: session
          ? `${session.durationMin} minutes · ${session.focus}`
          : "Accept a plan to start your training rotation.",
        planSessionId: session?.id ?? null,
      },
      {
        kind: "nutrition",
        title: "Nutrition",
        subtitle: `${kcalConsumed} of ${plan?.kcalTarget || 2000} kcal logged`,
        planSessionId: null,
      },
      {
        kind: "check_in",
        title: "Check-in",
        subtitle: checkIn ? "Today’s context is on file." : "Add only what you actually measured.",
        planSessionId: null,
      },
      {
        kind: "goal",
        title: "Goal",
        subtitle: goal?.originalMessage || "Keep the week moving.",
        planSessionId: null,
      },
    ],
    meals,
    kcalTarget: plan?.kcalTarget || 2000,
    kcalConsumed,
    proteinTargetG: plan?.proteinG || Math.round((person.weightKg || 70) * 1.8),
    proteinConsumedG: Math.round(proteinConsumedG),
    session,
    sessionNumber: queue.sessionNumber,
    queueIndex: queue.queueIndex,
    sessionQueue:
      plan?.status === "active"
        ? plan.sessions.map(({ id, queueLabel, title }) => ({ id, queueLabel, title }))
        : [],
    checkInDone: Boolean(checkIn),
    goal,
    weightDeltaKg,
    weightRemainingKg,
  };
}

export async function logWeight(env: Env, accountId: string, input: Record<string, unknown>) {
  const weight = finite(input.weightKg, -1);
  if (weight < 30 || weight > 300) throw new HttpError(400, "weightKg must be between 30 and 300.");
  const recordedAt = typeof input.recordedAt === "number" ? input.recordedAt : Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO coach_measurements (id, account_id, weight_kg, recorded_at, source) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), accountId, weight, recordedAt, "manual"),
    env.DB.prepare(
      "UPDATE coach_profiles SET weight_kg = ?, updated_at = ? WHERE account_id = ?",
    ).bind(weight, Date.now(), accountId),
  ]);
}

export async function coachProgress(env: Env, accountId: string) {
  const person = await ensureCoachProfile(env, accountId);
  const goal = await activeGoal(env, accountId);
  const plan = await currentCoachPlan(env, accountId);
  const weights = await env.DB.prepare(
    "SELECT recorded_at AS recordedAt, weight_kg AS weightKg FROM coach_measurements WHERE account_id = ? ORDER BY recorded_at ASC",
  )
    .bind(accountId)
    .all<{ recordedAt: number; weightKg: number }>();
  const workouts = await env.DB.prepare(
    `SELECT COUNT(*) AS count, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      AVG(CASE WHEN form_score IS NOT NULL THEN form_score END) AS averageForm
     FROM coach_workouts WHERE account_id = ?`,
  )
    .bind(accountId)
    .first<{ count: number; completed: number; averageForm: number | null }>();
  const baseline = goal?.baselineValue ?? weights.results[0]?.weightKg ?? person.weightKg;
  const latest = weights.results.at(-1)?.weightKg ?? null;
  const weeksElapsed = Math.max(
    1,
    Math.ceil((Date.now() - (goal?.createdAt || Date.now())) / 604_800_000),
  );
  const target = goalTarget(goal, baseline);
  const queueCompleted = plan ? await completedQueueWorkoutCount(env, accountId, plan) : 0;
  return {
    weightSeries: weights.results,
    goalWeightKg: target,
    weightDeltaKg:
      baseline != null && latest != null ? Math.round((latest - baseline) * 10) / 10 : null,
    weeksElapsed,
    workoutCount: workouts?.count ?? 0,
    averageFormScore: workouts?.averageForm == null ? null : Math.round(workouts.averageForm),
    mealsLoggedFraction: null,
    kcalAdherenceFraction: null,
    proteinAdherenceFraction: null,
    sessionsCompleted: queueCompleted,
    nextSessionNumber: plan ? queuedSession(plan.sessions, queueCompleted).sessionNumber : null,
    note:
      weights.results.length < 2
        ? "One more weight entry will turn this into a trend. Until then, completed sessions are the useful signal."
        : "The direction is visible now. Keep logging under the same conditions and let the weekly pattern—not one day—drive changes.",
  };
}

function workout(row: {
  id: string;
  planSessionId: string | null;
  movement: string;
  targetReps: number | null;
  completedReps: number;
  startedAt: number;
  completedAt: number | null;
  durationSec: number | null;
  formScore: number | null;
  status: "in_progress" | "completed" | "abandoned";
}) {
  return row;
}

export async function startCoachWorkout(
  env: Env,
  accountId: string,
  input: Record<string, unknown>,
) {
  const requestedSessionId = typeof input.planSessionId === "string" ? input.planSessionId : null;
  if (requestedSessionId) {
    const plan = await currentCoachPlan(env, accountId);
    if (plan?.status !== "active")
      throw new HttpError(409, "Accept a plan before starting its next card.");
    const next = queuedSession(
      plan.sessions,
      await completedQueueWorkoutCount(env, accountId, plan),
    ).session;
    if (!next || next.id !== requestedSessionId)
      throw new HttpError(409, "That card is not next in your training queue.");
  }
  const row = workout({
    id: crypto.randomUUID(),
    planSessionId: requestedSessionId,
    movement: typeof input.movement === "string" ? input.movement.slice(0, 160) : "Movement",
    targetReps: typeof input.targetReps === "number" ? Math.round(input.targetReps) : null,
    completedReps: 0,
    startedAt: Date.now(),
    completedAt: null,
    durationSec: null,
    formScore: null,
    status: "in_progress",
  });
  await env.DB.prepare(
    `INSERT INTO coach_workouts (id, account_id, plan_session_id, movement, target_reps,
      completed_reps, started_at, completed_at, duration_sec, form_score, status)
     VALUES (?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, 'in_progress')`,
  )
    .bind(row.id, accountId, row.planSessionId, row.movement, row.targetReps, row.startedAt)
    .run();
  return row;
}

export async function completeCoachWorkout(
  env: Env,
  accountId: string,
  id: string,
  input: Record<string, unknown>,
) {
  const row = await env.DB.prepare(
    `SELECT id, plan_session_id AS planSessionId, movement, target_reps AS targetReps,
      completed_reps AS completedReps, started_at AS startedAt, completed_at AS completedAt,
      duration_sec AS durationSec, form_score AS formScore, status
     FROM coach_workouts WHERE id = ? AND account_id = ?`,
  )
    .bind(id, accountId)
    .first<ReturnType<typeof workout>>();
  if (!row) throw new HttpError(404, "That workout is not on file.");
  const completedAt = Date.now();
  const completedReps = Math.max(0, Math.round(finite(input.completedReps)));
  const durationSec = Math.max(
    1,
    Math.round(finite(input.durationSec, (completedAt - row.startedAt) / 1000)),
  );
  const formScore = typeof input.formScore === "number" ? input.formScore : null;
  const status = input.abandoned === true ? ("abandoned" as const) : ("completed" as const);
  const result = workout({ ...row, completedAt, completedReps, durationSec, formScore, status });
  await env.DB.prepare(
    `UPDATE coach_workouts SET completed_reps = ?, completed_at = ?, duration_sec = ?,
      form_score = ?, status = ? WHERE id = ? AND account_id = ?`,
  )
    .bind(completedReps, completedAt, durationSec, formScore, status, id, accountId)
    .run();
  const target = row.targetReps;
  return {
    workout: result,
    headline: target && completedReps >= target ? "Target met, cleanly." : "Session recorded.",
    note:
      status === "abandoned"
        ? "You stopped where you stopped. The next session stays manageable."
        : "That card is complete. The next one is ready whenever you are.",
    goalProgressFraction: target ? Math.min(1, completedReps / target) : null,
    goalProgressDetail: target ? `${completedReps} of ${target} target reps completed.` : null,
  };
}

export async function eraseCoachData(env: Env, accountId: string) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM coach_workouts WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_measurements WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_check_ins WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_meals WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_plans WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_messages WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_goals WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM coach_profiles WHERE account_id = ?").bind(accountId),
  ]);
  return ensureCoachProfile(env, accountId);
}
