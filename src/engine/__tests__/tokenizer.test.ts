import { describe, it, expect } from 'vitest';
import { tokenize, type Token, type TokenKind } from '../tokenizer';

/** Unwrap a successful tokenize result, throws on failure. */
function tokens(source: string): Token[] {
  const result = tokenize(source);
  if (!result.ok) throw new Error(`tokenize failed: ${result.error.message}`);
  return result.value;
}

// ---------------------------------------------------------------------------
// NUMBER
// ---------------------------------------------------------------------------
describe('NUMBER', () => {
  it('tokenizes an integer', () => {
    const [tok] = tokens('42');
    expect(tok.kind).toBe('NUMBER');
    expect(tok.value).toBe('42');
  });

  it('tokenizes a decimal', () => {
    const [tok] = tokens('3.14');
    expect(tok.kind).toBe('NUMBER');
    expect(tok.value).toBe('3.14');
  });
});

// ---------------------------------------------------------------------------
// STRING
// ---------------------------------------------------------------------------
describe('STRING', () => {
  it('tokenizes a plain string', () => {
    const [tok] = tokens('"hello"');
    expect(tok.kind).toBe('STRING');
    expect(tok.value).toBe('hello');
  });

  it('handles escaped double-quote inside string', () => {
    // source: "say \"hi\""
    const [tok] = tokens('"say \\"hi\\""');
    expect(tok.kind).toBe('STRING');
    expect(tok.value).toBe('say "hi"');
  });

  it('handles escaped backslash inside string', () => {
    // source: "a\\b"
    const [tok] = tokens('"a\\\\b"');
    expect(tok.kind).toBe('STRING');
    expect(tok.value).toBe('a\\b');
  });
});

// ---------------------------------------------------------------------------
// IDENT
// ---------------------------------------------------------------------------
describe('IDENT', () => {
  it('tokenizes an identifier', () => {
    const [tok] = tokens('myVar');
    expect(tok.kind).toBe('IDENT');
    expect(tok.value).toBe('myVar');
  });

  it('tokenizes an identifier with underscores and digits', () => {
    const [tok] = tokens('count_1');
    expect(tok.kind).toBe('IDENT');
    expect(tok.value).toBe('count_1');
  });
});

// ---------------------------------------------------------------------------
// Keywords (all 17 keyword kinds)
// ---------------------------------------------------------------------------
const KEYWORD_CASES: Array<[string, TokenKind]> = [
  ['on',       'ON'],
  ['end',      'END'],
  ['put',      'PUT'],
  ['into',     'INTO'],
  ['get',      'GET'],
  ['if',       'IF'],
  ['then',     'THEN'],
  ['else',     'ELSE'],
  ['repeat',   'REPEAT'],
  ['times',    'TIMES'],
  ['go',       'GO'],
  ['to',       'TO'],
  ['card',     'CARD'],
  ['next',     'NEXT'],
  ['previous', 'PREVIOUS'],
  ['answer',   'ANSWER'],
  ['field',    'FIELD'],
  ['button',   'BUTTON'],
];

describe('keywords', () => {
  for (const [word, kind] of KEYWORD_CASES) {
    it(`tokenizes "${word}" as ${kind}`, () => {
      const [tok] = tokens(word);
      expect(tok.kind).toBe(kind);
      expect(tok.value).toBe(word);
    });

    it(`keyword "${word}" is case-insensitive`, () => {
      const [tok] = tokens(word.toUpperCase());
      expect(tok.kind).toBe(kind);
    });
  }
});

// ---------------------------------------------------------------------------
// Operators (all 8 operator kinds)
// ---------------------------------------------------------------------------
const OPERATOR_CASES: Array<[string, TokenKind]> = [
  ['+', 'PLUS'],
  ['-', 'MINUS'],
  ['*', 'STAR'],
  ['/', 'SLASH'],
  ['&', 'AMP'],
  ['=', 'EQ'],
  ['<', 'LT'],
  ['>', 'GT'],
];

describe('operators', () => {
  for (const [sym, kind] of OPERATOR_CASES) {
    it(`tokenizes "${sym}" as ${kind}`, () => {
      const [tok] = tokens(sym);
      expect(tok.kind).toBe(kind);
      expect(tok.value).toBe(sym);
    });
  }
});

// ---------------------------------------------------------------------------
// LPAREN / RPAREN
// ---------------------------------------------------------------------------
describe('parentheses', () => {
  it('tokenizes ( as LPAREN', () => {
    const [tok] = tokens('(');
    expect(tok.kind).toBe('LPAREN');
    expect(tok.value).toBe('(');
  });

  it('tokenizes ) as RPAREN', () => {
    const [tok] = tokens(')');
    expect(tok.kind).toBe('RPAREN');
    expect(tok.value).toBe(')');
  });
});

// ---------------------------------------------------------------------------
// NEWLINE
// ---------------------------------------------------------------------------
describe('NEWLINE', () => {
  it('tokenizes a newline character', () => {
    const toks = tokens('a\nb');
    const nl = toks.find(t => t.kind === 'NEWLINE');
    expect(nl).toBeDefined();
    expect(nl!.kind).toBe('NEWLINE');
    expect(nl!.value).toBe('\n');
  });
});

// ---------------------------------------------------------------------------
// Comment
// ---------------------------------------------------------------------------
describe('comment', () => {
  it('a -- comment produces no tokens except NEWLINE and EOF', () => {
    // Comment on its own line followed by a newline
    const toks = tokens('-- this is a comment\n');
    const kinds = toks.map(t => t.kind);
    // Only NEWLINE (from the \n) and EOF should appear; nothing from the comment text
    expect(kinds).toEqual(['NEWLINE', 'EOF']);
  });

  it('a -- comment at end of input (no trailing newline) produces only EOF', () => {
    const toks = tokens('-- no newline');
    const kinds = toks.map(t => t.kind);
    expect(kinds).toEqual(['EOF']);
  });
});

// ---------------------------------------------------------------------------
// Unrecognised character
// ---------------------------------------------------------------------------
describe('unrecognised character', () => {
  it('returns ok:false for an unrecognised character', () => {
    const result = tokenize('@');
    expect(result.ok).toBe(false);
  });

  it('error has a non-null line field', () => {
    const result = tokenize('@');
    if (result.ok) throw new Error('expected failure');
    expect(result.error.line).not.toBeNull();
  });

  it('error message contains the offending character', () => {
    const result = tokenize('#');
    if (result.ok) throw new Error('expected failure');
    expect(result.error.message).toContain('#');
  });
});

// ---------------------------------------------------------------------------
// Line numbers
// ---------------------------------------------------------------------------
describe('line numbers', () => {
  it('assigns correct line numbers across multiple lines', () => {
    // Line 1: "foo"
    // Line 2: "bar"
    // Line 3: "baz"
    const toks = tokens('foo\nbar\nbaz');
    const foo = toks.find(t => t.value === 'foo');
    const bar = toks.find(t => t.value === 'bar');
    const baz = toks.find(t => t.value === 'baz');

    expect(foo?.line).toBe(1);
    expect(bar?.line).toBe(2);
    expect(baz?.line).toBe(3);
  });

  it('NEWLINE token carries the line number of the line it terminates', () => {
    const toks = tokens('a\nb');
    const nl = toks.find(t => t.kind === 'NEWLINE');
    expect(nl?.line).toBe(1);
  });

  it('assigns the error line correctly for unrecognised characters mid-source', () => {
    // @ appears on line 2
    const result = tokenize('foo\n@');
    if (result.ok) throw new Error('expected failure');
    expect(result.error.line).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------
describe('empty input', () => {
  it('produces only an EOF token for an empty string', () => {
    const toks = tokens('');
    expect(toks).toHaveLength(1);
    expect(toks[0].kind).toBe('EOF');
    expect(toks[0].value).toBe('');
  });
});
