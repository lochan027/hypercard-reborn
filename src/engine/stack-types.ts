export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BackgroundField {
  id: string;
  name: string;
  rect: Rect;
}

export interface Background {
  id: string;
  name: string;
  script?: string;
  fields: BackgroundField[];
}

export type ButtonStyle = 'default' | 'transparent' | 'checkbox' | 'radio';

export interface Button {
  id: string;
  name: string;
  rect: Rect;
  script?: string;
  style: ButtonStyle;
}

export interface Field {
  id: string;
  name: string;
  rect: Rect;
  text: string;
  script?: string;
}

export interface Card {
  id: string;
  name: string;
  backgroundId: string;
  script?: string;
  buttons: Button[];
  fields: Field[];
}

export interface StackMetadata {
  createdAt: string; // ISO 8601
  modifiedAt: string; // ISO 8601
}

export interface Stack {
  id: string;
  name: string;
  backgrounds: Background[];
  cards: Card[];
  currentCardIndex: number;
  script?: string;
  metadata: StackMetadata;
}
