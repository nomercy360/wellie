import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Wellie application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Wellie — adaptive training and nutrition coach · Wellie<\/title>/i);
  assert.match(html, /Wellie/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("chat scrolling never becomes a React effect cleanup", async () => {
  const source = await readFile(new URL("../app/WellieApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /useEffect\(\(\)\s*=>\s*end\.current\?\.scrollIntoView/);
});

test("camera sessions count squats and render the MediaPipe pose overlay", async () => {
  const source = await readFile(new URL("../app/WellieApp.tsx", import.meta.url), "utf8");
  assert.match(source, /const movement = "Squat"/);
  assert.match(source, /PoseLandmarker\.POSE_CONNECTIONS/);
  assert.match(source, /drawConnectors\(pose/);
  assert.match(source, /<canvas ref=\{overlay\}/);
  assert.match(source, /<main className="camera-workout">/);
  assert.doesNotMatch(source, /manualReps|programmed-movements/);
});

test("plan review has no non-functional regeneration action", async () => {
  const source = await readFile(new URL("../app/WellieApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /onRegenerate|tryAnother/);
});

test("completed sessions remain repeatable for testing", async () => {
  const source = await readFile(new URL("../app/WellieApp.tsx", import.meta.url), "utf8");
  assert.match(source, /today\.sessionCompleted[\s\S]{0,120}repeatSession/);
  assert.doesNotMatch(source, /disabled=\{today\.sessionCompleted\}/);
});

test("meal photos can be selected from the gallery", async () => {
  const source = await readFile(new URL("../app/WellieApp.tsx", import.meta.url), "utf8");
  assert.match(source, /type="file"[^>]*accept="image\/jpeg,image\/png,image\/heic"/);
  assert.doesNotMatch(source, /type="file"[^>]*capture=/);
});
