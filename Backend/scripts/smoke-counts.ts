import { readFile } from "node:fs/promises";
import { type RefinementRequest, refinementRequestSchema } from "../src/contracts";
import { requestMealRecognition } from "../worker/ai/recognize";
import { revisionSpec } from "../worker/ai/revision";
import type { Env } from "../worker/env";

function parseVars(source: string): Record<string, string> {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const raw = line.slice(separator + 1).trim();
        const value =
          (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
            ? raw.slice(1, -1)
            : raw;
        return [key, value];
      }),
  );
}

const secrets = parseVars(await readFile(new URL("../.dev.vars", import.meta.url), "utf8"));
if (!secrets.ORCA_API_KEY) {
  throw new Error("ORCA_API_KEY is missing from Backend/.dev.vars");
}

const env = {
  ORCA_API_KEY: secrets.ORCA_API_KEY,
  ORCA_BASE_URL: "https://api.orcarouter.ai",
  RECOGNITION_MODEL: "google/gemini-3.6-flash",
  RECOGNITION_THINKING_LEVEL: "low",
  RECOGNITION_MEDIA_RESOLUTION: "",
  RECOGNITION_SEARCH: "on",
} as Env;

function summarizeRecognition(result: Awaited<ReturnType<typeof requestMealRecognition>>) {
  return {
    dishes: result.recognition.dishes.map((dish) => ({
      name: dish.name,
      count: dish.count,
      items: dish.ingredients.map((item) => ({
        label: item.label,
        grams: item.grams,
        brand: item.brand,
        sizes: item.sizes.map((size) => size.label),
        alternatives: item.alternatives.map((alternative) => alternative.label),
      })),
    })),
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

function summarizeRevision(result: Awaited<ReturnType<typeof requestMealRecognition>>) {
  const revision = result.recognition as unknown as {
    dish_counts: Array<{ index: number; count: number }>;
    dish_names: Array<{ index: number; name: string }>;
    add: unknown[];
    revise: unknown[];
    remove: number[];
  };
  return {
    dishCounts: revision.dish_counts,
    dishNames: revision.dish_names,
    changedItems: revision.revise.length,
    addedItems: revision.add.length,
    removedItems: revision.remove.length,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

async function recognize(said: string) {
  const result = await requestMealRecognition(env, { said, market: "JP" });
  return summarizeRecognition(result);
}

async function revise(input: RefinementRequest) {
  const checked = refinementRequestSchema.parse(input);
  const result = await requestMealRecognition(
    env,
    { note: checked.note, market: "JP" },
    revisionSpec(checked),
  );
  return summarizeRevision(result);
}

type RecognitionSummary = Awaited<ReturnType<typeof recognize>>;
type RevisionSummary = Awaited<ReturnType<typeof revise>>;

type RecognitionCase = {
  name: string;
  said: string;
  expectedCounts: number[];
  expectsEveryDishBranded?: boolean;
};

type RevisionCase = {
  name: string;
  input: RefinementRequest;
  expectedCounts: Array<{ index: number; count: number }>;
};

const recognitionCases: RecognitionCase[] = [
  {
    name: "generic English brands",
    said: "2 Subway sandwiches and 3 colas",
    expectedCounts: [2, 3],
  },
  {
    name: "explicit English products",
    said: "2 Subway 15 cm turkey subs and 3 cans of Coca-Cola",
    expectedCounts: [2, 3],
    expectsEveryDishBranded: true,
  },
  {
    name: "Japanese counters and products",
    said: "サブウェイのBLT 15cmを2個と、コカ・コーラ500mlを3本",
    expectedCounts: [2, 3],
    expectsEveryDishBranded: true,
  },
  {
    name: "three unrelated dish counts",
    said: "three tacos, one bowl of rice, and two cans of Asahi Super Dry",
    expectedCounts: [3, 1, 2],
  },
  {
    name: "three products from one chain",
    said: "one Big Mac, 2 medium fries, and 3 medium Coca-Cola Zeros from McDonald's",
    expectedCounts: [1, 2, 3],
    expectsEveryDishBranded: true,
  },
];

function twoDishCorrection(
  firstCount: number,
  secondCount: number,
  note: string,
): RefinementRequest {
  return {
    current: [
      { label: "Subway sandwich", grams: 240 * firstCount },
      { label: "Coca-Cola", grams: 350 * secondCount },
    ],
    dishes: [
      { name: "Subway sandwich", count: firstCount, item_indices: [1] },
      { name: "Coca-Cola", count: secondCount, item_indices: [2] },
    ],
    note,
  };
}

const revisionCases: RevisionCase[] = [
  {
    name: "pronoun copy count",
    input: {
      current: [{ label: "SAVAS milk protein drink", grams: 200 }],
      dishes: [{ name: "SAVAS milk protein drink", count: 1, item_indices: [1] }],
      note: "4 of these",
    },
    expectedCounts: [{ index: 1, count: 4 }],
  },
  {
    name: "named dishes",
    input: twoDishCorrection(1, 1, "2 Subways and 3 colas"),
    expectedCounts: [
      { index: 1, count: 2 },
      { index: 2, count: 3 },
    ],
  },
  {
    name: "ordinal references",
    input: twoDishCorrection(1, 1, "make it three of the first and two of the second"),
    expectedCounts: [
      { index: 1, count: 3 },
      { index: 2, count: 2 },
    ],
  },
  {
    name: "change one and preserve one",
    input: twoDishCorrection(2, 3, "only one cola; leave the sandwiches alone"),
    expectedCounts: [{ index: 2, count: 1 }],
  },
  {
    name: "reduce every dish",
    input: twoDishCorrection(3, 2, "I only had one of each"),
    expectedCounts: [
      { index: 1, count: 1 },
      { index: 2, count: 1 },
    ],
  },
];

function sameCounts(
  actual: Array<{ index: number; count: number }>,
  expected: Array<{ index: number; count: number }>,
) {
  const sort = (values: Array<{ index: number; count: number }>) =>
    [...values].sort((left, right) => left.index - right.index);
  return JSON.stringify(sort(actual)) === JSON.stringify(sort(expected));
}

function checkRecognition(test: RecognitionCase, result: RecognitionSummary) {
  const countsPass =
    JSON.stringify(result.dishes.map((dish) => dish.count)) === JSON.stringify(test.expectedCounts);
  const brandedPass =
    !test.expectsEveryDishBranded ||
    result.dishes.every((dish) => dish.items.some((item) => Boolean(item.brand)));
  const menuChoiceCoverage = result.dishes.map((dish) => ({
    dish: dish.name,
    choices: dish.items.reduce(
      (total, item) => total + item.sizes.length + item.alternatives.length,
      0,
    ),
  }));
  return { countsPass, brandedPass, menuChoiceCoverage, pass: countsPass && brandedPass };
}

function checkRevision(test: RevisionCase, result: RevisionSummary) {
  const countsPass = sameCounts(result.dishCounts, test.expectedCounts);
  const itemDeltaPass =
    result.changedItems === 0 && result.addedItems === 0 && result.removedItems === 0;
  return { countsPass, itemDeltaPass, pass: countsPass && itemDeltaPass };
}

async function runSequentially<T, R>(
  values: T[],
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (const value of values) results.push(await operation(value));
  return results;
}

// Live smoke tests intentionally avoid a request burst. Search-backed product
// calls can all decide to browse at once, and the local development key should
// test the feature rather than the vendor's burst throttle.
const recognitionResults = await runSequentially(recognitionCases, async (test) => {
  const result = await recognize(test.said);
  return {
    name: test.name,
    said: test.said,
    expectedCounts: test.expectedCounts,
    ...result,
    check: checkRecognition(test, result),
  };
});

const correctionResults = await runSequentially(revisionCases, async (test) => {
  const result = await revise(test.input);
  return {
    name: test.name,
    note: test.input.note,
    expectedCounts: test.expectedCounts,
    ...result,
    check: checkRevision(test, result),
  };
});

const results = {
  model: env.RECOGNITION_MODEL,
  recognition: recognitionResults,
  correction: correctionResults,
  passed: [...recognitionResults, ...correctionResults].every((result) => result.check.pass),
};

console.log(JSON.stringify(results, null, 2));
if (!results.passed) process.exitCode = 1;
