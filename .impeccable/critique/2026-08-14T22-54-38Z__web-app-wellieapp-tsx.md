---
score: 22
maxScore: 40
rating: Acceptable
p0: 0
p1: 4
p2: 2
detectorFindings: 0
assessmentA: impeccable_critique_a
assessmentB: impeccable_critique_b
timestamp: 2026-08-14T22-54-38Z
slug: web-app-wellieapp-tsx
---
# Impeccable critique — Wellie web app

Target: `Web/app/WellieApp.tsx`

Method: two independent read-only assessments. Assessment A reviewed the product, source, and deployed UI as a design director. Assessment B ran the required detector once, inspected implementation and accessibility, and sampled the deployed UI at desktop and mobile widths. The assessments were synthesized only after both completed.

## Score

**22/40 — Acceptable.** The product concept and visual system are strong; control, recovery, localization, and assistive feedback need work.

| Heuristic | Score |
|---|---:|
| Visibility of system status | 3/4 |
| Match between system and real world | 2/4 |
| User control and freedom | 2/4 |
| Consistency and standards | 2/4 |
| Error prevention | 2/4 |
| Recognition rather than recall | 3/4 |
| Flexibility and efficiency | 2/4 |
| Aesthetic and minimalist design | 3/4 |
| Error recognition and recovery | 1/4 |
| Help and documentation | 2/4 |

Detector: `[]` (0 findings). This clean mechanical result does not cover runtime localization, recovery, responsive copy, or semantic progress.

## Strengths

- The persistent queue makes the adherence-over-optimality philosophy visible and product-specific.
- Meal capture gives camera, gallery, speech, and typed routes without hiding the frequent mobile action.
- Native controls, visible focus, reduced-motion handling, safe-area-aware camera chrome, and a disciplined warm-paper visual system form a solid base.

## Prioritized findings

### P1 — Plan review is acceptance-only

The review offers `Use this plan` but no back, reject, or conversational adjustment path. That contradicts the adaptive-coach promise and concentrates too much detail in one long surface.

### P1 — A “session” is currently a squat counter

Today promises a multi-movement session while the camera flow records squats only and completing the set advances the workout. The capability should stay explicitly narrowed until recognition and exercise progression support more.

### P1 — Navigation and failures lose context

View switches can preserve an old scroll position; local form state disappears on interruption; some failures return to misleading UI states or show raw messages without a clear retry.

### P1 — Japanese mode is incomplete

The chrome localizes, but server-authored greeting, plan, workout, and check-in content can remain English. Speech recognition followed browser language rather than the selected Wellie locale.

### P2 — Critical feedback is visual-only

Rep changes and nutrition tracks lacked useful live/progress semantics. Toasts and inline errors were not consistently announced.

### P2 — Narrow controls and faint text

Language, settings, and inline actions fell below the 44px touch floor. The faint text token had insufficient contrast for meaningful small text, and Japanese gallery copy wrapped awkwardly at 320px.

## Persona summary

- **Jordan, first-timer:** understands the queue but can be stranded by mixed language, technical terms, and acceptance-only plan review.
- **Sam, assistive-tech user:** benefits from native controls and focus styling but cannot perceive rep changes or data graphics reliably.
- **Casey, distracted mobile user:** benefits from the thumb-zone capture flow but is vulnerable to interruption, scroll-position drift, and dense check-in choices.

## Adaptation backlog selected for this pass

- Enforce 44px controls and safe-area-aware top/bottom chrome.
- Stack meal capture choices at 360px and below so Japanese labels remain intact.
- Reset scroll and focus on destination changes.
- Bind speech recognition to the selected locale.
- Add alert, live-region, and progress semantics to critical feedback.
- Constrain numeric recovery inputs and remove the comma-formatted steps placeholder.
- Prevent orphan workout starts before camera readiness and return completion failures to a restartable state.

Deferred because they require product/backend scope: full server-authored Japanese localization, negotiable plan review, multi-exercise recognition/progression, and durable draft restoration.

## Limitations

Camera/microphone permissions, real model calls, destructive actions, physical screen readers, 200% zoom, and real Android hardware were not exercised during critique. Onboarding and draft plan review were source-reviewed because the deployed browser already had a ready returning session.
