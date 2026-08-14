export type Profile = {
  id: string;
  displayName: string | null;
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  sex: string | null;
  activityLevel: string | null;
  trainingLocation: string | null;
  equipment: string[];
  sessionsPerWeek: number | null;
  timeZone: string | null;
  onboardingState: "collecting" | "ready";
};

export type Goal = {
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

export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  createdAt: number;
};

export type PlanExercise = { name: string; sets: number; reps: string; load: string };
export type PlanSession = {
  id: string;
  queueLabel: string;
  dayOfWeek?: number;
  title: string;
  focus: string;
  durationMin: number;
  startMinute?: number | null;
  exercises: PlanExercise[];
};
export type Plan = {
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
  sessions: PlanSession[];
  meals: { id: string; name: string; timeLabel: string; kcal: number }[];
  createdAt: number;
};

export type Meal = {
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
export type MealRecognition = {
  title: string;
  summary: string;
  items: { name: string; grams: number | null }[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: "low" | "medium" | "high";
};
export type MealReading = { recognition: MealRecognition; photoKey: string | null; model: string };

export type TodayCard = {
  kind: "workout" | "nutrition" | "goal" | "check_in";
  title: string;
  subtitle: string;
  planSessionId: string | null;
};
export type Today = {
  day: string;
  greeting: string;
  headline: string;
  cards: TodayCard[];
  meals: Meal[];
  kcalTarget: number;
  kcalConsumed: number;
  proteinTargetG: number;
  proteinConsumedG: number;
  session: PlanSession | null;
  sessionNumber: number | null;
  queueIndex: number | null;
  sessionQueue: { id: string; queueLabel: string; title: string }[];
  checkInDone: boolean;
  goal: Goal | null;
  weightDeltaKg: number | null;
  weightRemainingKg: number | null;
};

export type CheckIn = {
  id: string;
  day: string;
  sleepMinutes: number | null;
  deepSleepMinutes: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  steps: number | null;
  note: string | null;
  reply: string;
  impacts: { behaviour: string; effect: string; direction: "helped" | "hurt" | "neutral" }[];
  adjustment: string | null;
  createdAt: number;
};

export type Progress = {
  weightSeries: { recordedAt: number; weightKg: number }[];
  goalWeightKg: number | null;
  weightDeltaKg: number | null;
  weeksElapsed: number;
  workoutCount: number;
  averageFormScore: number | null;
  mealsLoggedFraction: number | null;
  kcalAdherenceFraction: number | null;
  proteinAdherenceFraction: number | null;
  sessionsCompleted: number;
  nextSessionNumber: number | null;
  note: string;
};

export type Workout = {
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
};
export type WorkoutSummary = {
  workout: Workout;
  headline: string;
  note: string;
  goalProgressFraction: number | null;
  goalProgressDetail: string | null;
};

export type Ping = {
  ok: boolean;
  database: { ok: boolean; schemaVersion: string };
  storage: { ok: boolean };
  agent: { configured: boolean; gateway: string; chatModel: string; planModel: string; visionModel: string };
  voice: { configured: boolean };
  timestamp: string;
};
