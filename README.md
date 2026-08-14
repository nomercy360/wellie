# Wellie

Wellie is a browser-based training and nutrition coach. It turns a goal said or
typed in natural language into an ordered training rotation, tracks completed workouts, reads
meal photos, accepts corrections, and builds progress from what was actually
logged.

The current hackathon product has no login. On first load the web app creates a
random device ID, opens an opaque backend session, and keeps both in browser
`localStorage`. Clearing that site's browser data creates a new identity.

## Live deployment

- Web: <https://wellie-web.peatch.workers.dev>
- API: <https://wellie-api.peatch.workers.dev/api>
- Privacy: <https://wellie-api.peatch.workers.dev/privacy>

Both Workers are deployed to the Cloudflare account associated with
`maximkadocnikov@gmail.com`.

## Stack

- React 19 and Vinext on Cloudflare Workers
- Cloudflare D1 and private R2 storage
- Hono, Drizzle, Zod, TypeScript, Vitest, and Biome
- OrcaRouter with Gemini for current meal recognition
- MediaPipe Tasks Vision in the browser for squat counting
- Browser speech recognition with typed fallbacks
- English and Japanese UI with a persisted `EN / 日本語` switch
- Cofo Sans from `Web/fonts/`; no product font is loaded from a third party

## Repository layout

```text
Web/       Browser product, static MediaPipe assets, Cofo font, and web tests
Backend/   Cloudflare Worker, D1 migrations, recognition, coach domain, tests
prompts/   Recognition and revision prompt history
```

The former SwiftUI/CocoaPods project has been removed from the working tree.

## Run locally

Backend:

```bash
cd Backend
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Web:

```bash
cd Web
npm install
npm run dev
```

The web app defaults to the deployed API. Override it when testing the Worker
locally:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787/api npm run dev
```

## Identity and privacy boundary

`X-Device-Id` names one browser partition. `POST /api/v1/auth/device` returns a
random 256-bit session token, and only its SHA-256 digest is stored in D1.
Subsequent calls send the opaque token as `X-Session-Token`. There is no Apple,
Google, email, password, or app-wide bearer token in the browser bundle.

This hackathon tradeoff means identity does not roam between browsers and
cannot be recovered after local storage is cleared. Add a real account recovery
or identity flow before treating the product as durable personal storage.

## Recognition and movement

Meal recognition uses the current `Backend/worker/ai/orca.ts` pipeline. The
Worker stores exact model-input bytes privately, caches by account/input/prompt/
model, and exposes the richer recognition API plus the web coach compatibility
route.

MediaPipe Pose Lite runs entirely in the browser. Camera frames and landmarks
are not uploaded; only the final rep count and duration are saved. The official
model and WASM runtime are served from `Web/public/` so workout counting does
not depend on a CDN.

Training is a queue rather than a calendar. The active plan is an ordered deck;
completing a workout advances one card, while skipping a day leaves the same
card next. Session numbers therefore measure progress without creating overdue
workouts.

## Verify

```bash
cd Backend && pnpm verify
cd ../Web && npm run lint && npm test
```

`Backend` currently passes 146 tests. The web test builds the production Worker
and verifies the rendered application shell.

## Deploy

API:

```bash
cd Backend
pnpm db:migrate:remote
pnpm exec wrangler deploy
```

Web:

```bash
cd Web
npm test
npx wrangler deploy --config dist/server/wrangler.json
```

Never commit `Backend/.dev.vars` or provider credentials.
