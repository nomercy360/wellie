---
name: Wellie
description: A calm, adaptive training and nutrition coach for real life.
colors:
  pea-green: "#bddb50"
  forest-green: "#416313"
  mist-green: "#e9f1cf"
  warm-paper: "#f5f3ed"
  deep-paper: "#ebe9e1"
  card-ivory: "#fffef9"
  near-black-green: "#1d2720"
  quiet-gray: "#687069"
  faint-gray: "#656d66"
  warm-coral: "#f08d71"
  mist-coral: "#f7ded4"
typography:
  display:
    fontFamily: "Cofo Sans, sans-serif"
    fontSize: "clamp(2.45rem, 5vw, 5.25rem)"
    fontWeight: 470
    lineHeight: 0.98
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Cofo Sans, sans-serif"
    fontSize: "clamp(1.6rem, 2.5vw, 2.4rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Cofo Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Cofo Sans, sans-serif"
    fontSize: "0.73rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  field: "15px"
  panel: "22px"
  card: "28px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "16px"
  card: "24px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.near-black-green}"
    textColor: "{colors.card-ivory}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.card-ivory}"
    textColor: "{colors.near-black-green}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  input:
    backgroundColor: "{colors.card-ivory}"
    textColor: "{colors.near-black-green}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "14px 15px"
  card:
    backgroundColor: "{colors.card-ivory}"
    textColor: "{colors.near-black-green}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: Wellie

## Overview

**Creative North Star: "The Calm Training Journal"**

Wellie should feel like a thoughtful paper training journal that happens to be alive: warm, spacious, direct, and quietly responsive to what the user actually did. Large editorial headlines make the next action feel important, while compact labels and practical cards keep data understandable without turning the product into a dashboard.

The visual system is supportive rather than clinical. Warm paper, ivory cards, near-black green text, and a restrained pea accent replace pure white, hard black, and saturated fitness-app color. Photography and camera views bring energy; the surrounding chrome stays calm enough that the user's plan, meal, or movement remains the subject.

**Key Characteristics:**

- Warm paper atmosphere with softly separated ivory surfaces.
- Editorial scale for one clear message per screen.
- Pea green reserved for progress, readiness, and primary workout actions.
- Rounded, tactile controls sized for one-handed mobile use.
- Dark, minimal chrome around camera experiences.

## Colors

The palette combines garden greens with warm paper neutrals; coral appears only for attention and recovery states.

### Primary

- **Fresh Pea Green:** The energetic action and progress accent. Use it for workout CTAs, progress fills, active dots, and the Wellie orb.
- **Forest Ink:** The deeper accent for emphasized words, positive data, and quiet status text where the brighter green would not meet contrast needs.
- **Morning Mist Green:** The soft supporting surface for suggestions, selected navigation, coaching notes, and progress tracks.

### Secondary

- **Warm Coral:** A sparing attention color for listening, correction, and caution states.
- **Blush Mist:** The low-intensity coral surface behind those states.

### Neutral

- **Warm Paper:** The continuous page background and visual atmosphere.
- **Deep Paper:** Recessed tracks, empty surfaces, and subtle structural separation.
- **Card Ivory:** Raised reading surfaces, fields, and translucent chrome.
- **Near-Black Green:** Primary text and dark controls; never substitute pure black.
- **Quiet Gray:** Supporting copy and secondary controls.
- **Faint Gray:** Placeholders and tertiary metadata only.

**The Green Means Progress Rule.** Bright pea green signals a useful next step, readiness, or measurable progress; it is not general decoration.

**The Warm Neutral Rule.** Surfaces stay warm. Avoid pure white and cold gray additions that make the system feel clinical.

## Typography

**Display Font:** Cofo Sans (with `sans-serif` fallback)

**Body Font:** Cofo Sans (with `sans-serif` fallback)

**Character:** A single variable family carries the whole product. Tight, softly weighted display type feels editorial and human; open body leading keeps coaching copy calm and readable. No other font family is permitted.

### Hierarchy

- **Display** (weight 470, fluid 2.45–5.25rem, line-height 0.98): One decisive screen message; may use a heavier green phrase for emphasis.
- **Headline** (weight 700, fluid 1.6–2.4rem, line-height 1.02): Card and section statements.
- **Title** (weight 650–760, 1.08–1.25rem): Component names and local actions.
- **Body** (weight 400–520, 1rem, line-height 1.5–1.68): Coaching copy, rationale, and instructions; keep long prose near 65 characters per line.
- **Label** (weight 680–760, about 0.73rem, tracked uppercase): Eyebrows, card kickers, and compact metadata.

**The One Family Rule.** Every visible word uses the bundled Cofo Sans variable font; differentiation comes from scale, weight, spacing, and color.

**The One Message Rule.** Give each primary surface one large headline. Do not create competing display-size statements in the same viewport.

## Layout

Desktop pages sit in a centered, fluid container capped near 1320px with 20px minimum side gutters. The home surface uses a slightly asymmetric two-column grid; content collections use three or four columns when the items remain legible. Major sections breathe with roughly 40–65px of vertical separation.

At 980px, dashboard and collection grids reduce to one or two columns. At 720px, the product becomes a single-column mobile application with 15–16px side gutters, a compact top bar, and a five-position bottom navigation. Primary mobile actions sit in the lower half of the screen or in safe-area-aware sticky controls. Touch targets are at least 44px.

Camera and meal-capture surfaces are immersive on mobile. They may go full bleed, but their back, finish, and capture actions must respect safe-area insets. Content remains usable at 320px without horizontal page scrolling, and narrow layouts must allow English and Japanese labels to wrap without clipping.

**The Thumb-First Rule.** On mobile, the frequent action belongs near the bottom; headers carry identity and escape routes, not the whole interaction.

**The Queue, Not Calendar Rule.** Training layouts describe the next card and rotation progress; do not visually imply overdue sessions or date debt.

## Elevation & Depth

Depth is mostly tonal and structural: ivory cards sit on warm paper with low-contrast green-black borders. Shadows are ambient, broad, and low-opacity. Strong elevation is reserved for floating navigation, sticky confirmation, and glass overlays on photography.

### Shadow Vocabulary

- **Ambient Surface** (`0 22px 60px rgba(41, 49, 36, 0.08)`): Large featured imagery and elevated panels.
- **Floating Control** (`0 13px 40px rgba(29, 39, 32, 0.16)`): Mobile navigation and controls that must stay legible over content.
- **Glass Badge** (`0 8px 30px rgba(23, 35, 23, 0.12)`): Translucent labels over imagery.

**The Flat-by-Default Rule.** A border and tonal shift establish most hierarchy. Add a shadow only when a surface truly floats or overlaps another.

## Shapes

Wellie uses generous, continuous curves: fields begin near 15px, panels near 22px, feature cards near 28px, and action controls are full pills. The pea orb is the one deliberately irregular silhouette. Borders are a translucent near-black green, so rounded edges register without looking outlined.

**The Soft Geometry Rule.** Containers may vary in radius by scale, but they never become sharp rectangles or decorative bubbles without a role.

## Components

### Buttons

- **Shape:** Full pill with a 48px minimum height and generous horizontal padding.
- **Primary:** Near-black green with ivory text; the featured workout action may invert to pea green with near-black text.
- **Hover / Focus:** A 1px upward lift on pointer hover; a visible muted-green 3px focus ring with 2px offset for keyboard users.
- **Secondary / Ghost:** Ivory with a quiet border, or transparent with quiet-gray text. Ghost actions remain at least 44px tall when used on touch screens.

### Chips

- **Style:** Compact pills use mist green and forest text, or a translucent ivory surface over photography.
- **State:** Selected queue and navigation states use a dark fill plus a pea indicator; color is reinforced through contrast and shape.

### Cards / Containers

- **Corner Style:** 19–28px curves depending on scale.
- **Background:** Card ivory on warm paper; feature cards may use darkened photography.
- **Shadow Strategy:** Flat by default with the Ambient Surface shadow only for featured or floating material.
- **Border:** One quiet translucent near-black green line.
- **Internal Padding:** Usually 18–24px on compact cards and 24–40px on feature cards.

### Inputs / Fields

- **Style:** Ivory fill, quiet border, 15px corners, and 14–15px internal padding.
- **Focus:** The shared muted-green focus ring; never remove focus without an equivalent.
- **Error / Disabled:** Errors use warm red-brown language near the source. Disabled controls lower opacity but retain readable labels.

### Navigation

Desktop navigation is a compact segmented pill in the centered header. Mobile navigation is a safe-area-aware floating tray with labeled destinations and a raised dark meal-capture action. The active destination uses mist green plus `aria-current`; the language switch is a two-option segmented control that never overlays page content.

### Camera Counter

The movement camera uses full-bleed dark video with only three persistent overlays: back, a large high-contrast rep counter, and finish. Pose lines are bright pea green; points are white with a dark outline, and facial landmarks stay hidden.

## Do's and Don'ts

### Do:

- **Do** keep one prominent next action per screen and place it in the mobile thumb zone.
- **Do** preserve warm paper and ivory tonal separation before reaching for shadow.
- **Do** use pea green for progress, readiness, and the workout action.
- **Do** test every surface at 320px, in Japanese, and with safe-area insets.
- **Do** keep camera overlays readable from roughly two metres away.

### Don't:

- **Don't** add another font, pure black, pure white, or cold blue-gray to the core interface.
- **Don't** use pea green as decoration or for long body text.
- **Don't** let floating controls cover the content they confirm or the phone's home indicator.
- **Don't** rely on hover, icon-only meaning, or color alone for a critical action.
- **Don't** turn the queue into a dated streak or overdue calendar.
