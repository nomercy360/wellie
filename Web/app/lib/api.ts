import type {
  ChatMessage,
  CheckIn,
  Goal,
  Meal,
  MealReading,
  Ping,
  Plan,
  Profile,
  Progress,
  Today,
  Workout,
  WorkoutSummary,
} from "./types";

const DEVICE_KEY = "wellie.device-id";
const SESSION_KEY = "wellie.session-token";
const API_URL_KEY = "wellie.api-url";

const fallbackUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://wellie-api.peatch.workers.dev/api";

function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getDeviceId() {
  const store = storage();
  const existing = store?.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  store?.setItem(DEVICE_KEY, id);
  return id;
}

export function getApiSettings() {
  const store = storage();
  return {
    url: (store?.getItem(API_URL_KEY) || fallbackUrl).replace(/\/$/, ""),
  };
}

export function saveApiSettings(url: string) {
  const store = storage();
  store?.setItem(API_URL_KEY, url.replace(/\/$/, ""));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, withSession = true): Promise<T> {
  const { url } = getApiSettings();
  const store = storage();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Device-Id", getDeviceId());
  const session = store?.getItem(SESSION_KEY);
  if (withSession && session) headers.set("X-Session-Token", session);
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${url}/${path.replace(/^\//, "")}`, {
      ...init,
      headers,
      signal: init.signal || AbortSignal.timeout(90_000),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new ApiError(408, "Wellie took too long to answer. Try once more.");
    }
    throw cause;
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, detail?.error || `Wellie returned ${response.status}.`);
  }
  return (await response.json()) as T;
}

const send = <T>(path: string, body: unknown, method = "POST") =>
  request<T>(path, { method, body: JSON.stringify(body) });

export const api = {
  ping: () => request<Ping>("v1/ping", {}, false),
  async openSession() {
    const result = await request<{
      sessionToken: string;
      profile: Profile;
      createdAccount: boolean;
    }>("v1/auth/device", { method: "POST", body: "{}" }, false);
    storage()?.setItem(SESSION_KEY, result.sessionToken);
    return result;
  },
  clearSession: () => storage()?.removeItem(SESSION_KEY),
  profile: async () => (await request<{ profile: Profile }>("v1/me")).profile,
  goal: async () => (await request<{ goal: Goal | null }>("v1/goal")).goal,
  plan: async () => (await request<{ plan: Plan | null }>("v1/plan")).plan,
  thread: () => request<{ messages: ChatMessage[]; suggestions: string[] }>("v1/thread"),
  say: (message: string) =>
    send<{
      reply: ChatMessage;
      profile: Profile;
      goal: Goal | null;
      suggestions: string[];
      missing: string[];
      ready: boolean;
    }>("v1/onboarding/turn", { message, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  generatePlan: async () => (await send<{ plan: Plan }>("v1/plan", {})).plan,
  acceptPlan: async (id: string) => (await send<{ plan: Plan }>(`v1/plan/${id}/accept`, {})).plan,
  today: (day: string, dayStart: number) =>
    request<Today>(`v1/today?day=${encodeURIComponent(day)}&dayStart=${dayStart}`),
  checkIn: async (day: string) =>
    (await request<{ checkIn: CheckIn | null }>(`v1/check-ins/${day}`)).checkIn,
  submitCheckIn: async (body: Record<string, unknown>) =>
    (await send<{ checkIn: CheckIn }>("v1/check-ins", body)).checkIn,
  progress: () => request<Progress>("v1/progress"),
  logWeight: (weightKg: number) =>
    send<{ ok: true }>("v1/measurements", { weightKg, recordedAt: Date.now(), source: "manual" }),
  recognizeMeal: (body: Record<string, unknown>) => send<MealReading>("v1/meals/recognize", body),
  logMeal: async (body: Record<string, unknown>) =>
    (await send<{ meal: Meal }>("v1/meals", body)).meal,
  refineMeal: async (id: string, note: string) =>
    (await send<{ meal: Meal }>(`v1/meals/${id}/refine`, { note })).meal,
  meals: async (from: number, to: number) =>
    (await request<{ meals: Meal[] }>(`v1/meals?from=${from}&to=${to}`)).meals,
  startWorkout: async (body: Record<string, unknown>) =>
    (await send<{ workout: Workout }>("v1/workouts", body)).workout,
  completeWorkout: (id: string, body: Record<string, unknown>) =>
    send<WorkoutSummary>(`v1/workouts/${id}/complete`, body),
  erase: async () => (await request<{ profile: Profile }>("v1/me", { method: "DELETE" })).profile,
};

export function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDayStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export async function fileToPayload(file: File) {
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const mimeType = file.type === "image/png" || file.type === "image/heic" ? file.type : "image/jpeg";
  return { imageBase64, mimeType };
}
