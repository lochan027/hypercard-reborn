import type { Stack } from './stack-types';

// Re-export Stack for consumers of this module who need it alongside these types.
export type { Stack };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageTarget =
  | { kind: 'button'; cardId: string; objectId: string }
  | { kind: 'field'; cardId: string; objectId: string };

export interface HyperTalkMessage {
  handlerName: string;
  args: string[];
}

export type HandledBy = 'button' | 'field' | 'card' | 'background' | 'stack' | 'none';

export interface DispatchResult {
  handled: boolean;
  handlerName: string;
  handledBy: HandledBy;
}

// ---------------------------------------------------------------------------
// scriptHasHandler
// ---------------------------------------------------------------------------

/**
 * Returns true if `script` contains a handler declaration whose name matches
 * `handlerName` case-insensitively. Matches lines of the form:
 *   on <handlerName>          (with optional trailing whitespace / arguments)
 * The check is anchored to the start of a line and uses a word-boundary so
 * `on mouseUp` does not match `on mouseUpAndOver`.
 *
 * Requirements: 3.9
 */
export function scriptHasHandler(script: string, handlerName: string): boolean {
  // Escape any regex-special characters in the handler name so a name like
  // "foo.bar" cannot accidentally widen the match.
  const escapedName = handlerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^on\\s+${escapedName}\\b`, 'im');
  return pattern.test(script);
}

// ---------------------------------------------------------------------------
// dispatchMessage
// ---------------------------------------------------------------------------

/**
 * Routes a HyperTalk message up the object hierarchy:
 *   object (button/field) → card → background → stack
 *
 * Returns the first level that claims the message, or `handledBy: 'none'`
 * when no level has a matching handler.
 *
 * Requirements: 3.1–3.8
 */
export function dispatchMessage(
  target: MessageTarget,
  message: HyperTalkMessage,
  stack: Stack,
): DispatchResult {
  const { handlerName } = message;

  // 1. Locate card
  const card = stack.cards.find(c => c.id === target.cardId);
  if (!card) {
    return { handled: false, handlerName, handledBy: 'none' };
  }

  // 2. Locate object (button or field) on the card
  const objects = target.kind === 'button' ? card.buttons : card.fields;
  const obj = objects.find(o => o.id === target.objectId);
  if (!obj) {
    return { handled: false, handlerName, handledBy: 'none' };
  }

  // 3. Bubble chain: object → card → background → stack
  if (obj.script && scriptHasHandler(obj.script, handlerName)) {
    return { handled: true, handlerName, handledBy: target.kind };
  }

  if (card.script && scriptHasHandler(card.script, handlerName)) {
    return { handled: true, handlerName, handledBy: 'card' };
  }

  const bg = stack.backgrounds.find(b => b.id === card.backgroundId);
  if (bg?.script && scriptHasHandler(bg.script, handlerName)) {
    return { handled: true, handlerName, handledBy: 'background' };
  }

  if (stack.script && scriptHasHandler(stack.script, handlerName)) {
    return { handled: true, handlerName, handledBy: 'stack' };
  }

  // 4. No level handled
  return { handled: false, handlerName, handledBy: 'none' };
}
