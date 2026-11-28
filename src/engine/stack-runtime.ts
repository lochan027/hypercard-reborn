import type { Stack, Card } from './stack-types';
import { ok, err, type Result, type EngineError } from './result';

export function getFieldText(
  stack: Stack,
  cardId: string,
  fieldId: string,
): Result<string, EngineError> {
  const card = stack.cards.find((c: Card) => c.id === cardId);
  if (!card) {
    return err(`Card not found: ${cardId}`);
  }

  const field = card.fields.find((f) => f.id === fieldId);
  if (!field) {
    return err(`Field not found: ${fieldId}`);
  }

  return ok(field.text);
}

export function setFieldText(
  stack: Stack,
  cardId: string,
  fieldId: string,
  text: string,
): Result<Stack, EngineError> {
  const cardIndex = stack.cards.findIndex((c: Card) => c.id === cardId);
  if (cardIndex === -1) {
    return err(`Card not found: ${cardId}`);
  }

  const card = stack.cards[cardIndex];
  const fieldIndex = card.fields.findIndex((f) => f.id === fieldId);
  if (fieldIndex === -1) {
    return err(`Field not found: ${fieldId}`);
  }

  const updatedField = { ...card.fields[fieldIndex], text };
  const updatedFields = [
    ...card.fields.slice(0, fieldIndex),
    updatedField,
    ...card.fields.slice(fieldIndex + 1),
  ];
  const updatedCard = { ...card, fields: updatedFields };
  const updatedCards = [
    ...stack.cards.slice(0, cardIndex),
    updatedCard,
    ...stack.cards.slice(cardIndex + 1),
  ];

  return ok({ ...stack, cards: updatedCards });
}

export function currentCard(stack: Stack): Card {
  return stack.cards[stack.currentCardIndex];
}

export function navigateTo(
  stack: Stack,
  cardId: string,
): Result<Stack, EngineError> {
  const index = stack.cards.findIndex((c: Card) => c.id === cardId);
  if (index === -1) {
    return err(`Card not found: ${cardId}`);
  }
  return ok({ ...stack, currentCardIndex: index });
}

export function navigateNext(stack: Stack): Result<Stack, EngineError> {
  if (stack.cards.length === 0) {
    return err('Stack has no cards');
  }
  const next = (stack.currentCardIndex + 1) % stack.cards.length;
  return ok({ ...stack, currentCardIndex: next });
}

export function navigatePrev(stack: Stack): Result<Stack, EngineError> {
  if (stack.cards.length === 0) {
    return err('Stack has no cards');
  }
  const prev =
    (stack.currentCardIndex - 1 + stack.cards.length) % stack.cards.length;
  return ok({ ...stack, currentCardIndex: prev });
}
