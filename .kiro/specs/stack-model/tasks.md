# Implementation Plan: Stack Model

## Overview

Implement the stack data model and runtime in `src/engine/` using TypeScript strict mode. The implementation is split into five modules: types, validator, message dispatcher, runtime API, and serialiser. Each module is wired into `src/engine/index.ts` at the end. Property-based tests use fast-check and unit tests use Vitest.

## Tasks

- [x] 1. Define core data model types in `src/engine/stack-types.ts`
  - Create `Rect`, `BackgroundField`, `Background`, `Button`, `Field`, `Card`, `StackMetadata`, and `Stack` interfaces exactly as specified in the design.
  - Export `ButtonStyle` as `'default' | 'transparent' | 'checkbox' | 'radio'` for reuse.
  - No runtime code — types only.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 2. Implement the structural validator in `src/engine/stack-validate.ts`
  - [x] 2.1 Implement `validateRect`, `validateBackgroundField`, `validateBackground`, `validateButton`, `validateField`, `validateCard`, `validateMetadata`, and `validateStack`
    - Each validator takes `unknown`, type-narrows step by step, and returns `Result<T, EngineError>` using `ok`/`err` from `result.ts`.
    - `validateStack` checks: required fields, `currentCardIndex` bounds, and that every `card.backgroundId` resolves to a background id.
    - `validateRect` checks that all coordinates are finite integers and `w`/`h` ≥ 0.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.2 Write property test: validator rejects invalid Rect geometry
    - **Property 5: Validator rejects invalid Rect geometry**
    - Generate stack-shaped objects with at least one Rect containing negative `w`/`h` or non-integer coordinates. Assert `validateStack` returns `err`.
    - **Validates: Requirements 2.7**

  - [x] 2.3 Write property test: validator rejects broken backgroundId references
    - **Property 6: Validator rejects broken backgroundId references**
    - Generate stack-shaped objects where at least one card has a `backgroundId` that does not appear in `backgrounds`. Assert `validateStack` returns `err`.
    - **Validates: Requirements 2.5**

  - [x] 2.4 Write unit tests for validator edge cases
    - Non-object input, missing required fields, out-of-bounds `currentCardIndex`, nested validation errors.
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement message dispatcher in `src/engine/message.ts`
  - [x] 4.1 Implement `scriptHasHandler(script: string, handlerName: string): boolean`
    - Use a case-insensitive regex `/^on\s+<name>\b/m` to detect handler presence.
    - _Requirements: 3.9_

  - [x] 4.2 Implement `dispatchMessage(target: MessageTarget, message: HyperTalkMessage, stack: Stack): DispatchResult`
    - Walk the bubble chain: target object → card → background → stack.
    - Return `{ handled: true, handlerName, handledBy }` at the first level where `scriptHasHandler` is true.
    - Return `{ handled: false, handlerName, handledBy: 'none' }` for unknown ids or when no level handles.
    - Export `MessageTarget`, `HyperTalkMessage`, `DispatchResult`, `HandledBy` types from this file.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 4.3 Write property test: message bubbling order
    - **Property 1: Message bubbling order**
    - Generate a valid stack where the target object's script contains the handler. Assert `handledBy` equals `target.kind` and not any higher level.
    - Repeat for handler at card, background, and stack level only (object script absent at lower levels).
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [x] 4.4 Write unit tests for dispatcher
    - Handler at each level in isolation, no handler anywhere, unknown cardId, unknown objectId.
    - _Requirements: 3.6, 3.7, 3.8_

- [x] 5. Implement runtime API in `src/engine/stack-runtime.ts`
  - [x] 5.1 Implement `getFieldText` and `setFieldText`
    - Both accept `stack`, `cardId`, `fieldId`; return `Result<string, EngineError>` and `Result<Stack, EngineError>` respectively.
    - `setFieldText` performs an immutable update: spread the stack and cards array, replacing only the targeted field.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 5.2 Write property test: setFieldText immutability and targeting
    - **Property 4: setFieldText is immutable and targeted**
    - Generate a valid stack with at least one card and one field. Assert the original stack is unchanged after the call and the returned stack differs only in the targeted field's text.
    - **Validates: Requirements 4.5, 4.6, 4.7, 4.8**

  - [x] 5.3 Implement `currentCard`, `navigateTo`, `navigateNext`, and `navigatePrev`
    - `currentCard` returns `stack.cards[stack.currentCardIndex]`.
    - `navigateNext`/`navigatePrev` use modular arithmetic and return `err` on empty stacks.
    - `navigateTo` finds the card by id and returns `err` when not found.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 5.4 Write property test: navigation stays in bounds
    - **Property 3: Navigation stays in bounds**
    - Generate a valid stack with ≥ 1 card. Apply a random sequence of `navigateNext`/`navigatePrev` calls and assert `currentCardIndex` stays in `[0, cards.length - 1]` after each step.
    - **Validates: Requirements 5.5, 5.6, 5.8, 5.9**

  - [x] 5.5 Write unit tests for runtime API
    - `getFieldText`/`setFieldText` with unknown ids, `navigateTo` with unknown id, `navigateNext`/`navigatePrev` on empty stack.
    - _Requirements: 4.2, 4.3, 5.4, 5.7, 5.10_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement serialiser in `src/engine/stack-serialise.ts`
  - [x] 7.1 Implement `saveStack(stack: Stack): string`
    - Delegate to `JSON.stringify(stack)`.
    - _Requirements: 6.1_

  - [x] 7.2 Implement `loadStack(json: string): Result<Stack, EngineError>`
    - Wrap `JSON.parse` in a try/catch; return `err` on parse failure.
    - Pass the parsed value to `validateStack`; propagate any validation error.
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [-] 7.3 Write property test: save/load round-trip
    - **Property 2: Save/load round-trip**
    - Generate a valid `Stack` using fast-check arbitraries. Assert `loadStack(saveStack(stack))` returns `ok` and the loaded value is deeply equal to the original.
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

  - [ ] 7.4 Write unit tests for serialiser error paths
    - Invalid JSON string, valid JSON with schema violations (missing fields, broken backgroundId).
    - _Requirements: 6.3, 6.4_

- [~] 8. Wire everything into `src/engine/index.ts`
  - Re-export all public types and functions from `stack-types.ts`, `message.ts`, `stack-runtime.ts`, `stack-serialise.ts`, and `stack-validate.ts`.
  - Ensure no existing exports are removed or broken.
  - _Requirements: 7.1, 7.2, 7.3_

- [~] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but property tests are strongly recommended given the core correctness requirements.
- All files must stay within `src/engine/` with zero React or DOM imports.
- Use `ok`/`err` from `src/engine/result.ts` throughout — do not redefine them.
- fast-check is already in `devDependencies`; no new runtime packages are needed.
- Arbitraries for `Stack`, `Card`, `Background`, `Button`, and `Field` should be built up compositionally using `fc.record` and `fc.array`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1"] },
    { "id": 6, "tasks": ["4.3", "4.4", "5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4", "5.5"] },
    { "id": 8, "tasks": ["6"] },
    { "id": 9, "tasks": ["7.1"] },
    { "id": 10, "tasks": ["7.2"] },
    { "id": 11, "tasks": ["7.3", "7.4"] },
    { "id": 12, "tasks": ["8"] },
    { "id": 13, "tasks": ["9"] }
  ]
}
```
