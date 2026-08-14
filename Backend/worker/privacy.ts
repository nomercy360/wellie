/**
 * The privacy policy, as a page.
 *
 * This URL is kept beside the API so the browser product can link to the same
 * plain description as the implementation.
 *
 * Served outside the API and before the auth middleware — a policy behind a
 * bearer token is not a published policy. Every claim here is one the code can
 * be checked against: there is no analytics SDK, no location, no advertising
 * identifier or advertising SDK.
 */

/** The one date on the page, so it cannot drift between the two mentions. */
const UPDATED = "14 August 2026";
const CONTACT = "maximkadocnikov@gmail.com";

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wellie — Privacy Policy</title>
<style>
  :root { color-scheme: light dark; --ink: #14202e; --muted: #5b6b7d; --bg: #f6f8fb; --card: #fff; }
  @media (prefers-color-scheme: dark) {
    :root { --ink: #e8eef5; --muted: #9aa9b8; --bg: #0d141c; --card: #131c26; }
  }
  body {
    margin: 0; padding: 32px 20px 72px; background: var(--bg); color: var(--ink);
    font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 6px; }
  h2 { font-size: 1.15rem; margin: 34px 0 8px; }
  p, li { color: var(--ink); }
  .updated { color: var(--muted); font-size: 0.95rem; margin: 0 0 28px; }
  section { background: var(--card); border-radius: 16px; padding: 2px 22px 18px; margin-bottom: 14px; }
  a { color: #2f6df6; }
  footer { color: var(--muted); font-size: 0.9rem; margin-top: 28px; }
</style>
</head>
<body>
<main>
  <h1>Wellie — Privacy Policy</h1>
  <p class="updated">Last updated ${UPDATED}. Wellie is a hackathon web beta.</p>

  <section>
    <h2>Your browser identity</h2>
    <p>Wellie has no login and receives no identity-provider profile. The web app generates a random
    device identifier and stores an opaque session token in this browser's local storage. Clearing
    that browser storage can make the associated history unreachable.</p>
  </section>

  <section>
    <h2>What is stored, and where</h2>
    <ul>
      <li><strong>Meal photographs.</strong> A photograph stays on your device and a copy is stored in
      Wellie's private Cloudflare R2 bucket, so a failed reading or a retry does not need a second
      upload. The bucket is not public.</li>
      <li><strong>Your meal log.</strong> Meals, corrections and the answers you give are appended to a
      log and synced to Wellie's backend under your browser identity.</li>
      <li><strong>Recognition results.</strong> What the model returned for a photograph is kept so a
      reading can be explained and compared later.</li>
    </ul>
  </section>

  <section>
    <h2>Photographs and AI recognition</h2>
    <p>Typed or dictated words, and any photograph you attach, are sent for one purpose:
    identifying the foods and estimating what they weigh. Wellie does not add your photographs to
    its research corpus unless you separately opt in.</p>
    <p>Recognition uses Google Gemini through OrcaRouter. Hosting, storage and the database are
    Cloudflare.</p>
  </section>

  <section>
    <h2>Measurements</h2>
    <p>The web app cannot read Apple Health. It stores only measurements and check-in details you
    explicitly enter.</p>
  </section>

  <section>
    <h2>What Wellie does not collect</h2>
    <p>No advertising, no advertising identifier, no analytics SDK, no location, no
    contacts and no tracking across other apps or websites. Your
    data is never sold and never shared for anyone else's marketing.</p>
  </section>

  <section>
    <h2>Deleting your data</h2>
    <p>Settings → <em>Start over</em> erases the coach profile, goals, plans, meals, check-ins,
    measurements and workouts held for this browser identity. Recognition media and event/corpus
    tools have their own deletion routes while that browser session remains available.</p>
  </section>

  <section>
    <h2>Children</h2>
    <p>Wellie is not directed at children and is not intended for use by children under 13.</p>
  </section>

  <section>
    <h2>Contact</h2>
    <p>Questions, or a request to delete data you can no longer reach from the app:
    <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
  </section>

  <footer>Changes to this policy are published on this page with a new date above.</footer>
</main>
</body>
</html>
`;

/**
 * The policy for any request that asks for it, and `null` for everything else
 * so the caller can fall through to the API. Returning null rather than a 404
 * keeps the one route table in `index.ts`.
 */
export function privacyPage(request: Request): Response | null {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (path !== "/privacy") return null;
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
      // A minute, not an hour. At `max-age=3600` a deploy left edge caches
      // serving the previous policy for up to an hour afterwards — one request
      // in six, in the window where an App Review reviewer is the likeliest
      // reader. This page is a few kilobytes off a Worker that is already
      // running; there was never anything to save here.
      "cache-control": "public, max-age=60",
    },
  });
}
