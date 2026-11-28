import type {
  Rect,
  BackgroundField,
  Background,
  Button,
  ButtonStyle,
  Field,
  Card,
  StackMetadata,
  Stack,
} from './stack-types';
import { ok, err, type Result, type EngineError } from './result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isFiniteInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v);
}

// ---------------------------------------------------------------------------
// validateRect
// ---------------------------------------------------------------------------

export function validateRect(value: unknown): Result<Rect, EngineError> {
  if (!isPlainObject(value)) {
    return err('Rect must be an object');
  }

  for (const key of ['x', 'y', 'w', 'h'] as const) {
    if (!isFiniteInteger(value[key])) {
      return err(`Rect.${key} must be a finite integer`);
    }
  }

  const x = value.x as number;
  const y = value.y as number;
  const w = value.w as number;
  const h = value.h as number;

  if (w < 0) return err('Rect.w must be >= 0');
  if (h < 0) return err('Rect.h must be >= 0');

  return ok({ x, y, w, h });
}

// ---------------------------------------------------------------------------
// validateBackgroundField
// ---------------------------------------------------------------------------

export function validateBackgroundField(value: unknown): Result<BackgroundField, EngineError> {
  if (!isPlainObject(value)) {
    return err('BackgroundField must be an object');
  }

  if (!isNonEmptyString(value.id)) return err('BackgroundField.id must be a non-empty string');
  if (!isNonEmptyString(value.name)) return err('BackgroundField.name must be a non-empty string');

  const rectResult = validateRect(value.rect);
  if (!rectResult.ok) return err(`BackgroundField.rect: ${rectResult.error.message}`);

  return ok({ id: value.id, name: value.name, rect: rectResult.value });
}

// ---------------------------------------------------------------------------
// validateBackground
// ---------------------------------------------------------------------------

export function validateBackground(value: unknown): Result<Background, EngineError> {
  if (!isPlainObject(value)) {
    return err('Background must be an object');
  }

  if (!isNonEmptyString(value.id)) return err('Background.id must be a non-empty string');
  if (!isNonEmptyString(value.name)) return err('Background.name must be a non-empty string');

  if (value.script !== undefined && typeof value.script !== 'string') {
    return err('Background.script must be a string if present');
  }

  if (!Array.isArray(value.fields)) {
    return err('Background.fields must be an array');
  }

  const fields: BackgroundField[] = [];
  for (const f of value.fields) {
    const result = validateBackgroundField(f);
    if (!result.ok) return result;
    fields.push(result.value);
  }

  return ok({
    id: value.id,
    name: value.name,
    script: typeof value.script === 'string' ? value.script : undefined,
    fields,
  });
}

// ---------------------------------------------------------------------------
// validateButton
// ---------------------------------------------------------------------------

const BUTTON_STYLES = new Set<ButtonStyle>(['default', 'transparent', 'checkbox', 'radio']);

export function validateButton(value: unknown): Result<Button, EngineError> {
  if (!isPlainObject(value)) {
    return err('Button must be an object');
  }

  if (!isNonEmptyString(value.id)) return err('Button.id must be a non-empty string');
  if (!isNonEmptyString(value.name)) return err('Button.name must be a non-empty string');

  const rectResult = validateRect(value.rect);
  if (!rectResult.ok) return err(`Button.rect: ${rectResult.error.message}`);

  if (value.script !== undefined && typeof value.script !== 'string') {
    return err('Button.script must be a string if present');
  }

  if (!BUTTON_STYLES.has(value.style as ButtonStyle)) {
    return err(`Button.style must be one of: ${[...BUTTON_STYLES].join(', ')}`);
  }

  return ok({
    id: value.id,
    name: value.name,
    rect: rectResult.value,
    script: typeof value.script === 'string' ? value.script : undefined,
    style: value.style as ButtonStyle,
  });
}

// ---------------------------------------------------------------------------
// validateField
// ---------------------------------------------------------------------------

export function validateField(value: unknown): Result<Field, EngineError> {
  if (!isPlainObject(value)) {
    return err('Field must be an object');
  }

  if (!isNonEmptyString(value.id)) return err('Field.id must be a non-empty string');
  if (!isNonEmptyString(value.name)) return err('Field.name must be a non-empty string');

  const rectResult = validateRect(value.rect);
  if (!rectResult.ok) return err(`Field.rect: ${rectResult.error.message}`);

  if (typeof value.text !== 'string') {
    return err('Field.text must be a string');
  }

  if (value.script !== undefined && typeof value.script !== 'string') {
    return err('Field.script must be a string if present');
  }

  return ok({
    id: value.id,
    name: value.name,
    rect: rectResult.value,
    text: value.text,
    script: typeof value.script === 'string' ? value.script : undefined,
  });
}

// ---------------------------------------------------------------------------
// validateCard
// ---------------------------------------------------------------------------

export function validateCard(value: unknown, bgIds?: Set<string>): Result<Card, EngineError> {
  if (!isPlainObject(value)) {
    return err('Card must be an object');
  }

  if (!isNonEmptyString(value.id)) return err('Card.id must be a non-empty string');
  if (!isNonEmptyString(value.name)) return err('Card.name must be a non-empty string');
  if (!isNonEmptyString(value.backgroundId)) {
    return err('Card.backgroundId must be a non-empty string');
  }

  if (bgIds !== undefined && !bgIds.has(value.backgroundId)) {
    return err(`Card.backgroundId '${value.backgroundId}' does not reference a known background`);
  }

  if (value.script !== undefined && typeof value.script !== 'string') {
    return err('Card.script must be a string if present');
  }

  if (!Array.isArray(value.buttons)) {
    return err('Card.buttons must be an array');
  }

  const buttons: Button[] = [];
  for (const b of value.buttons) {
    const result = validateButton(b);
    if (!result.ok) return result;
    buttons.push(result.value);
  }

  if (!Array.isArray(value.fields)) {
    return err('Card.fields must be an array');
  }

  const fields: Field[] = [];
  for (const f of value.fields) {
    const result = validateField(f);
    if (!result.ok) return result;
    fields.push(result.value);
  }

  return ok({
    id: value.id,
    name: value.name,
    backgroundId: value.backgroundId,
    script: typeof value.script === 'string' ? value.script : undefined,
    buttons,
    fields,
  });
}

// ---------------------------------------------------------------------------
// validateMetadata
// ---------------------------------------------------------------------------

export function validateMetadata(value: unknown): Result<StackMetadata, EngineError> {
  if (!isPlainObject(value)) {
    return err('StackMetadata must be an object');
  }

  if (typeof value.createdAt !== 'string' || value.createdAt.length === 0) {
    return err('StackMetadata.createdAt must be a non-empty string');
  }
  if (typeof value.modifiedAt !== 'string' || value.modifiedAt.length === 0) {
    return err('StackMetadata.modifiedAt must be a non-empty string');
  }

  return ok({ createdAt: value.createdAt, modifiedAt: value.modifiedAt });
}

// ---------------------------------------------------------------------------
// validateStack
// ---------------------------------------------------------------------------

export function validateStack(value: unknown): Result<Stack, EngineError> {
  // 1. Must be a plain object
  if (!isPlainObject(value)) {
    return err('Stack must be an object');
  }

  // 2. Required string fields
  if (!isNonEmptyString(value.id)) return err('Stack.id must be a non-empty string');
  if (!isNonEmptyString(value.name)) return err('Stack.name must be a non-empty string');

  // 3. backgrounds array
  if (!Array.isArray(value.backgrounds)) {
    return err('Stack.backgrounds must be an array');
  }

  const backgrounds: Background[] = [];
  for (const bg of value.backgrounds) {
    const result = validateBackground(bg);
    if (!result.ok) return result;
    backgrounds.push(result.value);
  }

  // 4. cards array — validate referential integrity against collected background ids
  if (!Array.isArray(value.cards)) {
    return err('Stack.cards must be an array');
  }

  const bgIds = new Set(backgrounds.map((b) => b.id));
  const cards: Card[] = [];
  for (const card of value.cards) {
    const result = validateCard(card, bgIds);
    if (!result.ok) return result;
    cards.push(result.value);
  }

  // 5. currentCardIndex bounds
  const idx = value.currentCardIndex;
  if (!isFiniteInteger(idx)) {
    return err('Stack.currentCardIndex must be an integer');
  }
  if (idx < 0) {
    return err('Stack.currentCardIndex out of bounds');
  }
  if (cards.length > 0 && idx >= cards.length) {
    return err('Stack.currentCardIndex out of bounds');
  }
  // Allow idx === 0 when cards is empty (blank new stack)

  // 6. optional script
  if (value.script !== undefined && typeof value.script !== 'string') {
    return err('Stack.script must be a string if present');
  }

  // 7. metadata
  const metaResult = validateMetadata(value.metadata);
  if (!metaResult.ok) return metaResult;

  return ok({
    id: value.id,
    name: value.name,
    backgrounds,
    cards,
    currentCardIndex: idx,
    script: typeof value.script === 'string' ? value.script : undefined,
    metadata: metaResult.value,
  });
}
