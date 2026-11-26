import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer';
import { parse } from '../parser';
import type {
  HandlerDecl,
  PutStmt,
  GetStmt,
  IfStmt,
  RepeatStmt,
  GoToCardStmt,
  GoToNextStmt,
  GoPrevStmt,
  AnswerStmt,
  NumberLit,
  StringLit,
  VarRef,
  FieldRef,
  ButtonRef,
  BinOp,
} from '../ast';

// Helper: tokenize then parse; throws descriptively if tokenize fails.
function parseSource(src: string) {
  const tokResult = tokenize(src);
  if (!tokResult.ok) throw new Error(`Tokenize failed: ${tokResult.error.message}`);
  return parse(tokResult.value);
}

// Helper: extract the first handler from a successful parse result.
function firstHandler(src: string): HandlerDecl {
  const result = parseSource(src);
  if (!result.ok) throw new Error(`Parse failed: ${result.error.message}`);
  return result.value[0];
}

// Helper: extract the first statement of the first handler.
function firstStmt(src: string) {
  return firstHandler(src).body[0];
}

// ── Statement forms ───────────────────────────────────────────────────────────

describe('HandlerDecl', () => {
  it('parses a minimal handler', () => {
    const src = 'on myHandler\nend myHandler\n';
    const result = parseSource(src);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [handler] = result.value;
    expect(handler.kind).toBe('HandlerDecl');
    expect(handler.name).toBe('myHandler');
    expect(handler.body).toHaveLength(0);
  });
});

describe('PutStmt', () => {
  it('parses put … into <var>', () => {
    const src = 'on h\nput 42 into x\nend h\n';
    const stmt = firstStmt(src) as PutStmt;
    expect(stmt.kind).toBe('PutStmt');
    expect((stmt.expr as NumberLit).value).toBe(42);
    expect(stmt.container).toMatchObject({ kind: 'VarRef', name: 'x' });
  });

  it('parses put … into field "…"', () => {
    const src = 'on h\nput "hello" into field "myField"\nend h\n';
    const stmt = firstStmt(src) as PutStmt;
    expect(stmt.kind).toBe('PutStmt');
    expect(stmt.container).toMatchObject({ kind: 'FieldRef', name: 'myField' });
  });

  it('parses put … into button "…"', () => {
    const src = 'on h\nput "ok" into button "myBtn"\nend h\n';
    const stmt = firstStmt(src) as PutStmt;
    expect(stmt.kind).toBe('PutStmt');
    expect(stmt.container).toMatchObject({ kind: 'ButtonRef', name: 'myBtn' });
  });
});

describe('GetStmt', () => {
  it('parses get <expr>', () => {
    const src = 'on h\nget 7\nend h\n';
    const stmt = firstStmt(src) as GetStmt;
    expect(stmt.kind).toBe('GetStmt');
    expect((stmt.expr as NumberLit).value).toBe(7);
  });
});

describe('IfStmt', () => {
  it('parses if … then … end if (no else)', () => {
    const src = 'on h\nif x then\nget 1\nend if\nend h\n';
    const stmt = firstStmt(src) as IfStmt;
    expect(stmt.kind).toBe('IfStmt');
    expect((stmt.cond as VarRef).name).toBe('x');
    expect(stmt.then).toHaveLength(1);
    expect(stmt.else_).toHaveLength(0);
  });

  it('parses if … then … else … end if', () => {
    const src = 'on h\nif x then\nget 1\nelse\nget 2\nend if\nend h\n';
    const stmt = firstStmt(src) as IfStmt;
    expect(stmt.kind).toBe('IfStmt');
    expect(stmt.then).toHaveLength(1);
    expect(stmt.else_).toHaveLength(1);
  });
});

describe('RepeatStmt', () => {
  it('parses repeat <count> times … end repeat', () => {
    const src = 'on h\nrepeat 3 times\nget 1\nend repeat\nend h\n';
    const stmt = firstStmt(src) as RepeatStmt;
    expect(stmt.kind).toBe('RepeatStmt');
    expect((stmt.count as NumberLit).value).toBe(3);
    expect(stmt.body).toHaveLength(1);
  });
});

describe('GoToCardStmt', () => {
  it('parses go to card <expr>', () => {
    const src = 'on h\ngo to card 2\nend h\n';
    const stmt = firstStmt(src) as GoToCardStmt;
    expect(stmt.kind).toBe('GoToCardStmt');
    expect((stmt.target as NumberLit).value).toBe(2);
  });
});

describe('GoToNextStmt', () => {
  it('parses go to next', () => {
    const src = 'on h\ngo to next\nend h\n';
    const stmt = firstStmt(src) as GoToNextStmt;
    expect(stmt.kind).toBe('GoToNextStmt');
  });
});

describe('GoPrevStmt', () => {
  it('parses go to previous', () => {
    const src = 'on h\ngo to previous\nend h\n';
    const stmt = firstStmt(src) as GoPrevStmt;
    expect(stmt.kind).toBe('GoPrevStmt');
  });
});

describe('AnswerStmt', () => {
  it('parses answer <expr>', () => {
    const src = 'on h\nanswer "hello"\nend h\n';
    const stmt = firstStmt(src) as AnswerStmt;
    expect(stmt.kind).toBe('AnswerStmt');
    expect((stmt.expr as StringLit).value).toBe('hello');
  });
});

// ── Primary expression types ──────────────────────────────────────────────────

describe('NumberLit expression', () => {
  it('parses an integer literal', () => {
    const src = 'on h\nget 42\nend h\n';
    const stmt = firstStmt(src) as GetStmt;
    const expr = stmt.expr as NumberLit;
    expect(expr.kind).toBe('NumberLit');
    expect(expr.value).toBe(42);
  });

  it('parses a decimal literal', () => {
    const src = 'on h\nget 3.14\nend h\n';
    const stmt = firstStmt(src) as GetStmt;
    const expr = stmt.expr as NumberLit;
    expect(expr.kind).toBe('NumberLit');
    expect(expr.value).toBeCloseTo(3.14);
  });
});

describe('StringLit expression', () => {
  it('parses a plain string', () => {
    const src = 'on h\nget "world"\nend h\n';
    const expr = (firstStmt(src) as GetStmt).expr as StringLit;
    expect(expr.kind).toBe('StringLit');
    expect(expr.value).toBe('world');
  });
});

describe('VarRef expression', () => {
  it('parses a variable reference', () => {
    const src = 'on h\nget myVar\nend h\n';
    const expr = (firstStmt(src) as GetStmt).expr as VarRef;
    expect(expr.kind).toBe('VarRef');
    expect(expr.name).toBe('myVar');
  });
});

describe('FieldRef expression', () => {
  it('parses a field reference', () => {
    const src = 'on h\nget field "title"\nend h\n';
    const expr = (firstStmt(src) as GetStmt).expr as FieldRef;
    expect(expr.kind).toBe('FieldRef');
    expect(expr.name).toBe('title');
  });
});

describe('ButtonRef expression', () => {
  it('parses a button reference', () => {
    const src = 'on h\nget button "ok"\nend h\n';
    const expr = (firstStmt(src) as GetStmt).expr as ButtonRef;
    expect(expr.kind).toBe('ButtonRef');
    expect(expr.name).toBe('ok');
  });
});

// ── BinOp operators ───────────────────────────────────────────────────────────

describe('BinOp operators', () => {
  const cases: Array<[string, BinOp['op'], string]> = [
    ['1 + 2', '+', 'plus'],
    ['1 - 2', '-', 'minus'],
    ['1 * 2', '*', 'star'],
    ['1 / 2', '/', 'slash'],
    ['"a" & "b"', '&', 'amp'],
    ['1 = 2', '=', 'eq'],
    ['1 < 2', '<', 'lt'],
    ['1 > 2', '>', 'gt'],
  ];

  for (const [exprSrc, expectedOp, label] of cases) {
    it(`parses ${label} operator (${expectedOp})`, () => {
      const src = `on h\nget ${exprSrc}\nend h\n`;
      const expr = (firstStmt(src) as GetStmt).expr as BinOp;
      expect(expr.kind).toBe('BinOp');
      expect(expr.op).toBe(expectedOp);
    });
  }
});

// ── Operator precedence ───────────────────────────────────────────────────────

describe('Operator precedence', () => {
  it('parses 1 + 2 * 3 as 1 + (2 * 3)', () => {
    // Expected tree: BinOp(+, NumberLit(1), BinOp(*, NumberLit(2), NumberLit(3)))
    const src = 'on h\nget 1 + 2 * 3\nend h\n';
    const expr = (firstStmt(src) as GetStmt).expr as BinOp;
    expect(expr.kind).toBe('BinOp');
    expect(expr.op).toBe('+');
    expect((expr.left as NumberLit).value).toBe(1);
    const right = expr.right as BinOp;
    expect(right.kind).toBe('BinOp');
    expect(right.op).toBe('*');
    expect((right.left as NumberLit).value).toBe(2);
    expect((right.right as NumberLit).value).toBe(3);
  });
});

// ── Grouped expression ────────────────────────────────────────────────────────

describe('Grouped expression', () => {
  it('parses (1 + 2) as a BinOp', () => {
    const src = 'on h\nget (1 + 2)\nend h\n';
    const expr = (firstStmt(src) as GetStmt).expr as BinOp;
    expect(expr.kind).toBe('BinOp');
    expect(expr.op).toBe('+');
    expect((expr.left as NumberLit).value).toBe(1);
    expect((expr.right as NumberLit).value).toBe(2);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('Malformed input', () => {
  it('returns ok: false with a numeric line field when end is missing', () => {
    // Handler body with no matching end
    const tokResult = tokenize('on myHandler\nget 1\n');
    if (!tokResult.ok) throw new Error('Tokenize unexpectedly failed');
    const result = parse(tokResult.value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error.line).toBe('number');
    }
  });

  it('never throws on malformed input', () => {
    const malformedSources = [
      'on \n',                   // missing handler name
      'on h\nput into\nend h\n', // put with no expr
      'on h\nif then\nend h\n',  // if with no condition
      'on h\nrepeat times\nend h\n', // repeat with no count
      'on h\n!!!\nend h\n',      // tokenizer will fail here but parse should not throw
      '',                        // empty source
      'on h\n',                  // no end at all
    ];

    for (const src of malformedSources) {
      let threw = false;
      try {
        const tokResult = tokenize(src);
        if (tokResult.ok) {
          parse(tokResult.value);
        }
        // If tokenize fails, that's fine — we're testing parse doesn't throw
      } catch {
        threw = true;
      }
      expect(threw, `Expected no throw for input: ${JSON.stringify(src)}`).toBe(false);
    }
  });
});
