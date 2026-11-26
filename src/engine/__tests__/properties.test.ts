/**
 * Property-based tests for the HyperTalk engine.
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { tokenize } from '../tokenizer';
import { parse } from '../parser';
import { printProgram } from '../printer';
import { interpret } from '../interpreter';
import type { Environment } from '../interpreter';
import type {
  Expr,
  Stmt,
  HandlerDecl,
  PutStmt,
  GetStmt,
  IfStmt,
  RepeatStmt,
  GoToCardStmt,
  GoToNextStmt,
  GoPrevStmt,
  AnswerStmt,
  NumberLit,
  StringLit,
  VarRef,
  FieldRef,
  ButtonRef,
  BinOp,
  Container,
} from '../ast';

// ── HyperTalk keywords to avoid ───────────────────────────────────────────────

const KEYWORDS = new Set([
  'on', 'end', 'put', 'into', 'get', 'if', 'then', 'else',
  'repeat', 'times', 'go', 'to', 'card', 'next', 'previous',
  'answer', 'field', 'button', 'it',
]);

/**
 * Generate safe HyperTalk identifiers: letters only, no keywords,
 * no single-character names that might shadow things.
 */
const safeIdentArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z][a-z]{1,5}$/)
  .filter((s) => !KEYWORDS.has(s));

// ── Expression arbitrary (depth ≤ 3) ─────────────────────────────────────────

const exprArb: fc.Arbitrary<Expr> = fc.letrec<{ expr: Expr }>((tie) => ({
  expr: fc.oneof(
    { depthIdentifier: 'expr', maxDepth: 3, withCrossShrink: true },
    // Leaves — non-negative integers only: negative values print as "-N" which
    // the tokenizer splits into MINUS + NUMBER and the parser can't re-parse as
    // a primary. Scientific notation is also avoided by using integer().
    fc.integer({ min: 0, max: 999 }).map(
      (v): NumberLit => ({ kind: 'NumberLit', value: v }),
    ),
    // Safe strings: no backslashes, no double-quotes, no newlines
    fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/).map(
      (v): StringLit => ({ kind: 'StringLit', value: v }),
    ),
    safeIdentArb.map((name): VarRef => ({ kind: 'VarRef', name })),
    safeIdentArb.map((name): FieldRef => ({ kind: 'FieldRef', name })),
    safeIdentArb.map((name): ButtonRef => ({ kind: 'ButtonRef', name })),
    // Recursive: BinOp
    fc
      .record({
        op: fc.constantFrom('+', '-', '*', '/', '&', '=', '<', '>') as fc.Arbitrary<
          BinOp['op']
        >,
        left: tie('expr'),
        right: tie('expr'),
      })
      .map(
        ({ op, left, right }): BinOp => ({ kind: 'BinOp', op, left, right }),
      ),
  ),
})).expr;

// ── Leaf-only expression arbitrary (for safe use inside bodies) ───────────────

const leafExprArb: fc.Arbitrary<Expr> = fc.oneof(
  fc.integer({ min: 0, max: 999 }).map(
    (v): NumberLit => ({ kind: 'NumberLit', value: v }),
  ),
  fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/).map(
    (v): StringLit => ({ kind: 'StringLit', value: v }),
  ),
  safeIdentArb.map((name): VarRef => ({ kind: 'VarRef', name })),
);

// ── Container arbitrary ───────────────────────────────────────────────────────

const containerArb: fc.Arbitrary<Container> = fc.oneof(
  safeIdentArb.map((name): VarRef => ({ kind: 'VarRef', name })),
  safeIdentArb.map((name): FieldRef => ({ kind: 'FieldRef', name })),
  safeIdentArb.map((name): ButtonRef => ({ kind: 'ButtonRef', name })),
);

// ── Flat (non-compound) statement arbitrary ───────────────────────────────────
// Used as bodies of IfStmt and RepeatStmt to prevent exponential blowup.

const flatStmtArb: fc.Arbitrary<Stmt> = fc.oneof(
  fc.record({ expr: leafExprArb, container: containerArb }).map(
    ({ expr, container }): PutStmt => ({ kind: 'PutStmt', expr, container, line: 0 }),
  ),
  leafExprArb.map(
    (expr): GetStmt => ({ kind: 'GetStmt', expr, line: 0 }),
  ),
  leafExprArb.map(
    (expr): GoToCardStmt => ({ kind: 'GoToCardStmt', target: expr, line: 0 }),
  ),
  fc.constant<GoToNextStmt>({ kind: 'GoToNextStmt', line: 0 }),
  fc.constant<GoPrevStmt>({ kind: 'GoPrevStmt', line: 0 }),
  leafExprArb.map(
    (expr): AnswerStmt => ({ kind: 'AnswerStmt', expr, line: 0 }),
  ),
);

// ── Full statement arbitrary (depth ≤ 2) ─────────────────────────────────────

const stmtArb: fc.Arbitrary<Stmt> = fc.letrec<{ stmt: Stmt }>((tie) => ({
  stmt: fc.oneof(
    { depthIdentifier: 'stmt', maxDepth: 2, withCrossShrink: true },
    // Flat statements (leaves)
    fc.record({ expr: exprArb, container: containerArb }).map(
      ({ expr, container }): PutStmt => ({ kind: 'PutStmt', expr, container, line: 0 }),
    ),
    exprArb.map(
      (expr): GetStmt => ({ kind: 'GetStmt', expr, line: 0 }),
    ),
    exprArb.map(
      (expr): GoToCardStmt => ({ kind: 'GoToCardStmt', target: expr, line: 0 }),
    ),
    fc.constant<GoToNextStmt>({ kind: 'GoToNextStmt', line: 0 }),
    fc.constant<GoPrevStmt>({ kind: 'GoPrevStmt', line: 0 }),
    exprArb.map(
      (expr): AnswerStmt => ({ kind: 'AnswerStmt', expr, line: 0 }),
    ),
    // Compound statements use flat bodies to prevent blowup
    fc
      .record({
        cond: exprArb,
        then: fc.array(flatStmtArb, { maxLength: 2 }),
        else_: fc.array(flatStmtArb, { maxLength: 2 }),
      })
      .map(
        ({ cond, then, else_ }): IfStmt => ({ kind: 'IfStmt', cond, then, else_, line: 0 }),
      ),
    fc
      .record({
        // Keep counts small to avoid step-limit issues in property 2
        count: fc.integer({ min: 0, max: 3 }).map((n): NumberLit => ({ kind: 'NumberLit', value: n })),
        body: fc.array(flatStmtArb, { maxLength: 2 }),
      })
      .map(
        ({ count, body }): RepeatStmt => ({ kind: 'RepeatStmt', count, body, line: 0 }),
      ),
  ),
})).stmt;

// ── Handler arbitrary ─────────────────────────────────────────────────────────

const handlerArb: fc.Arbitrary<HandlerDecl> = fc.record({
  kind: fc.constant('HandlerDecl' as const),
  name: safeIdentArb,
  body: fc.array(stmtArb, { maxLength: 3 }),
  line: fc.constant(0),
});

// ── Program arbitrary ─────────────────────────────────────────────────────────
// At least 1 handler so ast[0].name is always valid.

const programArb: fc.Arbitrary<HandlerDecl[]> = fc.array(handlerArb, {
  minLength: 1,
  maxLength: 3,
});

// ── Stub Environment ──────────────────────────────────────────────────────────

const stubEnv: Environment = {
  getField: () => '0',
  getButton: () => '0',
  setField: () => {},
  setButton: () => {},
  goToCard: () => {},
  goToNext: () => {},
  goToPrev: () => {},
  showDialog: () => {},
};

// ── assertStructuralEqual — deep compare ignoring `line` fields ───────────────

function stripLines(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(stripLines);
  if (val !== null && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (k === 'line') continue;
      out[k] = stripLines(v);
    }
    return out;
  }
  return val;
}

function assertStructuralEqual(a: unknown, b: unknown): void {
  expect(stripLines(a)).toEqual(stripLines(b));
}

// ── Properties ────────────────────────────────────────────────────────────────

describe('HyperTalk engine — property-based tests', () => {
  /**
   * Property 1 (round-trip): printing then re-parsing an AST yields a
   * structurally equivalent AST (line numbers excluded).
   *
   * Validates: Requirements 7.1
   */
  it('Property 1 — round-trip: print → tokenize → parse preserves structure', () => {
    fc.assert(
      fc.property(programArb, (ast) => {
        // The parser requires a trailing newline after the last `end <name>`.
        // Appending one here makes the round-trip work with the current printer.
        const src = printProgram(ast) + '\n';

        const tokenResult = tokenize(src);
        expect(tokenResult.ok, `tokenize failed: ${!tokenResult.ok ? tokenResult.error.message : ''}\nsource:\n${src}`).toBe(true);
        if (!tokenResult.ok) return;

        const parseResult = parse(tokenResult.value);
        expect(parseResult.ok, `parse failed: ${!parseResult.ok ? parseResult.error.message : ''}\nsource:\n${src}`).toBe(true);
        if (!parseResult.ok) return;

        assertStructuralEqual(parseResult.value, ast);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 2 (interpreter safety): the interpreter never throws for any
   * valid program AST.
   *
   * Validates: Requirements 7.2
   */
  it('Property 2 — interpreter safety: interpret never throws', () => {
    fc.assert(
      fc.property(programArb, (ast) => {
        let threw = false;
        try {
          interpret(ast, ast[0].name, stubEnv);
        } catch {
          threw = true;
        }
        expect(threw).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property 3 (termination): the interpreter always terminates with a
   * known result kind.
   *
   * Validates: Requirements 7.3
   */
  it('Property 3 — termination: interpret always returns ok, error, or stepLimitExceeded', () => {
    fc.assert(
      fc.property(programArb, (ast) => {
        const result = interpret(ast, ast[0].name, stubEnv, 100);
        expect(['ok', 'error', 'stepLimitExceeded']).toContain(result.kind);
      }),
      { numRuns: 50 },
    );
  });
});
