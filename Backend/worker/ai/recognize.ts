import type { Env } from "../env";
import { requestOrcaRecognition } from "./orca";
import { productionSpec, type RecognitionSpec } from "./spec";
import type { ProviderInput, ProviderRecognition } from "./types";

export function modelFor(env: Env): string {
  return env.RECOGNITION_MODEL;
}

export function apiKeyFor(env: Env): string | undefined {
  return env.ORCA_API_KEY;
}

export function requestMealRecognition(
  env: Env,
  input: ProviderInput,
  spec: RecognitionSpec = productionSpec(input),
): Promise<ProviderRecognition> {
  return requestOrcaRecognition(env, input, spec);
}
