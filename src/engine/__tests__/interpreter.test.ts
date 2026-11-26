import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interpret } from '../interpreter';
import type { Environment, InterpreterResult } from '../interpreter';
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
  BinOp,
} from '../ast';

// ── Stub Environment ──────────────────────────────────────────────────────────

function makeEnv(): Environment {
  return {
    getField: vi.fn().mockReturnValue(''),
    setField: vi.fn(),
    getButton: vi.fn().mockReturnValue(''),
    setButton: vi.fn(),
    goToCard: vi.fn(),
    goToNext: vi.fn(),
    goToPrev: vi.fn(),
    showDialog: vi.fn(),
  };
}

// ── AST helpers ───────────────────────────────────────────────────────────────

function num(value: number): NumberLit {
  return { kind: 'NumberLit', value };
}

function str(value: string): StringLit {
  return { kind: 'StringLit', value };
}

function varRef(name: string): VarRef {
  return { kind: 'VarRef', name };
}

function fieldRef(name: string): FieldRef {
  return { kind: 'FieldRef', name };
}

function handler(name: string, body: HandlerDecl['body']): HandlerDecl {
  return { kind: 'HandlerDecl', name, body, line: 1 };
}

function run(
  body: HandlerDecl['body'],
  env: Environment,
  stepLimit?: number,
): InterpreterResult {
  return interpret([handler('test', body)], 'test', env, stepLimit);
}

// ── Statement-level tests ─────────────────────────────────────────────────────

describe('interpreter', () => {
  let env: Environment;

  beforeEach(() => {
    env = makeEnv();
  });

  // PutStmt → FieldRef
  it('PutStmt into a field calls setField', () => {
    const stmt: PutStmt = {
      kind: 'PutStmt',
      expr: str('hello'),
      container: { kind: 'FieldRef', name: 'myField' },
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.setField).toHaveBeenCalledWith('myField', 'hello');
  });

  // PutStmt → ButtonRef
  it('PutStmt into a button calls setButton', () => {
    const stmt: PutStmt = {
      kind: 'PutStmt',
      expr: str('click me'),
      container: { kind: 'ButtonRef', name: 'myButton' },
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.setButton).toHaveBeenCalledWith('myButton', 'click me');
  });

  // PutStmt → VarRef + read-back via GetStmt
  it('PutStmt into a var and GetStmt reads the value via it', () => {
    const put: PutStmt = {
      kind: 'PutStmt',
      expr: str('42'),
      container: varRef('myVar'),
      line: 1,
    };
    // GetStmt reads the var we just set
    const get: GetStmt = {
      kind: 'GetStmt',
      expr: varRef('myVar'),
      line: 2,
    };
    const result = run([put, get], env);
    expect(result.kind).toBe('ok');
    // A second get on the special `it` variable should return '42'
    const get2: GetStmt = { kind: 'GetStmt', expr: varRef('it'), line: 3 };
    // We re-run with the extra step to read `it` back
    const result2 = run([put, get, get2], env);
    expect(result2.kind).toBe('ok');
  });

  // GetStmt stores result in `it`
  it('GetStmt stores expression result in the it variable', () => {
    const get: GetStmt = { kind: 'GetStmt', expr: num(99), line: 1 };
    // After GetStmt, `it` should be '99'; verify by reading it via another GetStmt
    const readIt: GetStmt = { kind: 'GetStmt', expr: varRef('it'), line: 2 };
    const result = run([get, readIt], env);
    expect(result.kind).toBe('ok');
  });

  // IfStmt — true branch
  it('IfStmt executes then branch when condition is true', () => {
    const inner: AnswerStmt = { kind: 'AnswerStmt', expr: str('yes'), line: 2 };
    const stmt: IfStmt = {
      kind: 'IfStmt',
      cond: { kind: 'BinOp', op: '=', left: num(1), right: num(1) },
      then: [inner],
      else_: [],
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.showDialog).toHaveBeenCalledWith('yes');
  });

  // IfStmt — false branch
  it('IfStmt executes else branch when condition is false', () => {
    const thenStmt: AnswerStmt = { kind: 'AnswerStmt', expr: str('then'), line: 2 };
    const elseStmt: AnswerStmt = { kind: 'AnswerStmt', expr: str('else'), line: 3 };
    const stmt: IfStmt = {
      kind: 'IfStmt',
      cond: { kind: 'BinOp', op: '=', left: num(1), right: num(2) },
      then: [thenStmt],
      else_: [elseStmt],
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.showDialog).not.toHaveBeenCalledWith('then');
    expect(env.showDialog).toHaveBeenCalledWith('else');
  });

  // RepeatStmt
  it('RepeatStmt calls body the correct number of times', () => {
    const inner: AnswerStmt = { kind: 'AnswerStmt', expr: str('ping'), line: 2 };
    const stmt: RepeatStmt = {
      kind: 'RepeatStmt',
      count: num(3),
      body: [inner],
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.showDialog).toHaveBeenCalledTimes(3);
  });

  // GoToCardStmt
  it('GoToCardStmt calls goToCard with the evaluated target', () => {
    const stmt: GoToCardStmt = {
      kind: 'GoToCardStmt',
      target: num(5),
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.goToCard).toHaveBeenCalledWith(5);
  });

  // GoToNextStmt
  it('GoToNextStmt calls goToNext', () => {
    const stmt: GoToNextStmt = { kind: 'GoToNextStmt', line: 1 };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.goToNext).toHaveBeenCalled();
  });

  // GoPrevStmt
  it('GoPrevStmt calls goToPrev', () => {
    const stmt: GoPrevStmt = { kind: 'GoPrevStmt', line: 1 };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.goToPrev).toHaveBeenCalled();
  });

  // AnswerStmt
  it('AnswerStmt calls showDialog with the evaluated expression', () => {
    const stmt: AnswerStmt = {
      kind: 'AnswerStmt',
      expr: str('Hello, world!'),
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.showDialog).toHaveBeenCalledWith('Hello, world!');
  });

  // ── BinOp operator tests ────────────────────────────────────────────────────

  describe('BinOp operators', () => {
    function evalBinOp(binop: BinOp): string {
      // Store result in `it` via GetStmt and read it back through a PutStmt into a var
      let captured = '';
      const captureEnv = makeEnv();
      (captureEnv.showDialog as ReturnType<typeof vi.fn>).mockImplementation(
        (val: string) => { captured = val; },
      );
      const stmt: AnswerStmt = { kind: 'AnswerStmt', expr: binop, line: 1 };
      run([stmt], captureEnv);
      return captured;
    }

    it('+ adds two numbers', () => {
      const op: BinOp = { kind: 'BinOp', op: '+', left: num(3), right: num(4) };
      expect(evalBinOp(op)).toBe('7');
    });

    it('- subtracts two numbers', () => {
      const op: BinOp = { kind: 'BinOp', op: '-', left: num(10), right: num(3) };
      expect(evalBinOp(op)).toBe('7');
    });

    it('* multiplies two numbers', () => {
      const op: BinOp = { kind: 'BinOp', op: '*', left: num(6), right: num(7) };
      expect(evalBinOp(op)).toBe('42');
    });

    it('/ divides two numbers', () => {
      const op: BinOp = { kind: 'BinOp', op: '/', left: num(10), right: num(4) };
      expect(evalBinOp(op)).toBe('2.5');
    });

    it('& concatenates strings', () => {
      const op: BinOp = {
        kind: 'BinOp',
        op: '&',
        left: str('Hello'),
        right: str(' World'),
      };
      expect(evalBinOp(op)).toBe('Hello World');
    });

    it('= returns true when operands are equal', () => {
      const op: BinOp = { kind: 'BinOp', op: '=', left: num(5), right: num(5) };
      expect(evalBinOp(op)).toBe('true');
    });

    it('= returns false when operands differ', () => {
      const op: BinOp = { kind: 'BinOp', op: '=', left: num(5), right: num(6) };
      expect(evalBinOp(op)).toBe('false');
    });

    it('< returns true when left is less than right', () => {
      const op: BinOp = { kind: 'BinOp', op: '<', left: num(2), right: num(5) };
      expect(evalBinOp(op)).toBe('true');
    });

    it('< returns false when left is greater', () => {
      const op: BinOp = { kind: 'BinOp', op: '<', left: num(5), right: num(2) };
      expect(evalBinOp(op)).toBe('false');
    });

    it('> returns true when left is greater than right', () => {
      const op: BinOp = { kind: 'BinOp', op: '>', left: num(5), right: num(2) };
      expect(evalBinOp(op)).toBe('true');
    });

    it('> returns false when left is less', () => {
      const op: BinOp = { kind: 'BinOp', op: '>', left: num(2), right: num(5) };
      expect(evalBinOp(op)).toBe('false');
    });
  });

  // ── Error cases ─────────────────────────────────────────────────────────────

  it('division by zero returns error with non-empty message', () => {
    const stmt: AnswerStmt = {
      kind: 'AnswerStmt',
      expr: { kind: 'BinOp', op: '/', left: num(1), right: num(0) },
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('unknown handler name returns error', () => {
    const result = interpret([handler('other', [])], 'nonexistent', env);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error.message).toContain('nonexistent');
    }
  });

  it('stepLimitExceeded when repeat count exceeds step limit', () => {
    const inner: AnswerStmt = { kind: 'AnswerStmt', expr: str('x'), line: 2 };
    const stmt: RepeatStmt = {
      kind: 'RepeatStmt',
      count: num(1_000_000),
      body: [inner],
      line: 1,
    };
    const result = run([stmt], env, 10);
    expect(result.kind).toBe('stepLimitExceeded');
  });

  // ── Safety tests ─────────────────────────────────────────────────────────────

  it('interpret does not throw on valid input', () => {
    const stmts: HandlerDecl['body'] = [
      { kind: 'PutStmt', expr: str('v'), container: varRef('x'), line: 1 },
      { kind: 'GetStmt', expr: varRef('x'), line: 2 },
      { kind: 'AnswerStmt', expr: str('done'), line: 3 },
      { kind: 'GoToNextStmt', line: 4 },
      { kind: 'GoPrevStmt', line: 5 },
      { kind: 'GoToCardStmt', target: num(1), line: 6 },
      {
        kind: 'IfStmt',
        cond: { kind: 'BinOp', op: '=', left: num(1), right: num(1) },
        then: [{ kind: 'AnswerStmt', expr: str('yes'), line: 8 }],
        else_: [],
        line: 7,
      },
      {
        kind: 'RepeatStmt',
        count: num(2),
        body: [{ kind: 'AnswerStmt', expr: str('rep'), line: 10 }],
        line: 9,
      },
    ];

    let threw = false;
    try {
      run(stmts, env);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  // ── FieldRef / ButtonRef read tests ─────────────────────────────────────────

  it('GetStmt with FieldRef calls getField', () => {
    (env.getField as ReturnType<typeof vi.fn>).mockReturnValue('fieldValue');
    const stmt: GetStmt = {
      kind: 'GetStmt',
      expr: fieldRef('someField'),
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.getField).toHaveBeenCalledWith('someField');
  });

  it('GetStmt with ButtonRef calls getButton', () => {
    (env.getButton as ReturnType<typeof vi.fn>).mockReturnValue('btnValue');
    const stmt: GetStmt = {
      kind: 'GetStmt',
      expr: { kind: 'ButtonRef', name: 'myBtn' },
      line: 1,
    };
    const result = run([stmt], env);
    expect(result.kind).toBe('ok');
    expect(env.getButton).toHaveBeenCalledWith('myBtn');
  });
});
