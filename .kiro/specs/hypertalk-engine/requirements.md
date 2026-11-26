## Introduction

Implement a self-contained HyperTalk-style language engine in `src/engine`. The engine consists of four components: a tokenizer that converts source text into typed tokens, a parser that produces an AST, a pretty-printer that serializes AST nodes back to source, and an interpreter that executes handler declarations against a provided environment. No React or DOM imports are permitted anywhere in `src/engine`. All public functions return typed `Result` values rather than throwing, and the engine introduces no new runtime dependencies beyond the existing project toolchain.

## Requirements

### Requirement 1

**User Story:** As a HyperCard runtime, I want source text tokenized into a typed, line-annotated token list, so that the parser has structured input with enough metadata to report accurate error locations.

1. WHEN the tokenizer receives a source string THEN it shall return a flat list of typed tokens.
2. WHEN a token is produced THEN it shall carry its line number as 1-based metadata.
3. WHEN the tokenizer encounters any of the keywords `on`, `end`, `put`, `into`, `get`, `if`, `then`, `else`, `repeat`, `times`, `go`, `to`, `card`, `next`, `previous`, `answer` THEN it shall emit a keyword token of the corresponding type.
4. WHEN the tokenizer encounters a bare identifier (variable name, handler name, or card name) THEN it shall emit an identifier token.
5. WHEN the tokenizer encounters an integer or decimal numeric literal THEN it shall emit a number-literal token.
6. WHEN the tokenizer encounters a double-quoted string THEN it shall emit a string-literal token, recognising the escape sequences `\"` and `\\`.
7. WHEN the tokenizer encounters any of the operators `+`, `-`, `*`, `/`, `&`, `=`, `<`, `>` THEN it shall emit an operator token of the corresponding type.
8. WHEN the tokenizer encounters `(` or `)` THEN it shall emit a punctuation token of the corresponding type.
9. WHEN the tokenizer encounters whitespace or a single-line comment beginning with `--` THEN it shall skip those characters and produce no token.
10. WHEN the tokenizer encounters an unrecognised character THEN it shall return an error value that includes the line number and the offending character, and it shall not throw.

### Requirement 2

**User Story:** As a HyperCard runtime, I want source tokens parsed into a well-typed AST, so that the interpreter and pretty-printer have a structured, unambiguous representation of a HyperTalk script.

1. WHEN the parser receives a token list THEN it shall return either an AST or a structured error that includes the line number and a human-readable message.
2. WHEN the parser receives any input, including malformed input THEN it shall not throw an uncaught exception.
3. WHEN the parser encounters `on <message> <stmts> end <message>` THEN it shall produce a handler-declaration AST node.
4. WHEN the parser encounters `put <expr> into <container>` THEN it shall produce a put-statement AST node.
5. WHEN the parser encounters `get <expr>` THEN it shall produce a get-statement AST node.
6. WHEN the parser encounters `if <cond> then <stmts> [else <stmts>] end if` THEN it shall produce an if-statement AST node.
7. WHEN the parser encounters `repeat <expr> times <stmts> end repeat` THEN it shall produce a repeat-statement AST node.
8. WHEN the parser encounters `go to card <expr>` THEN it shall produce a go-to-card AST node carrying the target expression.
9. WHEN the parser encounters `go to next card` THEN it shall produce a go-to-next-card AST node.
10. WHEN the parser encounters `go to previous card` THEN it shall produce a go-to-previous-card AST node.
11. WHEN the parser encounters `answer <expr>` THEN it shall produce an answer-statement AST node.
12. WHEN the parser encounters an integer or decimal numeric literal THEN it shall produce a number-literal expression node.
13. WHEN the parser encounters a double-quoted string THEN it shall produce a string-literal expression node.
14. WHEN the parser encounters a bare identifier THEN it shall produce a variable-reference expression node.
15. WHEN the parser encounters `field "name"` THEN it shall produce a field-reference expression node.
16. WHEN the parser encounters `button "name"` THEN it shall produce a button-reference expression node.
17. WHEN the parser encounters `<expr> <op> <expr>` where op is one of `+ - * / & = < >` THEN it shall produce a binary-operation expression node.
18. WHEN the parser encounters `( <expr> )` THEN it shall produce a grouped-expression node.
19. WHEN resolving operator precedence THEN `*` and `/` shall bind tighter than `+`, `-`, and `&`, which shall bind tighter than `=`, `<`, and `>`.
20. WHEN any AST node type is defined THEN it shall be a plain TypeScript interface with no methods, using a field named `kind` as the type discriminant.

### Requirement 3

**User Story:** As a developer building a HyperCard script editor, I want any AST node serialized back to valid HyperTalk source, so that I can display, diff, and round-trip scripts without losing structural information.

1. WHEN the pretty-printer receives any AST node THEN it shall return a syntactically valid HyperTalk string.
2. WHEN `parse(print(ast))` is evaluated for any AST reachable from the parser THEN the result shall be structurally equal to the original `ast`, comparing only node types and semantic field values, and excluding position metadata such as line numbers.
3. WHEN the pretty-printer receives any valid AST node THEN it shall not throw.
4. WHEN the pretty-printer serializes nested statements THEN it shall indent each nesting level by two spaces.

### Requirement 4

**User Story:** As a HyperCard runtime, I want handler scripts executed against a live card environment, so that buttons and fields can read and write card state, navigate between cards, and display dialogs.

1. WHEN the interpreter receives an AST (a list of handler declarations) and an environment THEN it shall execute the named handler by name.
2. WHEN the interpreter executes any program THEN it shall count steps and enforce a configurable step limit with a default of 10 000; upon reaching the limit it shall return a runtime error value and shall not throw or loop infinitely.
3. WHEN the interpreter encounters any error during execution of a syntactically valid program THEN it shall return a typed error value and shall not throw an uncaught exception.
4. WHEN the interpreter creates or reads a variable THEN variable scope shall be handler-local, and variables shall be created on first assignment.
5. WHEN the interpreter executes `get <expr>` THEN it shall store the result in the implicit variable `it`.
6. WHEN the interpreter reads or writes `field "name"` THEN it shall do so via field-read and field-write callbacks supplied in the environment.
7. WHEN the interpreter reads or writes `button "name"` THEN it shall do so via button-read and button-write callbacks supplied in the environment.
8. WHEN the interpreter reads or writes a bare identifier THEN it shall treat it as a local variable.
9. WHEN the interpreter evaluates the `&` operator THEN it shall coerce both operands to strings and concatenate them.
10. WHEN the interpreter evaluates `+`, `-`, `*`, or `/` THEN it shall coerce both operands to numbers; division by zero shall return a runtime error value.
11. WHEN the interpreter evaluates `=`, `<`, or `>` THEN it shall return the string `"true"` or `"false"`.
12. WHEN the interpreter executes `go to card <expr>`, `go to next card`, or `go to previous card` THEN it shall invoke a navigation callback supplied in the environment and shall not manipulate any DOM or React state.
13. WHEN the interpreter executes `answer <expr>` THEN it shall invoke a dialog callback supplied in the environment.
14. WHEN the interpreter is asked to execute a handler name that is not defined in the AST THEN it shall return a runtime error value and shall not throw.

### Requirement 5

**User Story:** As a developer integrating the engine, I want all public functions to return typed Result values and all errors to carry location information, so that I can surface precise diagnostics to the user without try/catch.

1. WHEN any public engine function returns THEN it shall use a `Result<T, E>` type defined as the discriminated union `{ ok: true; value: T } | { ok: false; error: E }`.
2. WHEN an error value is produced THEN it shall carry a `line` field (a number, or `null` when no line is applicable) and a `message` string.

### Requirement 6

**User Story:** As a developer maintaining the engine, I want the engine to be isolated from browser APIs and free of dynamic code execution, so that it remains portable, auditable, and safe to run in any JavaScript environment.

1. WHEN any file under `src/engine` is compiled THEN it shall have zero imports from React, the DOM, or any browser API.
2. WHEN the engine executes a script THEN it shall not use `eval`, `Function()`, or any other form of dynamic code execution.
3. WHEN the engine is built THEN it shall introduce no new runtime dependencies beyond those already present in the project, relying only on TypeScript and the existing toolchain.
4. WHEN public API types are consumed THEN they shall all be importable from the single barrel file `src/engine/index.ts`.

### Requirement 7

**User Story:** As a developer maintaining the engine, I want a comprehensive automated test suite covering properties and units, so that regressions are caught immediately and the engine's correctness guarantees are machine-verified.

1. WHEN property-based tests run THEN they shall verify that `parse(print(ast))` equals `ast` for a generated corpus of valid ASTs, using fast-check.
2. WHEN property-based tests run THEN they shall verify that the interpreter never throws an uncaught exception on any generated valid program.
3. WHEN property-based tests run THEN they shall verify that the step limit causes the interpreter to return within finite time for any input.
4. WHEN unit tests run THEN they shall cover each tokenizer token type, each parser statement form, and each interpreter statement and operator.
5. WHEN tests are located THEN they shall live under `src/engine/__tests__/` and use Vitest as the test runner.
