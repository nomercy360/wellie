"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Dumbbell,
  Home,
  LoaderCircle,
  Mic,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Utensils,
  Weight,
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, fileToPayload, getApiSettings, getDeviceId, localDay, localDayStart, saveApiSettings } from "./lib/api";
import { I18nProvider, useI18n } from "./i18n";
import type {
  ChatMessage,
  CheckIn,
  Meal,
  MealReading,
  Ping,
  Plan,
  PlanSession,
  Profile,
  Progress,
  Today,
  Workout,
  WorkoutSummary,
} from "./lib/types";

type Stage = "launching" | "intro" | "onboarding" | "building" | "review" | "ready" | "error";
type View = "today" | "plan" | "progress" | "checkin" | "food" | "meals" | "workout" | "settings";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Orb({ size = 32 }: { size?: number }) {
  return <span className="orb" style={{ width: size, height: size }} aria-hidden="true" />;
}

function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <span className="spinner" role="status">
      <LoaderCircle size={17} aria-hidden="true" /> {label || t("working")}
    </span>
  );
}

function LanguageSwitch({ standalone = false }: { standalone?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className={cx("language-switch", standalone && "standalone")} role="group" aria-label={t("languageLabel")}>
      <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"} aria-label={t("switchToEnglish")}>EN</button>
      <button type="button" className={locale === "ja" ? "active" : ""} onClick={() => setLocale("ja")} aria-pressed={locale === "ja"} aria-label={t("switchToJapanese")}>日本語</button>
    </div>
  );
}

function Button({ children, kind = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "secondary" | "ghost" }) {
  return (
    <button className={cx("button", `button-${kind}`, className)} {...props}>
      {children}
    </button>
  );
}

function PageHeader({ eyebrow, title, body, onBack }: { eyebrow: string; title: string; body?: string; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <header className="page-heading">
      <div className="heading-row">
        {onBack && (
          <button className="icon-button" onClick={onBack} aria-label={t("back")}>
            <ArrowLeft size={19} />
          </button>
        )}
        <div className="eyebrow"><Orb size={18} /> {eyebrow}</div>
      </div>
      <h1>{title}</h1>
      {body && <p>{body}</p>}
    </header>
  );
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function VoiceComposer({ placeholder, busy, onSend }: { placeholder: string; busy?: boolean; onSend: (value: string) => void | Promise<void> }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const message = value.trim();
    if (!message || busy) return;
    setValue("");
    void onSend(message);
  };

  const listen = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const SpeechCtor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechCtor) return;
    const instance = new SpeechCtor();
    recognition.current = instance;
    instance.continuous = false;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";
    instance.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
      setValue(transcript);
    };
    instance.onend = () => setListening(false);
    instance.onerror = () => setListening(false);
    setListening(true);
    instance.start();
  };

  return (
    <form className="composer" onSubmit={submit}>
      <button type="button" className={cx("composer-icon", listening && "is-listening")} onClick={listen} aria-label={listening ? t("stopListening") : t("dictate")}>
        <Mic size={19} />
      </button>
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} disabled={busy} aria-label={placeholder} />
      <button className="composer-send" type="submit" disabled={!value.trim() || busy} aria-label={t("send")}>
        {busy ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}
      </button>
    </form>
  );
}

function Intro({ onFinish }: { onFinish: () => void }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const pages = [
    {
      image: "/media/training-home.jpg",
      alt: t("introTrainingAlt"),
      badge: t("introTrainingBadge"),
      title: <>{t("introTrainingTitle")}<br /><em>{t("introTrainingEmphasis")}</em></>,
      body: t("introTrainingBody"),
    },
    {
      image: "/media/plate.jpg",
      alt: t("introFoodAlt"),
      badge: t("introFoodBadge"),
      title: <>{t("introFoodTitle")}<br /><em>{t("introFoodEmphasis")}</em></>,
      body: t("introFoodBody"),
    },
  ];
  const current = pages[page];
  return (
    <main className="intro-shell">
      <div className="intro-top"><span className="wordmark"><Orb size={24} /> Wellie</span><div className="intro-top-actions"><LanguageSwitch /><button onClick={onFinish}>{t("skip")}</button></div></div>
      <section className="intro-grid">
        <div className="intro-visual">
          <Image src={current.image} alt={current.alt} fill priority sizes="(max-width: 800px) 100vw, 55vw" />
          <div className="glass-badge"><span /> {current.badge}</div>
        </div>
        <div className="intro-copy">
          <div className="step-label">{t("meetCoach")}</div>
          <h1>{current.title}</h1>
          <p>{current.body}</p>
          <div className="intro-actions">
            <Button onClick={() => page === pages.length - 1 ? onFinish() : setPage(page + 1)}>{page === 0 ? t("next") : t("meetWellie")} <ChevronRight size={17} /></Button>
            <div className="dots" aria-label={t("pageOf", { page: page + 1, total: pages.length })}>{pages.map((_, index) => <span key={index} className={index === page ? "active" : ""} />)}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Conversation({ messages, suggestions, busy, error, onSay }: { messages: ChatMessage[]; suggestions: string[]; busy: boolean; error: string | null; onSay: (message: string) => Promise<void> }) {
  const { t } = useI18n();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Newer browsers may return a value from scrollIntoView. Never return it
    // from an effect: React would treat that value as an unmount cleanup.
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  return (
    <main className="conversation-shell">
      <header className="conversation-header"><span className="wordmark"><Orb size={25} /> Wellie</span><div className="conversation-header-actions"><span>{t("goalSetup")}</span><LanguageSwitch /></div></header>
      <div className="conversation-layout">
        <aside className="conversation-aside">
          <div className="step-label">{t("startsWithWords")}</div>
          <h1>{t("tellWant")}<br /><em>{t("makeWorkable")}</em></h1>
          <p>{t("onboardingBody")}</p>
          <div className="sample-card">
            <span>{t("samplePlan")}</span>
            <strong>{t("sampleGoal")}</strong>
            <div className="mini-week">{t("sampleWeekdays").split(",").map((day, i) => <b key={`${day}-${i}`} className={[0, 2, 4].includes(i) ? "active" : ""}>{day}</b>)}</div>
            <small>{t("samplePlanDetail")}</small>
          </div>
        </aside>
        <section className="chat-panel">
          <div className="chat-scroll" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={cx("message", message.role)}>
                {message.role === "coach" && <Orb size={24} />}
                <div>{message.text}</div>
              </div>
            ))}
            {busy && <div className="message coach"><Orb size={24} /><div className="thinking"><span /><span /><span /></div></div>}
            {suggestions.length > 0 && <div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} disabled={busy} onClick={() => void onSay(suggestion)}>{suggestion}</button>)}</div>}
            {error && <p className="error-line">{error}</p>}
            <div ref={end} />
          </div>
          <VoiceComposer placeholder={t("goalPlaceholder")} busy={busy} onSend={onSay} />
          <small className="privacy-note">{t("privacyNote")}</small>
        </section>
      </div>
    </main>
  );
}

function BuildingPlan() {
  const { t } = useI18n();
  const stages = useMemo(() => [t("buildReading"), t("buildTraining"), t("buildFood"), t("buildGentle")], [t]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => Math.min(current + 1, stages.length - 1)), 4500);
    return () => window.clearInterval(timer);
  }, [stages.length]);
  return (
    <main className="center-state">
      <LanguageSwitch standalone />
      <Orb size={64} />
      <div className="step-label">{t("buildingPlan")}</div>
      <h1>{t("makingAmbitious")}<br /><em>{t("fitWeek")}</em></h1>
      <p>{stages[index]}</p>
      <div className="build-steps">{stages.map((_, i) => <span key={i} className={i <= index ? "active" : ""} />)}</div>
    </main>
  );
}

function MacroStrip({ plan }: { plan: Plan }) {
  const { formatNumber, t } = useI18n();
  return (
    <div className="macro-strip">
      <div><strong>{formatNumber(plan.kcalTarget)}</strong><span>{t("kcalPerDay")}</span></div>
      <div className="accent"><strong>{plan.proteinG}g</strong><span>{t("protein")}</span></div>
      <div><strong>{plan.carbsG}g</strong><span>{t("carbs")}</span></div>
      <div><strong>{plan.fatG}g</strong><span>{t("fat")}</span></div>
    </div>
  );
}

function SessionCard({ session, compact = false }: { session: PlanSession; compact?: boolean }) {
  const { t } = useI18n();
  const days = [t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday"), t("sunday")];
  const time = session.startMinute == null ? null : `${String(Math.floor(session.startMinute / 60)).padStart(2, "0")}:${String(session.startMinute % 60).padStart(2, "0")}`;
  return (
    <article className={cx("session-card", compact && "compact")}>
      <div className="session-day"><span>{days[session.dayOfWeek - 1]}</span><b>{session.durationMin} {t("minutesShort")}</b></div>
      <div className="session-title"><div><h3>{session.title}</h3><p>{session.focus}{time ? ` · ${time}` : ""}</p></div><Dumbbell size={20} /></div>
      {!compact && <div className="exercise-list">{session.exercises.map((exercise) => <div key={`${session.id}-${exercise.name}`}><span>{exercise.name}</span><b>{exercise.sets} × {exercise.reps} · {exercise.load}</b></div>)}</div>}
    </article>
  );
}

function PlanView({ plan, review, busy, onAccept, onBack }: { plan: Plan; review?: boolean; busy: boolean; onAccept?: () => void; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <main className={review ? "review-shell" : "content-page"}>
      {review && <LanguageSwitch standalone />}
      <PageHeader eyebrow={review ? t("planReady", { version: plan.version }) : t("yourPlan", { version: plan.version })} title={plan.headline} body={plan.rationale} onBack={onBack} />
      <MacroStrip plan={plan} />
      <div className="section-title"><div><span className="step-label">{t("training")}</span><h2>{t("yourWeek")}</h2></div><span>{t("sessionCount", { count: plan.sessions.length })}</span></div>
      <div className="session-grid">{plan.sessions.map((session) => <SessionCard key={session.id} session={session} />)}</div>
      {plan.meals.length > 0 && <>
        <div className="section-title"><div><span className="step-label">{t("nutrition")}</span><h2>{t("targetDay")}</h2></div></div>
        <div className="meal-plan-grid">{plan.meals.map((meal) => <div key={meal.id}><span>{meal.timeLabel}</span><strong>{meal.name}</strong><b>{meal.kcal} kcal</b></div>)}</div>
      </>}
      {review && <div className="sticky-actions">
        <Button disabled={busy} onClick={onAccept}>{busy ? <Spinner label={t("saving")} /> : <>{t("usePlan")} <Check size={17} /></>}</Button>
      </div>}
    </main>
  );
}

function NutritionRing({ consumed, target, label }: { consumed: number; target: number; label: string }) {
  const { formatNumber, t } = useI18n();
  const percent = target ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <div className="nutrition-ring" style={{ background: `conic-gradient(var(--green) ${percent}%, var(--soft-green) 0)` }}>
      <div><strong>{formatNumber(consumed)}</strong><span>{t("ofTarget", { target: formatNumber(target), label })}</span></div>
    </div>
  );
}

function TodayView({ today, onOpen }: { today: Today; onOpen: (view: View) => void }) {
  const { dateLocale, t } = useI18n();
  const workout = today.cards.find((card) => card.kind === "workout");
  return (
    <main className="today-page">
      <header className="today-heading"><div><span className="eyebrow"><Orb size={18} /> {today.greeting}</span><h1>{today.headline}</h1></div><span className="date-chip">{new Date(`${today.day}T12:00:00`).toLocaleDateString(dateLocale, { weekday: "long", month: "short", day: "numeric" })}</span></header>
      <section className="today-grid">
        <article className="hero-card workout-hero">
          <div className="card-kicker"><Dumbbell size={16} /> {t("tonightTraining")}</div>
          {today.session ? <>
            <h2>{today.session.title}</h2><p>{today.session.focus}</p>
            <div className="workout-meta"><span>{today.session.durationMin} {t("minutesShort")}</span><span>{t("movementCount", { count: today.session.exercises.length })}</span></div>
            <Button onClick={() => onOpen("workout")}>{today.sessionCompleted ? <><RotateCcw size={17} /> {t("repeatSession")}</> : <>{t("startSession")} <ChevronRight size={17} /></>}</Button>
          </> : <><h2>{t("recoveryDay")}</h2><p>{workout?.subtitle || t("recoveryFallback")}</p></>}
        </article>
        <article className="hero-card nutrition-card">
          <div className="card-kicker"><Utensils size={16} /> {t("foodToday")}</div>
          <div className="nutrition-layout">
            <NutritionRing consumed={today.kcalConsumed} target={today.kcalTarget} label="kcal" />
            <div><strong>{today.proteinConsumedG} / {today.proteinTargetG}g</strong><span>{t("protein")}</span><div className="progress-track"><i style={{ width: `${Math.min(100, today.proteinTargetG ? today.proteinConsumedG / today.proteinTargetG * 100 : 0)}%` }} /></div></div>
          </div>
          <div className="card-actions"><Button onClick={() => onOpen("food")}><Camera size={17} /> {t("scanMeal")}</Button><Button kind="ghost" onClick={() => onOpen("meals")}>{t("viewLogged", { count: today.meals.length || "" })}</Button></div>
        </article>
        <button className="detail-card clickable" onClick={() => onOpen("checkin")}>
          <div className="card-icon"><Activity size={20} /></div><div><span>{t("morningCheckin")}</span><h3>{today.checkInDone ? t("checkedIn") : t("howYesterday")}</h3><p>{today.cards.find((card) => card.kind === "check_in")?.subtitle}</p></div><ChevronRight size={19} />
        </button>
        <button className="detail-card clickable" onClick={() => onOpen("progress")}>
          <div className="card-icon coral"><BarChart3 size={20} /></div><div><span>{t("goalProgress")}</span><h3>{today.weightDeltaKg == null ? t("startHistory") : t("kgSoFar", { value: `${today.weightDeltaKg > 0 ? "+" : ""}${today.weightDeltaKg.toFixed(1)}` })}</h3><p>{today.weightRemainingKg == null ? t("logWeightTrend") : t("kgRemaining", { value: Math.abs(today.weightRemainingKg).toFixed(1) })}</p></div><ChevronRight size={19} />
        </button>
      </section>
      {today.meals.length > 0 && <section className="recent-meals"><div className="section-title"><div><span className="step-label">{t("alreadyLogged")}</span><h2>{t("mealsToday")}</h2></div><button onClick={() => onOpen("meals")}>{t("seeAll")} <ChevronRight size={14} /></button></div><div className="meal-row">{today.meals.slice(-3).reverse().map((meal) => <MealMini key={meal.id} meal={meal} />)}</div></section>}
    </main>
  );
}

function MealMini({ meal }: { meal: Meal }) {
  const { dateLocale } = useI18n();
  return <article className="meal-mini"><div><span>{new Date(meal.loggedAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}</span><strong>{meal.title}</strong></div><b>{meal.kcal} kcal</b></article>;
}

function CheckInView({ value, busy, onSubmit, onBack }: { value: CheckIn | null; busy: boolean; onSubmit: (body: Record<string, unknown>) => Promise<void>; onBack: () => void }) {
  const { formatNumber, t } = useI18n();
  const [note, setNote] = useState("");
  const [reading, setReading] = useState({ sleep: "", deep: "", hrv: "", resting: "", steps: "" });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const measured: Record<string, number> = {};
    if (reading.sleep) measured.sleepMinutes = Math.round(Number(reading.sleep) * 60);
    if (reading.deep) measured.deepSleepMinutes = Number(reading.deep);
    if (reading.hrv) measured.hrvMs = Number(reading.hrv);
    if (reading.resting) measured.restingHr = Number(reading.resting);
    if (reading.steps) measured.steps = Number(reading.steps);
    await onSubmit({ day: localDay(), ...(note.trim() && { note: note.trim() }), ...(Object.keys(measured).length && { reading: measured }) });
  };
  return (
    <main className="content-page narrow">
      <PageHeader eyebrow={t("checkinEyebrow")} title={value?.sleepMinutes ? t("sleptLastNight", { hours: Math.floor(value.sleepMinutes / 60), minutes: value.sleepMinutes % 60 }) : t("morningQuestion")} body={t("checkinHealthBody")} onBack={onBack} />
      {value ? <div className="checkin-answer">
        {value.note && <div className="message user"><div>“{value.note}”</div></div>}
        <div className="message coach"><Orb size={24} /><div>{value.reply}</div></div>
        {value.impacts.length > 0 && <div className="impact-list">{value.impacts.map((impact) => <div key={`${impact.behaviour}-${impact.effect}`} className={impact.direction}><span>{impact.behaviour}</span><strong>{impact.effect}</strong></div>)}</div>}
        {value.adjustment && <div className="adjustment"><Sparkles size={17} /> {value.adjustment}</div>}
        <div className="measurement-chips">{[
          value.sleepMinutes != null && [`${Math.floor(value.sleepMinutes / 60)}h ${value.sleepMinutes % 60}m`, t("asleep")],
          value.deepSleepMinutes != null && [`${value.deepSleepMinutes}m`, t("deep")],
          value.hrvMs != null && [`${Math.round(value.hrvMs)} ms`, "HRV"],
          value.restingHr != null && [`${Math.round(value.restingHr)}`, t("restingHr")],
          value.steps != null && [formatNumber(value.steps), t("steps")],
        ].filter(Boolean).map((item) => { const pair = item as string[]; return <span key={pair[1]}><b>{pair[0]}</b> {pair[1]}</span>; })}</div>
      </div> : <form className="checkin-form" onSubmit={submit}>
        <label className="wide">{t("yesterdayLike")}<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("yesterdayPlaceholder")} /></label>
        <div className="field-grid">
          <label>{t("sleepHours")}<input inputMode="decimal" value={reading.sleep} onChange={(e) => setReading({ ...reading, sleep: e.target.value })} placeholder="7.5" /></label>
          <label>{t("deepSleepMin")}<input inputMode="numeric" value={reading.deep} onChange={(e) => setReading({ ...reading, deep: e.target.value })} placeholder="82" /></label>
          <label>HRV, ms<input inputMode="decimal" value={reading.hrv} onChange={(e) => setReading({ ...reading, hrv: e.target.value })} placeholder="48" /></label>
          <label>{t("restingHeartRate")}<input inputMode="decimal" value={reading.resting} onChange={(e) => setReading({ ...reading, resting: e.target.value })} placeholder="61" /></label>
          <label>{t("yesterdaySteps")}<input inputMode="numeric" value={reading.steps} onChange={(e) => setReading({ ...reading, steps: e.target.value })} placeholder="8,200" /></label>
        </div>
        <Button disabled={busy || (!note.trim() && !Object.values(reading).some(Boolean))}>{busy ? <Spinner label={t("readingDay")} /> : <>{t("checkIn")} <ChevronRight size={17} /></>}</Button>
      </form>}
    </main>
  );
}

function FoodView({ onLogged, onBack }: { onLogged: () => Promise<void>; onBack: () => void }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [said, setSaid] = useState("");
  const [reading, setReading] = useState<MealReading | null>(null);
  const [logged, setLogged] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const recognize = async (description?: string) => {
    if (!file && !description?.trim()) return;
    setBusy(true); setError(null);
    try {
      const payload = file ? await fileToPayload(file) : {};
      setReading(await api.recognizeMeal({ ...payload, ...(description?.trim() && { said: description.trim() }) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mealReadError")); }
    finally { setBusy(false); }
  };
  const log = async () => {
    if (!reading) return;
    setBusy(true); setError(null);
    try {
      const meal = await api.logMeal({ ...reading.recognition, items: undefined, confidence: undefined, photoKey: reading.photoKey, note: null });
      setLogged(meal); await onLogged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mealLogError")); }
    finally { setBusy(false); }
  };
  const correct = async (note: string) => {
    if (!logged) return;
    setBusy(true);
    try { setLogged(await api.refineMeal(logged.id, note)); await onLogged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("mealUpdateError")); }
    finally { setBusy(false); }
  };
  const shown = logged || reading?.recognition;
  return (
    <main className="content-page narrow">
      <PageHeader eyebrow={t("plateReader")} title={shown ? shown.title : t("showPlate")} body={shown ? shown.summary : t("plateBody")} onBack={onBack} />
      {preview && <div className="food-preview"><Image src={preview} alt={t("mealSelectedAlt")} fill unoptimized /></div>}
      {!shown && <div className="food-input-card">
        <label className="photo-drop"><Camera size={25} /><strong>{t("choosePhoto")}</strong><span>JPG, PNG, HEIC</span><input type="file" accept="image/jpeg,image/png,image/heic" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        <span className="or">{t("or")}</span>
        <VoiceComposer placeholder={t("describeMeal")} busy={busy} onSend={(value) => { setSaid(value); return recognize(value); }} />
        {busy && !file && <div className="model-wait"><Spinner label={t("readingPlate")} /><small>{t("modelWait")}</small></div>}
        {file && <Button disabled={busy} onClick={() => void recognize(said)}>{busy ? <Spinner label={t("readingPlate")} /> : <>{t("readPlate")} <Sparkles size={17} /></>}</Button>}
      </div>}
      {shown && <div className="meal-result">
        <div className="macro-strip meal-macros"><div><strong>{shown.kcal}</strong><span>kcal</span></div><div className="accent"><strong>{shown.proteinG}g</strong><span>{t("protein")}</span></div><div><strong>{shown.carbsG}g</strong><span>{t("carbs")}</span></div><div><strong>{shown.fatG}g</strong><span>{t("fat")}</span></div></div>
        {!logged && reading && <><div className={cx("confidence", reading.recognition.confidence)}><span /> {t("confidence", { level: t(reading.recognition.confidence === "high" ? "confidenceHigh" : reading.recognition.confidence === "medium" ? "confidenceMedium" : "confidenceLow") })}</div><Button disabled={busy} onClick={() => void log()}>{busy ? <Spinner label={t("logging")} /> : <>{t("logLooksRight")} <Check size={17} /></>}</Button></>}
        {logged && <><div className="success-line"><Check size={17} /> {t("mealLogged")}</div><VoiceComposer placeholder={t("portionPlaceholder")} busy={busy} onSend={correct} />{busy && <div className="model-wait"><Spinner label={t("correctingMeal")} /><small>{t("modelWait")}</small></div>}</>}
      </div>}
      {error && <p className="error-line">{error}</p>}
    </main>
  );
}

function MealsView({ initial, onBack }: { initial: Meal[]; onBack: () => void }) {
  const { dateLocale, t } = useI18n();
  const [meals, setMeals] = useState(initial);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
    api.meals(from, Date.now()).then(setMeals).finally(() => setBusy(false));
  }, []);
  return (
    <main className="content-page">
      <PageHeader eyebrow={t("nutritionHistory")} title={t("mealsHistoryTitle")} body={t("mealsHistoryBody")} onBack={onBack} />
      {busy && <Spinner label={t("loadingMeals")} />}
      <div className="meal-history">{meals.slice().reverse().map((meal) => <article key={meal.id}><div className="meal-date"><span>{new Date(meal.loggedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}</span><b>{new Date(meal.loggedAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}</b></div><div><h3>{meal.title}</h3><p>{meal.summary}</p>{meal.note && <small>{t("corrected", { note: meal.note })}</small>}</div><div className="meal-total"><strong>{meal.kcal}</strong><span>kcal</span><b>{meal.proteinG}g {t("protein")}</b></div></article>)}</div>
      {!busy && meals.length === 0 && <div className="empty-state"><Utensils size={28} /><h2>{t("noMeals")}</h2><p>{t("noMealsBody")}</p></div>}
    </main>
  );
}

type Landmark = { x: number; y: number; visibility?: number };
type PoseConnection = { start: number; end: number };
type PoseDrawingUtils = {
  drawConnectors(landmarks: Landmark[], connections: PoseConnection[], style: { color: string; lineWidth: number }): void;
  drawLandmarks(landmarks: Landmark[], style: { color: string; fillColor: string; lineWidth: number; radius: number }): void;
};
function angle(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const cosine = (ab.x * cb.x + ab.y * cb.y) / (Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function WorkoutView({ session, onFinished, onBack }: { session: PlanSession | null; onFinished: () => Promise<void>; onBack: () => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const landmarker = useRef<{ detectForVideo(video: HTMLVideoElement, now: number): { landmarks: Landmark[][] }; close(): void } | null>(null);
  const drawing = useRef<PoseDrawingUtils | null>(null);
  const poseConnections = useRef<PoseConnection[]>([]);
  const frame = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const phase = useRef<"up" | "down">("up");
  const activeWorkout = useRef<Workout | null>(null);
  const startedAt = useRef(0);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "finishing" | "done">("idle");
  const [reps, setReps] = useState(0);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const squatExercise = session?.exercises.find((exercise) => exercise.name.toLowerCase().includes("squat"));
  const movement = "Squat";
  const target = Number(squatExercise?.reps.match(/\d+/)?.[0] || 10);

  const stopCamera = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    landmarker.current?.close();
    const context = overlay.current?.getContext("2d");
    if (context && overlay.current) context.clearRect(0, 0, overlay.current.width, overlay.current.height);
    frame.current = null; stream.current = null; landmarker.current = null; drawing.current = null; poseConnections.current = [];
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  function processFrame() {
    const element = video.current;
    if (!element || !landmarker.current || element.readyState < 2) { frame.current = requestAnimationFrame(processFrame); return; }
    const result = landmarker.current.detectForVideo(element, performance.now());
    const pose = result.landmarks[0];
    const canvas = overlay.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      if (canvas.width !== element.videoWidth || canvas.height !== element.videoHeight) {
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (pose && drawing.current) {
        drawing.current.drawConnectors(pose, poseConnections.current, { color: "#b8ef6a", lineWidth: 4 });
        drawing.current.drawLandmarks(pose, { color: "#17311d", fillColor: "#ffffff", lineWidth: 2, radius: 4 });
      }
    }
    if (pose) {
      const left = [pose[23], pose[25], pose[27]];
      const right = [pose[24], pose[26], pose[28]];
      const side = (left.reduce((sum, point) => sum + (point.visibility || 0), 0) >= right.reduce((sum, point) => sum + (point.visibility || 0), 0) ? left : right) as [Landmark, Landmark, Landmark];
      if (side.every((point) => (point.visibility || 0) > 0.45)) {
        const knee = angle(side[0], side[1], side[2]);
        if (knee < 105) phase.current = "down";
        if (knee > 155 && phase.current === "down") { phase.current = "up"; setReps((count) => count + 1); }
      }
    }
    frame.current = requestAnimationFrame(processFrame);
  }

  const start = async () => {
    setStatus("starting"); setError(null);
    try {
      activeWorkout.current = await api.startWorkout({ planSessionId: session?.id || null, movement, targetReps: target });
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (video.current) { video.current.srcObject = stream.current; await video.current.play(); }
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks("/mediapipe");
      landmarker.current = await vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: "/pose_landmarker_lite.task", delegate: "GPU" }, runningMode: "VIDEO", numPoses: 1 }) as typeof landmarker.current;
      const context = overlay.current?.getContext("2d");
      if (context) drawing.current = new vision.DrawingUtils(context) as unknown as PoseDrawingUtils;
      poseConnections.current = vision.PoseLandmarker.POSE_CONNECTIONS as PoseConnection[];
      startedAt.current = Date.now(); setStatus("running"); processFrame();
    } catch (cause) {
      stopCamera(); setStatus("idle"); setError(cause instanceof Error ? cause.message : t("cameraStartError"));
    }
  };
  const finish = async () => {
    if (!activeWorkout.current) {
      activeWorkout.current = await api.startWorkout({ planSessionId: session?.id || null, movement, targetReps: target });
      startedAt.current = Date.now();
    }
    stopCamera(); setStatus("finishing");
    try {
      const result = await api.completeWorkout(activeWorkout.current.id, { completedReps: reps, durationSec: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)), formScore: null, abandoned: false });
      setSummary(result); setStatus("done"); await onFinished();
    } catch (cause) { setStatus("running"); setError(cause instanceof Error ? cause.message : t("workoutFinishError")); }
  };

  if (summary) return <main className="content-page narrow"><PageHeader eyebrow={t("sessionComplete")} title={summary.headline} body={summary.note} onBack={onBack} /><div className="result-tiles"><div><strong>{summary.workout.completedReps}</strong><span>{t("reps")}</span></div><div><strong>{Math.max(1, Math.round((summary.workout.durationSec || 0) / 60))}</strong><span>{t("minutes")}</span></div></div>{summary.goalProgressDetail && <div className="adjustment"><Sparkles size={17} /> {summary.goalProgressDetail}</div>}<Button onClick={onBack}>{t("backToday")}</Button></main>;
  return (
    <main className="camera-workout">
      <div className="camera-stage">
        <video ref={video} playsInline muted />
        <canvas ref={overlay} aria-hidden="true" />
        <button className="camera-back" onClick={() => { stopCamera(); onBack(); }} aria-label={t("back")}><ArrowLeft size={22} /></button>
        {status !== "running" && <div className="camera-placeholder">
          {status === "idle" ? <Camera size={30} /> : <LoaderCircle size={30} className="spin" />}
          <strong>{status === "starting" ? t("startingCamera") : status === "finishing" ? t("saving") : t("cameraReady")}</strong>
          {status !== "finishing" && <span>{t("countingHelp")}</span>}
          {error && <span className="camera-error">{error}</span>}
          {status === "idle" && <Button onClick={() => void start()}><Camera size={17} /> {t("startCamera")}</Button>}
        </div>}
        {status === "running" && <div className="rep-counter"><span>{t("reps")}</span><strong>{reps}</strong><b>{t("target", { count: target })}</b></div>}
        {status === "running" && <Button className="camera-finish" onClick={() => void finish()}>{t("finishSet")} <Check size={17} /></Button>}
      </div>
    </main>
  );
}

function ProgressView({ progress, busy, onLoad, onBack }: { progress: Progress | null; busy: boolean; onLoad: (weight?: number) => Promise<void>; onBack: () => void }) {
  const { t } = useI18n();
  const [weight, setWeight] = useState("");
  useEffect(() => {
    if (progress) return;
    const timer = window.setTimeout(() => void onLoad(), 0);
    return () => window.clearTimeout(timer);
  }, [progress, onLoad]);
  const values = progress?.weightSeries.map((point) => point.weightKg) || [];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return (
    <main className="content-page">
      <PageHeader eyebrow={t("progress")} title={t("progressTitle")} body={progress?.note || t("progressLoadingBody")} onBack={onBack} />
      {busy && !progress ? <Spinner label={t("readingProgress")} /> : progress && <>
        <div className="metric-grid">
          <div><span>{t("weightChange")}</span><strong>{progress.weightDeltaKg == null ? "—" : `${progress.weightDeltaKg > 0 ? "+" : ""}${progress.weightDeltaKg.toFixed(1)} kg`}</strong><small>{progress.goalWeightKg == null ? t("noWeightGoal") : t("goalWeight", { value: progress.goalWeightKg })}</small></div>
          <div><span>{t("sessions")}</span><strong>{progress.sessionsCompleted} / {progress.sessionsPlanned}</strong><small>{t("workoutsLogged", { count: progress.workoutCount })}</small></div>
          <div><span>{t("proteinDays")}</span><strong>{progress.proteinAdherenceFraction == null ? "—" : `${Math.round(progress.proteinAdherenceFraction * 100)}%`}</strong><small>{t("loggedDaysTarget")}</small></div>
          <div><span>{t("weeksIn")}</span><strong>{progress.weeksElapsed}</strong><small>{progress.averageFormScore == null ? t("formNotMeasured") : t("averageForm", { value: progress.averageFormScore })}</small></div>
        </div>
        <section className="trend-card"><div className="section-title"><div><span className="step-label">{t("measurements")}</span><h2>{t("weightTrend")}</h2></div></div>{values.length ? <div className="bar-chart" aria-label={t("weightHistory")}>{values.map((value, index) => <div key={`${value}-${index}`}><i style={{ height: `${max === min ? 65 : 24 + (value - min) / (max - min) * 60}%` }} /><span>{value}</span></div>)}</div> : <div className="empty-inline">{t("noHistory")}</div>}</section>
      </>}
      <form className="weight-form" onSubmit={(e) => { e.preventDefault(); if (Number(weight)) void onLoad(Number(weight)).then(() => setWeight("")); }}><Weight size={20} /><label>{t("logTodayWeight")}<input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="kg" /></label><Button disabled={busy || !Number(weight)}>{t("save")}</Button></form>
    </main>
  );
}

function SettingsView({ ping, onReset, onReconnect, onBack }: { ping: Ping | null; onReset: () => Promise<void>; onReconnect: () => Promise<void>; onBack: () => void }) {
  const { t } = useI18n();
  const current = getApiSettings();
  const [url, setUrl] = useState(current.url);
  const [confirm, setConfirm] = useState(false);
  return (
    <main className="content-page narrow">
      <PageHeader eyebrow={t("settings")} title={t("browserAccount")} body={t("noLoginBody")} onBack={onBack} />
      <div className="settings-list">
        <div><span>{t("browserIdentity")}</span><code>{getDeviceId()}</code></div>
        <div><span>{t("backend")}</span><strong>{ping?.ok ? t("connected") : t("notChecked")}</strong></div>
        <div><span>{t("coachModel")}</span><strong>{ping?.agent.chatModel || "—"}</strong></div>
      </div>
      <section className="settings-section"><h2>{t("hackathonConnection")}</h2><p>{t("connectionHelp")}</p><label>{t("apiBaseUrl")}<input value={url} onChange={(e) => setUrl(e.target.value)} /></label><Button kind="secondary" onClick={() => { saveApiSettings(url); void onReconnect(); }}>{t("saveReconnect")}</Button></section>
      <section className="danger-zone"><h2>{t("startOver")}</h2><p>{t("startOverBody")}</p>{confirm ? <div><Button kind="secondary" onClick={() => setConfirm(false)}>{t("cancel")}</Button><Button className="danger" onClick={() => void onReset()}>{t("deleteEverything")}</Button></div> : <Button kind="ghost" onClick={() => setConfirm(true)}><RotateCcw size={16} /> {t("startOver")}</Button>}</section>
    </main>
  );
}

function AppChrome({ view, onView, children }: { view: View; onView: (view: View) => void; children: ReactNode }) {
  const { t } = useI18n();
  const nav: Array<{ id: View; label: string; icon: typeof Home }> = [{ id: "today", label: t("today"), icon: Home }, { id: "plan", label: t("plan"), icon: Dumbbell }, { id: "progress", label: t("progress"), icon: BarChart3 }, { id: "food", label: t("logFood"), icon: Camera }];
  return (
    <div className="app-shell">
      <header className="app-header"><button className="wordmark" onClick={() => onView("today")}><Orb size={25} /> Wellie</button><nav>{nav.slice(0, 3).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onView(item.id)}>{item.label}</button>)}</nav><div className="header-actions"><LanguageSwitch /><button className="log-food-button" onClick={() => onView("food")}><Camera size={18} /><span>{t("logFood")}</span></button><button className="icon-button" onClick={() => onView("settings")} aria-label={t("settings")}><Settings size={19} /></button></div></header>
      <div className="app-content">{children}</div>
      <nav className="mobile-nav">{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onView(item.id)}><Icon size={19} /><span>{item.label}</span></button>; })}</nav>
    </div>
  );
}

function WellieApplication() {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("launching");
  const [view, setView] = useState<View>("today");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [today, setToday] = useState<Today | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ping, setPing] = useState<Ping | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshToday = useCallback(async () => {
    const day = localDay();
    const [nextToday, nextCheckIn] = await Promise.all([api.today(day, localDayStart()), api.checkIn(day)]);
    setToday(nextToday); setCheckIn(nextCheckIn);
  }, []);

  const buildPlan = useCallback(async () => {
    setStage("building"); setError(null);
    try { setPlan(await api.generatePlan()); setStage("review"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("buildPlanError")); setStage("onboarding"); }
  }, [t]);

  const bootstrap = useCallback(async () => {
    setStage("launching"); setError(null);
    try {
      const health = await api.ping(); setPing(health);
      let nextProfile: Profile;
      try { nextProfile = await api.profile(); }
      catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) { api.clearSession(); await api.openSession(); nextProfile = await api.profile(); }
        else throw cause;
      }
      setProfile(nextProfile);
      const [goal, nextPlan] = await Promise.all([api.goal(), api.plan()]); setPlan(nextPlan);
      if (nextProfile.onboardingState !== "ready" || !goal) {
        const thread = await api.thread(); setMessages(thread.messages); setSuggestions(thread.suggestions);
        const introSeen = localStorage.getItem("wellie.hasSeenIntro") === "true" || thread.messages.length > 1;
        setStage(introSeen ? "onboarding" : "intro");
      } else if (!nextPlan) await buildPlan();
      else if (nextPlan.status === "draft") setStage("review");
      else { await refreshToday(); setStage("ready"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("connectError")); setStage("error"); }
  }, [buildPlan, refreshToday, t]);
  useEffect(() => {
    const timer = window.setTimeout(() => void bootstrap(), 0);
    return () => window.clearTimeout(timer);
  }, [bootstrap]);

  const say = async (message: string) => {
    setBusy(true); setError(null); setSuggestions([]);
    const pending: ChatMessage = { id: `pending-${Date.now()}`, role: "user", text: message, createdAt: Date.now() };
    setMessages((current) => [...current, pending]);
    try {
      const turn = await api.say(message); setProfile(turn.profile); setSuggestions(turn.suggestions);
      const thread = await api.thread(); setMessages(thread.messages);
      if (turn.ready) await buildPlan();
    } catch (cause) { setMessages((current) => current.filter((item) => item.id !== pending.id)); setError(cause instanceof Error ? cause.message : t("answerError")); }
    finally { setBusy(false); }
  };

  const acceptPlan = async () => {
    if (!plan) return;
    setBusy(true); setError(null);
    try { setPlan(await api.acceptPlan(plan.id)); await refreshToday(); setStage("ready"); setView("today"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("acceptPlanError")); }
    finally { setBusy(false); }
  };

  const submitCheckIn = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try { setCheckIn(await api.submitCheckIn(body)); await refreshToday(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("checkinSaveError")); }
    finally { setBusy(false); }
  };

  const loadProgress = useCallback(async (weight?: number) => {
    setBusy(true); setError(null);
    try { if (weight) await api.logWeight(weight); setProgress(await api.progress()); if (weight) await refreshToday(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("progressReadError")); }
    finally { setBusy(false); }
  }, [refreshToday, t]);

  const reset = async () => {
    setBusy(true);
    try { setProfile(await api.erase()); setPlan(null); setToday(null); setProgress(null); setCheckIn(null); const thread = await api.thread(); setMessages(thread.messages); setSuggestions(thread.suggestions); setView("today"); setStage("onboarding"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("eraseError")); }
    finally { setBusy(false); }
  };

  if (stage === "launching") return <main className="launch"><Orb size={54} /><span>Wellie</span></main>;
  if (stage === "error") return <main className="center-state error-state"><LanguageSwitch standalone /><Orb size={50} /><div className="step-label">{t("connectionNeeded")}</div><h1>{t("cantReach")}<br /><em>{t("ownBackend")}</em></h1><p>{error}</p><Button onClick={() => void bootstrap()}><RefreshCw size={17} /> {t("tryAgain")}</Button><button className="text-button" onClick={() => { setStage("ready"); setView("settings"); }}>{t("editConnection")}</button></main>;
  if (stage === "intro") return <Intro onFinish={() => { localStorage.setItem("wellie.hasSeenIntro", "true"); setStage("onboarding"); }} />;
  if (stage === "onboarding") return <Conversation messages={messages} suggestions={suggestions} busy={busy} error={error} onSay={say} />;
  if (stage === "building") return <BuildingPlan />;
  if (stage === "review" && plan) return <PlanView plan={plan} review busy={busy} onAccept={() => void acceptPlan()} />;
  if (stage === "ready") return (
    <AppChrome view={view} onView={setView}>
      {error && <div className="toast"><span>{error}</span><button onClick={() => setError(null)} aria-label={t("dismiss")}><X size={16} /></button></div>}
      {view === "today" && (today ? <TodayView today={today} onOpen={setView} /> : <main className="center-state"><Spinner label={t("assemblingToday")} /></main>)}
      {view === "plan" && plan && <PlanView plan={plan} onBack={() => setView("today")} busy={busy} />}
      {view === "checkin" && <CheckInView value={checkIn} busy={busy} onSubmit={submitCheckIn} onBack={() => setView("today")} />}
      {view === "food" && <FoodView onLogged={refreshToday} onBack={() => setView("today")} />}
      {view === "meals" && <MealsView initial={today?.meals || []} onBack={() => setView("today")} />}
      {view === "workout" && <WorkoutView session={today?.session || null} onFinished={refreshToday} onBack={() => setView("today")} />}
      {view === "progress" && <ProgressView progress={progress} busy={busy} onLoad={loadProgress} onBack={() => setView("today")} />}
      {view === "settings" && <SettingsView ping={ping} onReset={reset} onReconnect={bootstrap} onBack={() => setView("today")} />}
    </AppChrome>
  );
  return <main className="launch"><Orb size={54} /><span>{profile?.displayName || "Wellie"}</span></main>;
}

export default function WellieApp() {
  return <I18nProvider><WellieApplication /></I18nProvider>;
}
