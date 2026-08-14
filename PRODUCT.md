# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A working adult with a real calendar. Meetings that run late, roughly three
free evenings a week, training mostly at home with dumbbells and a band. They
are motivated and have a goal with a date attached to it — a season, a trip, a
number.

Their failure mode is not ambition. It is that a plan breaks the first time a
1:1 overruns or a night's sleep is short, and once broken it is abandoned. They
have started before.

## Product Purpose

Wellie takes a goal said out loud, in the user's own words, and turns it into a
training and nutrition plan that it keeps adjusting from what actually
happened — sessions completed, food logged, sleep and recovery.

Success is the user still training in week ten, with a plan that reflects their
real life rather than the one they described on day one.

## Positioning

One agent reads training, food, and sleep/recovery together, changes the plan,
and tells the user why it changed. Neighbouring products split those signals
across separate apps or separate tabs and leave the synthesis to the user.

The claim is the synthesis and the explanation, not any single capability.

## Operating Context

- **Onboarding is a conversation.** The goal arrives as speech. Wellie clarifies
  a vague goal, then asks only for what it cannot infer (height, weight, where
  they train). Returning users skip most of it.
- **Sessions happen at home, in the evening**, the browser camera propped at roughly hip
  height about two metres away, hands occupied, often after work.
- **Food is logged mid-day** by photographing a plate, then corrected by
  speech ("it was a bigger portion", "no rice").
- **The morning check-in is explicit** — the browser cannot read Apple Health,
  so the user enters only the measurements they actually have and says what
  yesterday was like.
- **Training is an ordered queue, not a calendar.** The plan cycles through a
  four-card legs → push → pull → legs deck. Completing a session advances the
  queue; skipping a day leaves the same card next, so nothing becomes overdue.
- Pain reports, persistence, and pain-driven plan changes are out of scope. The
  designed "it hurts / safe swap" screen is not built, so the app has no path
  that responds to pain — a real gap, not a deferred polish item.

## Capabilities and Constraints

Committed capabilities, all four confirmed as real rather than demo-only:

- **Voice-first conversation** — goal capture, logging, and corrections can use
  the browser speech-recognition API; every spoken path has a typed equivalent.
- **Camera movement tracking** — MediaPipe Pose Lite runs in the browser and counts
  squats from a side, front, or oblique camera view. A form score and movements
  other than squats are not implemented, so no session carries a form score.
- **Persistent session queue** — the next training card is available every day,
  advances only after a completed workout, wraps indefinitely, and keeps a
  lifetime session number rather than date-based adherence debt.
- **Food photo → macros** — a plate photograph returns kcal and macros,
  correctable by speech. Built.
- **Manual recovery data** — sleep, deep sleep, HRV, resting heart rate, steps,
  and weight can be entered explicitly. Wearable sync is not present on web.

Delivery is two-stage and the stages share one codebase: a three-minute demo
path first, then the real product. The demo must be good enough to survive
becoming the product — it is not throwaway.

Technical constraints as they stand:

- Responsive web app on current mobile and desktop browsers.
- Backend is a Cloudflare Worker with D1 and R2, carrying the full domain:
  accounts, the coach thread, goals, versioned plans, workouts, meals,
  check-ins and measurements.
- Every model call goes through OrcaRouter. `anthropic/claude-sonnet-5` is the
  coach; `google/gemini-3.6-flash` reads plates. Both are configuration rather
  than code paths.
- A random browser device ID and opaque per-device session token are the
  identity. There is no login or cross-browser recovery in the hackathon build.
- Model-backed routes have per-device and daily spending limits.

Explicitly undecided: pricing and business model; which wearables beyond Apple
Health ship first; whether progress and
analytics live as a destination or as something Wellie raises in conversation.

## Brand Commitments

- **The name "Wellie" is final.** Fixed in copy, bundle identifier, and any
  outward-facing material.

Deliberately *not* committed, and therefore open to replacement rather than
treated as constraints:

- the green pea mascot (five of the twenty designed screens currently lean on
  it, so replacing it is a real, scoped decision, not a free one);
- the agent's persona and voice as written in the current copy;
- the imported visual world — it is working material, not an identity.

## Evidence on Hand

- **No users, metrics, testimonials, partnerships, press, or benchmarks.**
  Future work must never fabricate proof, numbers, logos, or social proof of any
  kind. The `7b` opener shows two sample cards to explain what Wellie does; they
  are labelled "sample plan" and phrased as an example of what it builds, never
  as something it built for a past client, because there are no past clients.
  The coach persona carries the same rule: it may only state figures it was
  given, and never cites studies or percentages of other users.
- **Design canvas** — Claude Design project `dda9827b-983a-4389-9202-c081107fb2e2`,
  file `Wellie Options.dc.html`. The reference for product behaviour and copy.
  The screens that became the product are `1c`, `2d`/`7b`, `2e`, `2f`, `3b`/`3d`,
  `4c`, `5b`/`5c`, `5f`, `5i` and `6a`/`6b`.
- **Implemented** — the web app is wired end to end and holds no mockup data:
  conversation, plan review, Today, check-in, food scan, camera squat set, meal
  history, and progress.
- **Real assets** — the plate photograph (`PlateMeal`), the chicken bowl in the
  `7b` opener (`ChickenBowl`), and one mascot pose (`MascotWave`). `MascotCheer`
  is referenced by the workout results screen and does not exist yet, so that
  slot renders the labelled placeholder.
- **Pose tracking** — MediaPipe Tasks Vision and the bundled Pose Lite model run
  directly in the browser; raw frames and 33-point landmarks stay in memory and
  are never sent to the Worker.
- **Food recognition** — `google/gemini-3.6-flash` through OrcaRouter, reading
  a photograph that has already landed in the private bucket. Verified against
  the committed plate photograph: it identifies the dish and its components, and
  a spoken correction ("about one and a half times that") rescales the estimate
  proportionally.

## Initial Goal Taxonomy

The user never has to classify their own goal. They speak or type in their own
words; extraction maps the message to one or more canonical kinds. A message
that is too ambiguous returns two or three likely suggestions for confirmation.

- Body composition: lose weight/fat; maintain weight/recomposition; gain
  weight/muscle.
- Performance: strength target; endurance target; skill/mobility target.
- Wellbeing: energy/daily activity; sleep/recovery quality; habit adherence.

The extraction result preserves the original message. Targets, dates, units,
baseline values, and constraints remain separate structured details rather than
being encoded into the goal kind.

## Product Principles

1. **Ask only for what cannot be inferred.** Every question Wellie asks is one
   it could not answer from the conversation, the user's history, or their
   connected data.
2. **Never change the plan silently.** When Wellie moves a session, swaps an
   exercise, or adjusts a target, it says so and says why.
3. **Adherence beats optimality.** A slightly worse plan the user actually
   follows is the correct plan. Bend around real life rather than defending the
   program.
4. **Speech first, never speech only.** Every spoken path has a tappable
   equivalent, because the user is sometimes on a train and sometimes mid-set.
5. **Correct, don't scold.** Nothing is banned and no lapse is punished. Pain
   stops the set; the answer is a substitution, not a lecture.

## Accessibility & Inclusion

No formal standard has been set. Two product-specific needs are established by
the operating context and are not optional:

- **During a session the camera is roughly two metres away and hands are
  occupied.** Anything the user must read or act on mid-set has to work at that
  distance, hands-free.
- **Responsive text and layout** must remain usable under browser zoom and
  narrow mobile viewports.
- **Reduced motion** is respected. Camera surfaces keep dark chrome for clear
  contrast against live video.
