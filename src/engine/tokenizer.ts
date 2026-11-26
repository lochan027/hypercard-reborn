import { type Result, ok, err } from './result';
import type { EngineError } from './result';

export type TokenKind =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'ON'
  | 'END'
  | 'PUT'
  | 'INTO'
  | 'GET'
  | 'IF'
  | 'THEN'
  | 'ELSE'
  | 'REPEAT'
  | 'TIMES'
  | 'GO'
  | 'TO'
  | 'CARD'
  | 'NEXT'
  | 'PREVIOUS'
  | 'ANSWER'
  | 'FIELD'
  | 'BUTTON'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'AMP'
  | 'EQ'
  | 'LT'
  | 'GT'
  | 'LPAREN'
  | 'RPAREN'
  | 'NEWLINE'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
}

const KEYWORDS: Record<string, TokenKind> = {
  on: 'ON',
  end: 'END',
  put: 'PUT',
  into: 'INTO',
  get: 'GET',
  if: 'IF',
  then: 'THEN',
  else: 'ELSE',
  repeat: 'REPEAT',
  times: 'TIMES',
  go: 'GO',
  to: 'TO',
  card: 'CARD',
  next: 'NEXT',
  previous: 'PREVIOUS',
  answer: 'ANSWER',
  field: 'FIELD',
  button: 'BUTTON',
};

export function tokenize(source: string): Result<Token[], EngineError> {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;

  while (pos < source.length) {
    const ch = source[pos];

    // Skip spaces and tabs
    if (ch === ' ' || ch === '\t') {
      pos++;
      continue;
    }

    // Newline
    if (ch === '\n') {
      tokens.push({ kind: 'NEWLINE', value: '\n', line });
      line++;
      pos++;
      continue;
    }

    // Line comment: --
    if (ch === '-' && source[pos + 1] === '-') {
      // Advance to end of line (but don't consume the newline itself)
      while (pos < source.length && source[pos] !== '\n') {
        pos++;
      }
      continue;
    }

    // String literal
    if (ch === '"') {
      pos++; // skip opening quote
      let value = '';
      while (pos < source.length && source[pos] !== '"') {
        if (source[pos] === '\\') {
          pos++;
          if (pos >= source.length) {
            return err(`Unterminated string escape at end of input`, line);
          }
          const esc = source[pos];
          if (esc === '"') {
            value += '"';
          } else if (esc === '\\') {
            value += '\\';
          } else {
            value += '\\' + esc;
          }
        } else {
          value += source[pos];
        }
        pos++;
      }
      if (pos >= source.length) {
        return err(`Unterminated string literal`, line);
      }
      pos++; // skip closing quote
      tokens.push({ kind: 'STRING', value, line });
      continue;
    }

    // Numeric literal
    if (ch >= '0' && ch <= '9') {
      let start = pos;
      while (pos < source.length && source[pos] >= '0' && source[pos] <= '9') {
        pos++;
      }
      if (pos < source.length && source[pos] === '.') {
        pos++;
        while (pos < source.length && source[pos] >= '0' && source[pos] <= '9') {
          pos++;
        }
      }
      tokens.push({ kind: 'NUMBER', value: source.slice(start, pos), line });
      continue;
    }

    // Identifier or keyword
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let start = pos;
      while (
        pos < source.length &&
        ((source[pos] >= 'a' && source[pos] <= 'z') ||
          (source[pos] >= 'A' && source[pos] <= 'Z') ||
          (source[pos] >= '0' && source[pos] <= '9') ||
          source[pos] === '_')
      ) {
        pos++;
      }
      const lexeme = source.slice(start, pos);
      const keyword = KEYWORDS[lexeme.toLowerCase()];
      tokens.push({ kind: keyword ?? 'IDENT', value: lexeme, line });
      continue;
    }

    // Single-character operators and punctuation
    switch (ch) {
      case '+':
        tokens.push({ kind: 'PLUS', value: ch, line });
        pos++;
        continue;
      case '-':
        tokens.push({ kind: 'MINUS', value: ch, line });
        pos++;
        continue;
      case '*':
        tokens.push({ kind: 'STAR', value: ch, line });
        pos++;
        continue;
      case '/':
        tokens.push({ kind: 'SLASH', value: ch, line });
        pos++;
        continue;
      case '&':
        tokens.push({ kind: 'AMP', value: ch, line });
        pos++;
        continue;
      case '=':
        tokens.push({ kind: 'EQ', value: ch, line });
        pos++;
        continue;
      case '<':
        tokens.push({ kind: 'LT', value: ch, line });
        pos++;
        continue;
      case '>':
        tokens.push({ kind: 'GT', value: ch, line });
        pos++;
        continue;
      case '(':
        tokens.push({ kind: 'LPAREN', value: ch, line });
        pos++;
        continue;
      case ')':
        tokens.push({ kind: 'RPAREN', value: ch, line });
        pos++;
        continue;
    }

    // Unrecognised character
    return err(`Unexpected character '${ch}'`, line);
  }

  tokens.push({ kind: 'EOF', value: '', line });
  return ok(tokens);
}
