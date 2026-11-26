# Design — HyperTalk Engine

## 1. Module Layout

```
src/engine/
  index.ts           # public barrel — re-exports all public types and functions
  tokenizer.ts       # Tokenizer: string → Token[]
  parser.ts          # Parser: Token[] → AST
  ast.ts             # AST node interfaces
  printer.ts         # Pretty-printer: AST → string
  interpreter.ts     # Interpreter: AST + Env → Result
  result.ts          # Result<T,E> type and helpers
  __tests__/
    tokenizer.test.ts
    parser.test.ts
    printer.test.ts
    interpreter.test.ts
    properties.test.ts   # fast-check property tests
```

---

## 2. Type Definitions

### 2.1 Result type (`result.ts`)

```ts
export type Result<T, E = EngineError> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export interface EngineError {
  message: string;
  line: number | null;
}

export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = (message: string, line: number | null = null): Result<never, EngineError> =>
  ({ ok: false, error: { message, line } });
```

### 2.2 Tokens (`tokenizer.ts`)

```ts
export type TokenKind =
  | 'NUMBER' | 'STRING' | 'IDENT'
  | 'ON' | 'END' | 'PUT' | 'INTO' | 'GET'
  | 'IF' | 'THEN' | 'ELSE'
  | 'REPEAT' | 'TIMES'
  | 'GO' | 'TO' | 'CARD' | 'NEXT' | 'PREVIOUS'
  | 'ANSWER' | 'FIELD' | 'BUTTON'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'AMP'
  | 'EQ' | 'LT' | 'GT'
  | 'LPAREN' | 'RPAREN'
  | 'NEWLINE' | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;   // raw lexeme
  line: number;
}
```

`NEWLINE` tokens act as statement terminators; the parser consumes them explicitly rather than relying on semicolons.

### 2.3 AST (`ast.ts`)

All nodes are plain interfaces discriminated by `kind`.

**Statements**

```ts
export type Stmt =
  | HandlerDecl | PutStmt | GetStmt | IfStmt
  | RepeatStmt | GoToCardStmt | GoToNextStmt | GoPrevStmt
  | AnswerStmt;

export interface HandlerDecl { kind: 'HandlerDecl'; name: string; body: Stmt[]; line: number }
export interface PutStmt     { kind: 'PutStmt';     expr: Expr; container: Container; line: number }
export interface GetStmt     { kind: 'GetStmt';     expr: Expr; line: number }
export interface IfStmt      { kind: 'IfStmt';      cond: Expr; then: Stmt[]; else_: Stmt[]; line: number }
export interface RepeatStmt  { kind: 'RepeatStmt';  count: Expr; body: Stmt[]; line: number }
export interface GoToCardStmt{ kind: 'GoToCardStmt';target: Expr; line: number }
export interface GoToNextStmt{ kind: 'GoToNextStmt';line: number }
export interface GoPrevStmt  { kind: 'GoPrevStmt';  line: number }
export interface AnswerStmt  { kind: 'AnswerStmt';  expr: Expr; line: number }
```

**Expressions**

```ts
export type Expr =
  | NumberLit | StringLit | VarRef | FieldRef | ButtonRef | BinOp;

export interface NumberLit { kind: 'NumberLit'; value: number }
export interface StringLit { kind: 'StringLit'; value: string }
export interface VarRef    { kind: 'VarRef';    name: string }
export interface FieldRef  { kind: 'FieldRef';  name: string }
export interface ButtonRef { kind: 'ButtonRef'; name: string }
export interface BinOp     { kind: 'BinOp';     op: '+' | '-' | '*' | '/' | '&' | '=' | '<' | '>'; left: Expr; right: Expr }
```

**Container** (assignment targets)

```ts
export type Container = VarRef | FieldRef | ButtonRef;
```

---

## 3. Component Design

### 3.1 Tokenizer

A single-pass scanner walks the source string character by character, tracking `line`. Keywords are recognised by looking up completed identifiers in a static map; everything else is matched by character class. The tokenizer returns `Result<Token[], EngineError>`.

### 3.2 Parser

A recursive-descent parser over the token list. A `Parser` class holds a cursor index. Key methods:

- `parseProgram()` → `HandlerDecl[]`
- `parseStmt()` → `Stmt`
- `parseExpr()` → `Expr` (uses Pratt / precedence-climbing for binary operators)
- `parseContainer()` → `Container`

Statements are newline-terminated. The parser skips blank `NEWLINE` tokens between statements. On a parse error it returns `Result<..., EngineError>` immediately (no error recovery).

**Precedence table**

| Level | Operators |
|-------|-----------|
| 3 (high) | `*` `/` |
| 2 | `+` `-` `&` |
| 1 (low) | `=` `<` `>` |

### 3.3 Pretty-Printer

A set of pure functions, one per node kind, that return strings. Block bodies are indented by passing a `depth` parameter. The printer never reads environment state.

```
printStmt(stmt, depth) → string
printExpr(expr) → string
```

String literals are re-quoted with `"` and internal `"` characters escaped as `\"`.

### 3.4 Interpreter

An `Interpreter` class holds:

- `steps: number` — incremented on every statement executed.
- `stepLimit: number` — configurable, default 10 000.
- `env: Environment` — the host-supplied callbacks and card state.
- `locals: Map<string, string>` — current handler's variables (all values are strings internally).

Execution is synchronous. Each `execStmt` call increments `steps` and checks the limit before proceeding.

```ts
export interface Environment {
  getField:   (name: string) => string;
  setField:   (name: string, value: string) => void;
  getButton:  (name: string) => string;
  setButton:  (name: string, value: string) => void;
  goToCard:   (target: number | string) => void;
  goToNext:   () => void;
  goToPrev:   () => void;
  showDialog: (message: string) => void;
}

export interface InterpreterResult {
  kind: 'ok' | 'error' | 'stepLimitExceeded';
  error?: EngineError;
}
```

All values are represented as strings internally (matching HyperCard's approach). Arithmetic coerces with `parseFloat`; non-numeric values in arithmetic produce a runtime error.

---

## 4. Data Flow

```
source string
    │
    ▼
 Tokenizer  →  Result<Token[]>
    │
    ▼
  Parser    →  Result<HandlerDecl[]>
    │                     │
    ▼                     ▼
Interpreter           Printer
    │                     │
    ▼                     ▼
InterpreterResult    string (source)
```

---

## 5. Property-Based Test Strategy

Three fast-check properties, all in `properties.test.ts`:

1. **Round-trip**: Generate arbitrary valid ASTs via fast-check `Arbitrary<HandlerDecl[]>`. Assert `parse(print(ast)).value` deep-equals `ast` (ignoring `line` fields set to 0 by the printer).

2. **Interpreter safety**: Generate arbitrary valid programs and a stub `Environment`. Run the interpreter. Assert the result is never a thrown exception — only `ok`, `error`, or `stepLimitExceeded`.

3. **Termination**: Same as above but with `stepLimit = 100`. Assert the interpreter always returns within the step limit (no infinite loop possible).

Arbitraries are built recursively with `fc.letrec` for expressions and statements, with depth limited to prevent stack overflow during generation.
