# Requirements Document

## Introduction

The stack model provides the foundational data layer for HyperCard Reborn. It defines typed structures for stacks, backgrounds, cards, buttons, and fields; a message-passing system that bubbles HyperTalk messages up the object hierarchy; a runtime API for field access and card navigation; and JSON-based save/load serialisation. All code lives in `src/engine/` with zero React or DOM imports and must reuse the existing `Result<T,E>` and `EngineError` primitives.

## Glossary

- **Stack**: The top-level document containing backgrounds, cards, and an optional HyperTalk script.
- **Background**: A named layer shared by one or more cards; may define background fields and an optional script.
- **Card**: A single page in a stack, referencing one background, holding buttons and fields, and carrying an optional script.
- **Button**: An interactive rectangular element on a card with a style and an optional script.
- **Field**: A rectangular text-bearing element on a card with an optional script.
- **BackgroundField**: A field definition living on a Background (geometry only; content is per-card).
- **Rect**: An axis-aligned rectangle `{ x, y, w, h }` with integer coordinates.
- **Stack_Model**: The collective implementation of types, validators, message dispatcher, runtime API, and serialiser described in this spec.
- **Dispatcher**: The `dispatchMessage` function responsible for routing HyperTalk messages.
- **Runtime**: The collection of functions (`getFieldText`, `setFieldText`, `currentCard`, `navigateTo`, `navigateNext`, `navigatePrev`) that the HyperTalk interpreter calls during script execution.
- **Serialiser**: The `saveStack` / `loadStack` pair responsible for JSON persistence.
- **Validator**: The `validateStack` (and related) functions that type-narrow unknown JSON values into typed `Stack` values.
- **EngineError**: The error type `{ message: string; line: number | null }` defined in `result.ts`.
- **Result**: The discriminated union `{ ok: true; value: T } | { ok: false; error: EngineError }` defined in `result.ts`.

---

## Requirements

### Requirement 1: Data Model Types

**User Story:** As a developer building the HyperCard runtime, I want well-typed TypeScript interfaces for stacks, backgrounds, cards, buttons, and fields, so that I can pass and inspect stack data with full type-safety throughout the engine.

#### Acceptance Criteria

1. THE Stack_Model SHALL define a `Rect` interface with integer fields `x`, `y`, `w`, and `h`.
2. THE Stack_Model SHALL define a `BackgroundField` interface with string fields `id` and `name`, and a `Rect` field `rect`.
3. THE Stack_Model SHALL define a `Background` interface with string fields `id` and `name`, an optional string field `script`, and an array field `fields` of type `BackgroundField[]`.
4. THE Stack_Model SHALL define a `Button` interface with string fields `id` and `name`, a `Rect` field `rect`, an optional string field `script`, and a `style` field typed as the union `'default' | 'transparent' | 'checkbox' | 'radio'`.
5. THE Stack_Model SHALL define a `Field` interface with string fields `id`, `name`, and `text`; a `Rect` field `rect`; and an optional string field `script`.
6. THE Stack_Model SHALL define a `Card` interface with string fields `id`, `name`, and `backgroundId`; an optional string field `script`; a `Button[]` field `buttons`; and a `Field[]` field `fields`.
7. THE Stack_Model SHALL define a `StackMetadata` interface with ISO 8601 string fields `createdAt` and `modifiedAt`.
8. THE Stack_Model SHALL define a `Stack` interface with string fields `id` and `name`; a `Background[]` field `backgrounds`; a `Card[]` field `cards`; a numeric field `currentCardIndex`; an optional string field `script`; and a `StackMetadata` field `metadata`.
9. THE Stack_Model SHALL enforce TypeScript strict mode on all files in `src/engine/`.
10. THE Stack_Model SHALL import zero React or DOM symbols in any `src/engine/` file.

---

### Requirement 2: Structural Validation

**User Story:** As a developer loading stack data from an external source, I want a validator that rejects malformed values early, so that the rest of the runtime can assume all `Stack` values are well-formed.

#### Acceptance Criteria

1. THE Validator SHALL export a `validateStack(value: unknown): Result<Stack, EngineError>` function.
2. WHEN `validateStack` receives a value that is not a plain object, THEN THE Validator SHALL return `err` with a descriptive message.
3. WHEN `validateStack` receives an object missing any required field (`id`, `name`, `backgrounds`, `cards`, `currentCardIndex`, `metadata`), THEN THE Validator SHALL return `err` with a message naming the missing field.
4. WHEN `validateStack` receives an object whose `currentCardIndex` is not an integer or is outside the range `[0, cards.length - 1]`, THEN THE Validator SHALL return `err` with a message indicating the out-of-bounds index (an index of `0` on an empty-cards stack SHALL be accepted).
5. WHEN `validateStack` receives an object where any `card.backgroundId` does not match the `id` of any entry in `backgrounds`, THEN THE Validator SHALL return `err` with a message identifying the broken reference.
6. WHEN `validateStack` receives a fully valid stack object, THEN THE Validator SHALL return `ok(stack)` typed as `Stack`.
7. THE Validator SHALL validate the `Rect` fields of every `Button`, `Field`, and `BackgroundField`, returning `err` when any coordinate is not a finite integer or when `w` or `h` is negative.

---

### Requirement 3: Message Dispatch

**User Story:** As the HyperTalk interpreter, I want to send a named message to a button or field and have it bubble up the object hierarchy, so that scripts at any level can handle the message and lower-level handlers always take precedence.

#### Acceptance Criteria

1. THE Dispatcher SHALL export a `dispatchMessage(target: MessageTarget, message: HyperTalkMessage, stack: Stack): DispatchResult` function.
2. WHEN a handler matching `message.handlerName` is present in the target object's script, THEN THE Dispatcher SHALL return `{ handled: true, handledBy: target.kind }` without checking higher levels.
3. WHEN no matching handler is present in the target object's script but one is present in the card's script, THEN THE Dispatcher SHALL return `{ handled: true, handledBy: 'card' }`.
4. WHEN no matching handler is present in the target object's or card's script but one is present in the background's script, THEN THE Dispatcher SHALL return `{ handled: true, handledBy: 'background' }`.
5. WHEN no matching handler is present in the target object's, card's, or background's script but one is present in the stack's script, THEN THE Dispatcher SHALL return `{ handled: true, handledBy: 'stack' }`.
6. WHEN no matching handler is present at any level in the bubble chain, THEN THE Dispatcher SHALL return `{ handled: false, handledBy: 'none' }`.
7. WHEN `target.cardId` does not match any card in the stack, THEN THE Dispatcher SHALL return `{ handled: false, handledBy: 'none' }`.
8. WHEN `target.objectId` does not match any button or field on the targeted card, THEN THE Dispatcher SHALL return `{ handled: false, handledBy: 'none' }`.
9. THE Dispatcher SHALL determine handler presence by scanning the script string for a line matching `on <handlerName>` (case-insensitive).

---

### Requirement 4: Field Runtime API

**User Story:** As the HyperTalk interpreter, I want typed functions for reading and writing field text, so that `put` and `get` HyperTalk statements can operate on card fields without coupling to React state.

#### Acceptance Criteria

1. THE Runtime SHALL export `getFieldText(stack: Stack, cardId: string, fieldId: string): Result<string, EngineError>`.
2. WHEN `getFieldText` is called with a `cardId` that does not match any card, THEN THE Runtime SHALL return `err` with a message identifying the missing card.
3. WHEN `getFieldText` is called with a `fieldId` that does not match any field on the specified card, THEN THE Runtime SHALL return `err` with a message identifying the missing field.
4. WHEN `getFieldText` is called with valid ids, THEN THE Runtime SHALL return `ok(field.text)`.
5. THE Runtime SHALL export `setFieldText(stack: Stack, cardId: string, fieldId: string, text: string): Result<Stack, EngineError>`.
6. WHEN `setFieldText` is called with valid ids, THEN THE Runtime SHALL return `ok(newStack)` where `newStack` is identical to `stack` except the targeted field's `text` equals the provided value.
7. WHEN `setFieldText` is called with an unknown id, THEN THE Runtime SHALL return `err` and leave the original `stack` unchanged.
8. THE Runtime SHALL NOT mutate the input `stack` argument in any function.

---

### Requirement 5: Navigation Runtime API

**User Story:** As the HyperTalk interpreter, I want navigation functions that move between cards by id or by relative position, so that `go to`, `go next`, and `go prev` HyperTalk statements can be executed safely.

#### Acceptance Criteria

1. THE Runtime SHALL export `currentCard(stack: Stack): Card` returning the card at `stack.currentCardIndex`.
2. THE Runtime SHALL export `navigateTo(stack: Stack, cardId: string): Result<Stack, EngineError>`.
3. WHEN `navigateTo` is called with a `cardId` that matches a card, THEN THE Runtime SHALL return `ok(newStack)` where `newStack.currentCardIndex` is the index of that card.
4. WHEN `navigateTo` is called with a `cardId` that does not match any card, THEN THE Runtime SHALL return `err` with a message identifying the unknown card id.
5. THE Runtime SHALL export `navigateNext(stack: Stack): Result<Stack, EngineError>`.
6. WHEN `navigateNext` is called on a stack with at least one card, THEN THE Runtime SHALL return `ok(newStack)` where `newStack.currentCardIndex` equals `(stack.currentCardIndex + 1) % stack.cards.length`.
7. WHEN `navigateNext` is called on a stack with zero cards, THEN THE Runtime SHALL return `err('Stack has no cards')`.
8. THE Runtime SHALL export `navigatePrev(stack: Stack): Result<Stack, EngineError>`.
9. WHEN `navigatePrev` is called on a stack with at least one card, THEN THE Runtime SHALL return `ok(newStack)` where `newStack.currentCardIndex` equals `(stack.currentCardIndex - 1 + stack.cards.length) % stack.cards.length`.
10. WHEN `navigatePrev` is called on a stack with zero cards, THEN THE Runtime SHALL return `err('Stack has no cards')`.

---

### Requirement 6: Save and Load Serialisation

**User Story:** As a developer implementing stack persistence, I want save and load functions that round-trip a stack through JSON without data loss, so that users can store and restore their HyperCard stacks.

#### Acceptance Criteria

1. THE Serialiser SHALL export `saveStack(stack: Stack): string` that returns a JSON string representation of the stack.
2. THE Serialiser SHALL export `loadStack(json: string): Result<Stack, EngineError>`.
3. WHEN `loadStack` receives a string that is not valid JSON, THEN THE Serialiser SHALL return `err` with a message indicating the parse failure.
4. WHEN `loadStack` receives valid JSON that fails structural validation, THEN THE Serialiser SHALL return `err` with the validator's descriptive message.
5. WHEN `loadStack` receives a valid JSON representation of a stack, THEN THE Serialiser SHALL return `ok(stack)` where `stack` is deeply equal to the original stack that was serialised.
6. THE Serialiser SHALL use `validateStack` internally when loading, ensuring that all schema invariants are enforced.

---

### Requirement 7: Module Exports

**User Story:** As a consumer of the engine module, I want all public types and functions re-exported from `src/engine/index.ts`, so that I can import the entire stack model from a single location.

#### Acceptance Criteria

1. THE Stack_Model SHALL re-export all public types (`Stack`, `Card`, `Background`, `BackgroundField`, `Button`, `Field`, `Rect`, `StackMetadata`, `MessageTarget`, `HyperTalkMessage`, `DispatchResult`, `HandledBy`) from `src/engine/index.ts`.
2. THE Stack_Model SHALL re-export all public functions (`dispatchMessage`, `getFieldText`, `setFieldText`, `currentCard`, `navigateTo`, `navigateNext`, `navigatePrev`, `saveStack`, `loadStack`, `validateStack`) from `src/engine/index.ts`.
3. THE Stack_Model SHALL NOT introduce any new runtime npm dependencies unless Zod is chosen for validation, in which case that choice SHALL be documented.
