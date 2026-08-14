# Wellie web

The browser client for Wellie: conversational goal setup, plan review, Today,
camera-assisted workouts, meal photo recognition and corrections, check-ins,
meal history, progress, measurements, and settings.

The training plan is displayed as a persistent card queue. Today always shows
the next card, completion advances the rotation, and days without a workout do
not create overdue sessions.

There is no login. On first load, the app creates a random browser device ID,
opens a backend session, and saves both values in `localStorage`. Clearing site
data creates a new identity. Product records remain in the existing Wellie
backend rather than in browser storage.

## Run

```bash
npm install
npm run dev
```

The default API is the deployed Wellie Worker. Override it for local work:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787/api \
npm run dev
```

The same values can be changed from Settings in the running app and are saved
only in that browser.

## Verify

```bash
npm run lint
npm test
```

`npm test` produces the Cloudflare-compatible Vinext build and checks the
server-rendered application shell.

## Browser capabilities

- Voice input uses the browser speech-recognition API when available; typing is
  always available.
- Meal photos use the file/camera picker and the existing backend recognition
  route.
- Squat counting runs MediaPipe Pose in the browser. Camera frames and pose
  landmarks are not uploaded; only workout totals go to the backend.
- Apple Health is not exposed to normal web pages. The check-in accepts the
  five optional measurements explicitly and never treats a blank as zero.
