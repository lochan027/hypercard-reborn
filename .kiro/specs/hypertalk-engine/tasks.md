# Implementation Plan: HyperTalk Engine

## Overview

This plan covers building the HyperTalk scripting engine from scratch: a tokenizer, parser, AST types, pretty-printer, and interpreter, plus unit and property-based tests for each layer. The engine lives entirely in `src/engine` with zero React or DOM dependencies.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 1, "tasks": ["1"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["3", "5", "6"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["7", "8", "9", "10"] },
    { "id": 6, "tasks": ["11"] }
  ]
}
```

## Tasks

- [x] 1. Result type and EngineError

  Satisfies: REQ 5.1, 5.2, 6.4

  - Create `src/engine/result.ts`.
  - Define and export `type Result<T, E = EngineError> = { ok: true; value: T } | { ok: false; error: E }`.
  - Define and export `interface EngineError { message: string; line: number | null }`.
  - Implement and export `ok<T>(value: T): Result<T, never>` arrow function.
  - Implement and export `err(message: string, line?: number | null): Result<never, EngineError>` arrow function.
  - Create `src/engine/index.ts` barrel file; add re-exports for `Result`, `EngineError`, `ok`, `err` from `./result`.

- [x] 2. AST node interfaces

  Satisfies: REQ 2.3–2.20, 6.4

  - Create `src/engine/ast.ts` (types only, no runtime code).
  - Define and export `type Stmt` as the discriminated union of: `HandlerDecl | PutStmt | GetStmt | IfStmt | RepeatStmt | GoToCardStmt | GoToNextStmt | GoPrevStmt | AnswerStmt`.
  - Define and export each statement interface with a `kind` string-literal field and the fields specified in the design: `HandlerDecl` (`name: string; body: Stmt[]; line: number`), `PutStmt` (`expr: Expr; container: Container; line: number`), `GetStmt` (`expr: Expr; line: number`), `IfStmt` (`cond: Expr; then: Stmt[]; else_: Stmt[]; line: number`), `RepeatStmt` (`count: Expr; body: Stmt[]; line: number`), `GoToCardStmt` (`target: Expr; line: number`), `GoToNextStmt` (`line: number`), `GoPrevStmt` (`line: number`), `AnswerStmt` (`expr: Expr; line: number`).
  - Define and export `type Expr` as the union: `NumberLit | StringLit | VarRef | FieldRef | ButtonRef | BinOp`.
  - Define and export each expression interface: `NumberLit` (`kind: 'NumberLit'; value: number`), `StringLit` (`kind: 'StringLit'; value: string`), `VarRef` (`kind: 'VarRef'; name: string`), `FieldRef` (`kind: 'FieldRef'; name: string`), `ButtonRef` (`kind: 'ButtonRef'; name: string`), `BinOp` (`kind: 'BinOp'; op: '+' | '-' | '*' | '/' | '&' | '=' | '<' | '>'; left: Expr; right: Expr`).
  - Define and export `type Container = VarRef | FieldRef | ButtonRef`.
  - Add re-exports for all types from `./ast` in `src/engine/index.ts`.

- [x] 3. Tokenizer implementation

  Satisfies: REQ 1.1–1.10, 6.1, 6.2, 6.3

  - Create `src/engine/tokenizer.ts`.
  - Define and export the `TokenKind` union type covering all variants: `'NUMBER' | 'STRING' | 'IDENT' | 'ON' | 'END' | 'PUT' | 'INTO' | 'GET' | 'IF' | 'THEN' | 'ELSE' | 'REPEAT' | 'TIMES' | 'GO' | 'TO' | 'CARD' | 'NEXT' | 'PREVIOUS' | 'ANSWER' | 'FIELD' | 'BUTTON' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'AMP' | 'EQ' | 'LT' | 'GT' | 'LPAREN' | 'RPAREN' | 'NEWLINE' | 'EOF'`.
  - Define and export `interface Token { kind: TokenKind; value: string; line: number }`.
  - Implement and export `function tokenize(source: string): Result<Token[], EngineError>`.
  - Inside `tokenize`: walk `source` character by character, incrementing a `line` counter on each `\n`; build a `Token[]`.
  - Recognise and skip whitespace (spaces, tabs) without emitting a token.
  - Emit a `NEWLINE` token for each newline character (after incrementing `line`).
  - Recognise `--` as the start of a line comment; advance the cursor to end-of-line and emit no token.
  - Recognise double-quoted strings: scan until closing `"`, handle `\"` and `\\` escape sequences, emit `STRING` token with the unescaped value.
  - Recognise integer and decimal numeric literals (`[0-9]+(\.[0-9]+)?`), emit `NUMBER` token.
  - Recognise identifiers (`[a-zA-Z_][a-zA-Z0-9_]*`); look up the completed lexeme in a static keyword map (`on`, `end`, `put`, `into`, `get`, `if`, `then`, `else`, `repeat`, `times`, `go`, `to`, `card`, `next`, `previous`, `answer`, `field`, `button`) and emit the corresponding keyword `TokenKind`, or `IDENT` if not found.
  - Recognise single-character operators `+`, `-`, `*`, `/`, `&`, `=`, `<`, `>` and punctuation `(`, `)`, each emitting the corresponding token kind.
  - For any unrecognised character, return `err(...)` with the line number and the offending character; do not throw.
  - Append an `EOF` token at the end of the token list.
  - Add re-export for `tokenize`, `Token`, `TokenKind` in `src/engine/index.ts`.

- [x] 4. Parser implementation

  Satisfies: REQ 2.1–2.20, 6.1, 6.2, 6.3

  - Create `src/engine/parser.ts`.
  - Implement a `Parser` class with fields: `tokens: Token[]`, `pos: number`.
  - Add private helper methods: `peek()` returns the token at `pos`, `advance()` returns the token at `pos` and increments `pos`, `check(kind)` returns `true` if `peek().kind === kind`, `expect(kind)` returns `Result<Token, EngineError>` (advances if match, returns `err` with the token's line number if mismatch), `skipNewlines()` advances past any `NEWLINE` tokens.
  - Implement `parseProgram(): Result<HandlerDecl[], EngineError>`: skip newlines, loop calling `parseHandler()` until `EOF`, collect results.
  - Implement `parseHandler(): Result<HandlerDecl, EngineError>`: expect `ON`, then `IDENT` (handler name), then `NEWLINE`, then loop `parseStmt()` until `END`, expect `END` + matching `IDENT` + `NEWLINE`.
  - Implement `parseStmt(): Result<Stmt, EngineError>`: dispatch on the current token kind to `parsePut`, `parseGet`, `parseIf`, `parseRepeat`, `parseGo`, `parseAnswer`; return `err` for unrecognised tokens.
  - Implement `parsePut()`: expect `PUT`, call `parseExpr()`, expect `INTO`, call `parseContainer()`, expect `NEWLINE`.
  - Implement `parseGet()`: expect `GET`, call `parseExpr()`, expect `NEWLINE`.
  - Implement `parseIf()`: expect `IF`, call `parseExpr()`, expect `THEN`, expect `NEWLINE`, parse `then` body until `ELSE` or `END`; if `ELSE` parse `else` body until `END`; expect `END IF` + `NEWLINE`.
  - Implement `parseRepeat()`: expect `REPEAT`, call `parseExpr()`, expect `TIMES`, expect `NEWLINE`, parse body until `END`, expect `END REPEAT` + `NEWLINE`.
  - Implement `parseGo()`: expect `GO`, expect `TO`; if next is `NEXT` emit `GoToNextStmt`; if `PREVIOUS` emit `GoPrevStmt`; otherwise expect `CARD`, call `parseExpr()`, emit `GoToCardStmt`.
  - Implement `parseAnswer()`: expect `ANSWER`, call `parseExpr()`, expect `NEWLINE`.
  - Implement `parseContainer(): Result<Container, EngineError>`: handle `FIELD STRING`, `BUTTON STRING`, or bare `IDENT`.
  - Implement `parseExpr()` using precedence-climbing: level 1 (`=`, `<`, `>`), level 2 (`+`, `-`, `&`), level 3 (`*`, `/`); each level calls the next higher level for its left operand and loops on matching operators; handle `(expr)` grouped expressions and primary atoms (`NUMBER`, `STRING`, `IDENT`, `FIELD STRING`, `BUTTON STRING`).
  - Implement and export `function parse(tokens: Token[]): Result<HandlerDecl[], EngineError>` that constructs a `Parser` and calls `parseProgram()`.
  - Add re-export for `parse` and `HandlerDecl` in `src/engine/index.ts`.

- [x] 5. Pretty-printer implementation

  Satisfies: REQ 3.1–3.4, 6.1, 6.2, 6.3

  - Create `src/engine/printer.ts`.
  - Implement and export `function printExpr(expr: Expr): string`: switch on `expr.kind`; `NumberLit` → `String(expr.value)`; `StringLit` → `'"' + expr.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'`; `VarRef` → `expr.name`; `FieldRef` → `` `field "${expr.name}"` ``; `ButtonRef` → `` `button "${expr.name}"` ``; `BinOp` → `` `${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)}` ``.
  - Implement and export `function printStmt(stmt: Stmt, depth: number): string`: produce a correctly indented string (each level = 2 spaces); switch on `stmt.kind` and format each statement form; for `HandlerDecl` output `on <name>\n<body>\nend <name>`; for `PutStmt` output `put <expr> into <container>`; for `GetStmt` output `get <expr>`; for `IfStmt` output `if <cond> then\n<then-body>\n[else\n<else-body>\n]end if`; for `RepeatStmt` output `repeat <count> times\n<body>\nend repeat`; for `GoToCardStmt` output `go to card <expr>`; for `GoToNextStmt` output `go to next card`; for `GoPrevStmt` output `go to previous card`; for `AnswerStmt` output `answer <expr>`; recurse on body arrays passing `depth + 1`.
  - Implement and export `function printProgram(handlers: HandlerDecl[]): string`: join `printStmt(h, 0)` for each handler with `\n\n`.
  - Add re-exports for `printExpr`, `printStmt`, `printProgram` in `src/engine/index.ts`.

- [x] 6. Interpreter implementation

  Satisfies: REQ 4.1–4.14, 6.1, 6.2, 6.3

  - Create `src/engine/interpreter.ts`.
  - Define and export `interface Environment { getField(name: string): string; setField(name: string, value: string): void; getButton(name: string): string; setButton(name: string, value: string): void; goToCard(target: number | string): void; goToNext(): void; goToPrev(): void; showDialog(message: string): void }`.
  - Define and export `type InterpreterResult = { kind: 'ok' } | { kind: 'error'; error: EngineError } | { kind: 'stepLimitExceeded'; error: EngineError }`.
  - Implement `class Interpreter` with constructor accepting `env: Environment` and optional `stepLimit: number` (default `10000`); fields: `private steps = 0`, `private locals = new Map<string, string>()`, `private it = ''`.
  - Implement `private checkLimit(line: number | null): InterpreterResult | null`: increment `this.steps`; if `this.steps > this.stepLimit` return `{ kind: 'stepLimitExceeded', error: { message: 'Step limit exceeded', line } }`; otherwise return `null`.
  - Implement `private evalExpr(expr: Expr): Result<string, EngineError>`: switch on `expr.kind`; `NumberLit` → return string of value; `StringLit` → return value; `VarRef` → return `this.locals.get(expr.name) ?? ''`; `FieldRef` → call `this.env.getField(expr.name)`; `ButtonRef` → call `this.env.getButton(expr.name)`; `BinOp` → recursively eval both sides, then apply the operator (use `parseFloat` for numeric ops; return `err` on `NaN` or division by zero; `&` concatenates strings; `=`, `<`, `>` return `'true'` or `'false'`).
  - Implement `private execStmt(stmt: Stmt): InterpreterResult`: call `checkLimit`; switch on `stmt.kind` and execute each form: `PutStmt` evals expr, writes to container (`locals`, `setField`, or `setButton`); `GetStmt` evals expr, stores result in `this.locals.set('it', value)`; `IfStmt` evals cond, executes `then` or `else_` branch; `RepeatStmt` evals count with `Math.floor(parseFloat(...))`, loops that many times calling `execStmt` on each body statement (checking limit each iteration); `GoToCardStmt` evals target, calls `this.env.goToCard`; `GoToNextStmt` calls `this.env.goToNext()`; `GoPrevStmt` calls `this.env.goToPrev()`; `AnswerStmt` evals expr, calls `this.env.showDialog`; return `{ kind: 'ok' }` on success.
  - Implement `run(handlers: HandlerDecl[], handlerName: string): InterpreterResult`: reset `this.steps` and `this.locals`; find the handler by name; if not found return `{ kind: 'error', error: { message: \`Handler '${handlerName}' not defined\`, line: null } }`; iterate body statements calling `execStmt`, propagating non-ok results immediately; return `{ kind: 'ok' }`.
  - Implement and export `function interpret(handlers: HandlerDecl[], handlerName: string, env: Environment, stepLimit?: number): InterpreterResult` that constructs an `Interpreter` and calls `run`.
  - Add re-exports for `interpret`, `Environment`, `InterpreterResult` in `src/engine/index.ts`.

- [x] 7. Tokenizer unit tests

  Satisfies: REQ 7.4, 7.5

  - Create `src/engine/__tests__/tokenizer.test.ts` using Vitest (`import { describe, it, expect } from 'vitest'`).
  - Write one test per `TokenKind` variant asserting that the correct `kind` and `value` are emitted: `NUMBER` (integer and decimal), `STRING` (plain and with `\"` and `\\` escapes), `IDENT`, each of the 17 keyword kinds, each of the 8 operator kinds, `LPAREN`, `RPAREN`, `NEWLINE`.
  - Write a test that a `--` comment produces no tokens (only `NEWLINE` and `EOF`).
  - Write a test that tokenizing an unrecognised character returns `ok: false` with a non-null `line` field and a message containing the offending character.
  - Write a test that all tokens carry the correct `line` number when input spans multiple lines.
  - Write a test that an empty string produces only an `EOF` token.

- [x] 8. Parser unit tests

  Satisfies: REQ 7.4, 7.5

  - Create `src/engine/__tests__/parser.test.ts`.
  - For each statement form (`HandlerDecl`, `PutStmt`, `GetStmt`, `IfStmt` with and without `else`, `RepeatStmt`, `GoToCardStmt`, `GoToNextStmt`, `GoPrevStmt`, `AnswerStmt`): tokenize a minimal source string, parse it, assert the result is `ok: true`, and assert the top-level `kind` and key fields match expected values.
  - Write tests for each primary expression type: `NumberLit`, `StringLit`, `VarRef`, `FieldRef`, `ButtonRef`.
  - Write tests for `BinOp` with each operator (`+`, `-`, `*`, `/`, `&`, `=`, `<`, `>`), asserting the correct `op` field.
  - Write a test verifying precedence: parse `1 + 2 * 3` and assert the `BinOp` tree has `*` as the right-hand child of `+`.
  - Write a test for a grouped expression `(1 + 2)`.
  - Write a test for a malformed input (e.g. missing `end`) asserting `ok: false` with a numeric `line` field.
  - Write a test verifying the parser never throws on any malformed input (wrap in `try/catch` and fail if caught).

- [x] 9. Pretty-printer unit tests

  Satisfies: REQ 7.4, 7.5

  - Create `src/engine/__tests__/printer.test.ts`.
  - For each statement kind, construct the AST node directly (no parsing), call `printStmt(node, 0)`, and assert the output string matches the expected HyperTalk source exactly.
  - Write a test for `printExpr` on each expression kind: `NumberLit`, `StringLit` (including one with a double-quote in the value), `VarRef`, `FieldRef`, `ButtonRef`, `BinOp`.
  - Write a test that nested `IfStmt` and `RepeatStmt` bodies are indented by 2 additional spaces per level.
  - Write a test for `printProgram` on a two-handler array and assert the handlers are separated by a blank line.
  - Write a test verifying `printStmt` does not throw on any valid node (call it for each statement kind with depth 0).

- [x] 10. Interpreter unit tests

  Satisfies: REQ 7.4, 7.5

  - Create `src/engine/__tests__/interpreter.test.ts`.
  - Build a stub `Environment` object with jest-style tracking using `vi.fn()` for all 8 callbacks.
  - For each statement kind, build a minimal `HandlerDecl[]` AST directly, call `interpret`, and assert the result `kind` is `'ok'` and that the expected environment callback was called (or the expected local variable was set via a `get` + read-back).
  - Write a test for `PutStmt` targeting a `VarRef` container: verify subsequent `GetStmt` on the same var returns the written value via `it`.
  - Write a test for each `BinOp` operator: `+`, `-`, `*`, `/` (numeric), `&` (string concat), `=`, `<`, `>` (returning `'true'`/`'false'`).
  - Write a test for division by zero: assert result `kind` is `'error'` with a non-empty message.
  - Write a test for a handler name that does not exist in the AST: assert `kind` is `'error'`.
  - Write a test for `stepLimitExceeded`: create a `RepeatStmt` with a very large count and `stepLimit: 10`; assert result `kind` is `'stepLimitExceeded'`.
  - Write a test verifying `interpret` does not throw on any valid input (wrap in `try/catch` and fail if caught).

- [x] 11. Property-based tests

  Satisfies: REQ 7.1, 7.2, 7.3

  - Create `src/engine/__tests__/properties.test.ts`.
  - Build `fc.Arbitrary<Expr>` using `fc.letrec` with a maximum depth of 3; generate `NumberLit`, `StringLit`, `VarRef`, `FieldRef`, `ButtonRef`, and `BinOp` nodes; `BinOp` picks a random operator from the 8 valid values and uses the recursive `Expr` arbitrary for both operands.
  - Build `fc.Arbitrary<Stmt>` using `fc.letrec` with max depth 2; generate all statement kinds; `IfStmt` and `RepeatStmt` bodies are arrays of non-compound statements to prevent exponential blowup.
  - Build `fc.Arbitrary<HandlerDecl[]>` as `fc.array(fc.record({ kind: fc.constant('HandlerDecl'), name: fc.identifier(), body: stmtArb, line: fc.constant(0) }), { minLength: 1, maxLength: 3 })`.
  - **Property 1 (round-trip)**: `fc.assert(fc.property(programArb, (ast) => { const src = printProgram(ast); const result = parse(tokenize(src).value!); expect(result.ok).toBe(true); assertStructuralEqual(result.value, ast); }))` where `assertStructuralEqual` deep-compares ignoring `line` fields.
  - **Property 2 (interpreter safety)**: `fc.assert(fc.property(programArb, (ast) => { let threw = false; try { interpret(ast, ast[0].name, stubEnv); } catch { threw = true; } expect(threw).toBe(false); }))`.
  - **Property 3 (termination)**: `fc.assert(fc.property(programArb, (ast) => { const result = interpret(ast, ast[0].name, stubEnv, 100); expect(['ok', 'error', 'stepLimitExceeded']).toContain(result.kind); }))`.

## Notes

- All engine files must have zero React or DOM imports — the engine is framework-agnostic by design.
- Tasks 1 and 2 have no dependencies and can be implemented first; tasks 3–6 build on them in parallel.
- Tests (tasks 7–11) should be written alongside their corresponding implementation tasks, not deferred to the end.
- The step limit in the interpreter is a hard safety guard against infinite loops from user scripts; keep it enforced in `checkLimit` and never bypass it.
- Property-based tests rely on fast-check (`fc`), which is already a dev dependency per the workspace rules (Vitest + fast-check).
