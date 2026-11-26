import { describe, it, expect } from 'vitest';
import { printExpr, printStmt, printProgram } from '../printer';
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
  Stmt,
} from '../ast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const num = (value: number): NumberLit => ({ kind: 'NumberLit', value });
const str = (value: string): StringLit => ({ kind: 'StringLit', value });
const varRef = (name: string): VarRef => ({ kind: 'VarRef', name });
const fieldRef = (name: string): FieldRef => ({ kind: 'FieldRef', name });
const buttonRef = (name: string): ButtonRef => ({ kind: 'ButtonRef', name });
const binOp = (op: BinOp['op'], left: BinOp['left'], right: BinOp['right']): BinOp => ({
  kind: 'BinOp', op, left, right,
});

// ── printExpr ─────────────────────────────────────────────────────────────────

describe('printExpr', () => {
  it('NumberLit: integer', () => {
    expect(printExpr(num(42))).toBe('42');
  });

  it('NumberLit: decimal', () => {
    expect(printExpr(num(3.14))).toBe('3.14');
  });

  it('StringLit: plain string', () => {
    expect(printExpr(str('hello'))).toBe('"hello"');
  });

  it('StringLit: string containing a double-quote', () => {
    // value has a literal " — it should be escaped as \" in output
    expect(printExpr(str('say "hi"'))).toBe('"say \\"hi\\""');
  });

  it('StringLit: string containing a backslash', () => {
    expect(printExpr(str('a\\b'))).toBe('"a\\\\b"');
  });

  it('VarRef', () => {
    expect(printExpr(varRef('myVar'))).toBe('myVar');
  });

  it('FieldRef', () => {
    expect(printExpr(fieldRef('Title'))).toBe('field "Title"');
  });

  it('ButtonRef', () => {
    expect(printExpr(buttonRef('OK'))).toBe('button "OK"');
  });

  it('BinOp: addition', () => {
    expect(printExpr(binOp('+', num(1), num(2)))).toBe('(1 + 2)');
  });

  it('BinOp: each operator', () => {
    const ops: BinOp['op'][] = ['+', '-', '*', '/', '&', '=', '<', '>'];
    for (const op of ops) {
      expect(printExpr(binOp(op, num(1), num(2)))).toBe(`(1 ${op} 2)`);
    }
  });

  it('BinOp: nested expression', () => {
    // (1 + 2) * 3
    expect(printExpr(binOp('*', binOp('+', num(1), num(2)), num(3)))).toBe('((1 + 2) * 3)');
  });
});

// ── printStmt — each statement kind ──────────────────────────────────────────

describe('printStmt', () => {
  it('HandlerDecl: single-statement body', () => {
    const node: HandlerDecl = {
      kind: 'HandlerDecl',
      name: 'mouseUp',
      body: [{ kind: 'GetStmt', expr: num(1), line: 0 }],
      line: 0,
    };
    expect(printStmt(node, 0)).toBe('on mouseUp\n  get 1\nend mouseUp');
  });

  it('HandlerDecl: empty body', () => {
    const node: HandlerDecl = { kind: 'HandlerDecl', name: 'idle', body: [], line: 0 };
    expect(printStmt(node, 0)).toBe('on idle\n\nend idle');
  });

  it('PutStmt: into VarRef', () => {
    const node: PutStmt = {
      kind: 'PutStmt',
      expr: num(5),
      container: varRef('x'),
      line: 0,
    };
    expect(printStmt(node, 0)).toBe('put 5 into x');
  });

  it('PutStmt: into FieldRef', () => {
    const node: PutStmt = {
      kind: 'PutStmt',
      expr: str('hello'),
      container: fieldRef('Name'),
      line: 0,
    };
    expect(printStmt(node, 0)).toBe('put "hello" into field "Name"');
  });

  it('PutStmt: into ButtonRef', () => {
    const node: PutStmt = {
      kind: 'PutStmt',
      expr: str('OK'),
      container: buttonRef('Submit'),
      line: 0,
    };
    expect(printStmt(node, 0)).toBe('put "OK" into button "Submit"');
  });

  it('GetStmt', () => {
    const node: GetStmt = { kind: 'GetStmt', expr: varRef('score'), line: 0 };
    expect(printStmt(node, 0)).toBe('get score');
  });

  it('IfStmt: without else', () => {
    const node: IfStmt = {
      kind: 'IfStmt',
      cond: binOp('=', varRef('x'), num(1)),
      then: [{ kind: 'GetStmt', expr: num(0), line: 0 }],
      else_: [],
      line: 0,
    };
    expect(printStmt(node, 0)).toBe('if (x = 1) then\n  get 0\nend if');
  });

  it('IfStmt: with else', () => {
    const node: IfStmt = {
      kind: 'IfStmt',
      cond: binOp('>', varRef('a'), num(0)),
      then: [{ kind: 'AnswerStmt', expr: str('yes'), line: 0 }],
      else_: [{ kind: 'AnswerStmt', expr: str('no'), line: 0 }],
      line: 0,
    };
    expect(printStmt(node, 0)).toBe(
      'if (a > 0) then\n  answer "yes"\nelse\n  answer "no"\nend if',
    );
  });

  it('RepeatStmt', () => {
    const node: RepeatStmt = {
      kind: 'RepeatStmt',
      count: num(3),
      body: [{ kind: 'GetStmt', expr: num(0), line: 0 }],
      line: 0,
    };
    expect(printStmt(node, 0)).toBe('repeat 3 times\n  get 0\nend repeat');
  });

  it('GoToCardStmt: expression target', () => {
    const node: GoToCardStmt = { kind: 'GoToCardStmt', target: num(2), line: 0 };
    expect(printStmt(node, 0)).toBe('go to card 2');
  });

  it('GoToNextStmt', () => {
    const node: GoToNextStmt = { kind: 'GoToNextStmt', line: 0 };
    expect(printStmt(node, 0)).toBe('go to next');
  });

  it('GoPrevStmt', () => {
    const node: GoPrevStmt = { kind: 'GoPrevStmt', line: 0 };
    expect(printStmt(node, 0)).toBe('go to previous');
  });

  it('AnswerStmt', () => {
    const node: AnswerStmt = { kind: 'AnswerStmt', expr: str('Hello'), line: 0 };
    expect(printStmt(node, 0)).toBe('answer "Hello"');
  });
});

// ── Indentation ───────────────────────────────────────────────────────────────

describe('indentation', () => {
  it('IfStmt body is indented 2 spaces per level at depth 0', () => {
    const inner: GetStmt = { kind: 'GetStmt', expr: num(1), line: 0 };
    const node: IfStmt = {
      kind: 'IfStmt',
      cond: num(1),
      then: [inner],
      else_: [],
      line: 0,
    };
    const output = printStmt(node, 0);
    expect(output).toContain('\n  get 1\n');
  });

  it('IfStmt body is indented 4 spaces when nested at depth 1', () => {
    const inner: GetStmt = { kind: 'GetStmt', expr: num(1), line: 0 };
    const node: IfStmt = {
      kind: 'IfStmt',
      cond: num(1),
      then: [inner],
      else_: [],
      line: 0,
    };
    const output = printStmt(node, 1);
    // depth 1 → pad = "  ", body at depth 2 → "    "
    expect(output).toContain('\n    get 1\n');
  });

  it('RepeatStmt body is indented 2 additional spaces per level', () => {
    const inner: GetStmt = { kind: 'GetStmt', expr: num(0), line: 0 };
    const node: RepeatStmt = { kind: 'RepeatStmt', count: num(5), body: [inner], line: 0 };

    // At depth 0 → body at depth 1 → 2 spaces
    const output0 = printStmt(node, 0);
    expect(output0).toContain('\n  get 0\n');

    // At depth 1 → body at depth 2 → 4 spaces
    const output1 = printStmt(node, 1);
    expect(output1).toContain('\n    get 0\n');
  });

  it('nested IfStmt inside HandlerDecl produces 2-space increments each level', () => {
    const innerGet: GetStmt = { kind: 'GetStmt', expr: num(99), line: 0 };
    const ifNode: IfStmt = {
      kind: 'IfStmt',
      cond: num(1),
      then: [innerGet],
      else_: [],
      line: 0,
    };
    const handler: HandlerDecl = {
      kind: 'HandlerDecl',
      name: 'test',
      body: [ifNode],
      line: 0,
    };

    const output = printStmt(handler, 0);
    // handler body at depth 1 → "  if ..."
    // if body at depth 2 → "    get 99"
    expect(output).toContain('\n  if 1 then\n    get 99\n  end if\n');
  });
});

// ── printProgram ──────────────────────────────────────────────────────────────

describe('printProgram', () => {
  it('two handlers are separated by a blank line', () => {
    const h1: HandlerDecl = {
      kind: 'HandlerDecl',
      name: 'mouseUp',
      body: [],
      line: 0,
    };
    const h2: HandlerDecl = {
      kind: 'HandlerDecl',
      name: 'idle',
      body: [],
      line: 0,
    };
    const output = printProgram([h1, h2]);
    // expect exactly one blank line between the two handlers
    expect(output).toContain('end mouseUp\n\non idle');
  });

  it('single handler is not surrounded by extra blank lines', () => {
    const h: HandlerDecl = {
      kind: 'HandlerDecl',
      name: 'mouseUp',
      body: [{ kind: 'GetStmt', expr: num(1), line: 0 }],
      line: 0,
    };
    const output = printProgram([h]);
    // printProgram joins with \n\n only between handlers — a single handler
    // must start with 'on' and end with 'end mouseUp' without leading/trailing \n\n
    expect(output.startsWith('on mouseUp')).toBe(true);
    expect(output.endsWith('end mouseUp')).toBe(true);
  });
});

// ── printStmt does not throw on any valid node ────────────────────────────────

describe('printStmt does not throw', () => {
  const allStmts: Stmt[] = [
    { kind: 'HandlerDecl', name: 'h', body: [], line: 0 },
    {
      kind: 'PutStmt',
      expr: num(1),
      container: varRef('x'),
      line: 0,
    },
    { kind: 'GetStmt', expr: num(1), line: 0 },
    {
      kind: 'IfStmt',
      cond: num(1),
      then: [],
      else_: [],
      line: 0,
    },
    { kind: 'RepeatStmt', count: num(1), body: [], line: 0 },
    { kind: 'GoToCardStmt', target: num(1), line: 0 },
    { kind: 'GoToNextStmt', line: 0 },
    { kind: 'GoPrevStmt', line: 0 },
    { kind: 'AnswerStmt', expr: str('hi'), line: 0 },
  ];

  for (const stmt of allStmts) {
    it(`does not throw for ${stmt.kind}`, () => {
      expect(() => printStmt(stmt, 0)).not.toThrow();
    });
  }
});
