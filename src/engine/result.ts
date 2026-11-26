export interface EngineError {
  message: string;
  line: number | null;
}

export type Result<T, E = EngineError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = (message: string, line?: number | null): Result<never, EngineError> => ({
  ok: false,
  error: { message, line: line ?? null },
});
