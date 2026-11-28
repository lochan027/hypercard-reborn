import type { Stack } from './stack-types';
import { err, type Result, type EngineError } from './result';
import { validateStack } from './stack-validate';

export function saveStack(stack: Stack): string {
  return JSON.stringify(stack);
}

export function loadStack(json: string): Result<Stack, EngineError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return err(`Invalid JSON: ${(e as Error).message}`);
  }
  return validateStack(parsed);
}
