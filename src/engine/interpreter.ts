import type {
  Expr,
  Stmt,
  HandlerDecl,
  PutStmt,
  GetStmt,
  IfStmt,
  RepeatStmt,
  GoToCardStmt,
  GoToNextStmt,
  GoPrevStmt,
  AnswerStmt,
} from './ast';
import type { Result, EngineError } from './result';
import { ok, err } from './result';

// ── Environment interface ─────────────────────────────────────────────────────

export interface Environment {
  getField(name: string): string;
  setField(name: string, value: string): void;
  getButton(name: string): string;
  setButton(name: string, value: string): void;
  goToCard(target: number | string): void;
  goToNext(): void;
  goToPrev(): void;
  showDialog(message: string): void;
}

// ── Interpreter result ────────────────────────────────────────────────────────

export type InterpreterResult =
  | { kind: 'ok' }
  | { kind: 'error'; error: EngineError }
  | { kind: 'stepLimitExceeded'; error: EngineError };

// ── Interpreter class ─────────────────────────────────────────────────────────

class Interpreter {
  private steps = 0;
  private locals = new Map<string, string>();
  private it = '';

  constructor(
    private readonly env: Environment,
    private readonly stepLimit: number = 10000,
  ) {}

  private checkLimit(line: number | null): InterpreterResult | null {
    this.steps++;
    if (this.steps > this.stepLimit) {
      return {
        kind: 'stepLimitExceeded',
        error: { message: 'Step limit exceeded', line },
      };
    }
    return null;
  }

  private evalExpr(expr: Expr): Result<string, EngineError> {
    switch (expr.kind) {
      case 'NumberLit':
        return ok(String(expr.value));

      case 'StringLit':
        return ok(expr.value);

      case 'VarRef':
        return ok(this.locals.get(expr.name) ?? '');

      case 'FieldRef':
        return ok(this.env.getField(expr.name));

      case 'ButtonRef':
        return ok(this.env.getButton(expr.name));

      case 'BinOp': {
        const leftResult = this.evalExpr(expr.left);
        if (!leftResult.ok) return leftResult;
        const rightResult = this.evalExpr(expr.right);
        if (!rightResult.ok) return rightResult;

        const lv = leftResult.value;
        const rv = rightResult.value;

        switch (expr.op) {
          case '&':
            return ok(lv + rv);

          case '=':
            return ok(lv === rv ? 'true' : 'false');

          case '<':
            return ok(parseFloat(lv) < parseFloat(rv) ? 'true' : 'false');

          case '>':
            return ok(parseFloat(lv) > parseFloat(rv) ? 'true' : 'false');

          case '+': {
            const result = parseFloat(lv) + parseFloat(rv);
            if (isNaN(result)) return err('Not a number in arithmetic expression', null);
            return ok(String(result));
          }

          case '-': {
            const result = parseFloat(lv) - parseFloat(rv);
            if (isNaN(result)) return err('Not a number in arithmetic expression', null);
            return ok(String(result));
          }

          case '*': {
            const result = parseFloat(lv) * parseFloat(rv);
            if (isNaN(result)) return err('Not a number in arithmetic expression', null);
            return ok(String(result));
          }

          case '/': {
            const divisor = parseFloat(rv);
            if (isNaN(parseFloat(lv))) return err('Not a number in arithmetic expression', null);
            if (divisor === 0) return err('Division by zero', null);
            const result = parseFloat(lv) / divisor;
            if (isNaN(result)) return err('Not a number in arithmetic expression', null);
            return ok(String(result));
          }
        }
      }
    }
  }

  private execStmt(stmt: Stmt): InterpreterResult {
    const limitResult = this.checkLimit('line' in stmt ? stmt.line : null);
    if (limitResult !== null) return limitResult;

    switch (stmt.kind) {
      case 'HandlerDecl': {
        // Nested handler declarations are treated as no-ops during execution
        return { kind: 'ok' };
      }

      case 'PutStmt': {
        const s = stmt as PutStmt;
        const valResult = this.evalExpr(s.expr);
        if (!valResult.ok) return { kind: 'error', error: valResult.error };
        const val = valResult.value;

        const container = s.container;
        if (container.kind === 'VarRef') {
          this.locals.set(container.name, val);
        } else if (container.kind === 'FieldRef') {
          this.env.setField(container.name, val);
        } else {
          this.env.setButton(container.name, val);
        }
        return { kind: 'ok' };
      }

      case 'GetStmt': {
        const s = stmt as GetStmt;
        const valResult = this.evalExpr(s.expr);
        if (!valResult.ok) return { kind: 'error', error: valResult.error };
        this.it = valResult.value;
        this.locals.set('it', this.it);
        return { kind: 'ok' };
      }

      case 'IfStmt': {
        const s = stmt as IfStmt;
        const condResult = this.evalExpr(s.cond);
        if (!condResult.ok) return { kind: 'error', error: condResult.error };

        const branch = condResult.value === 'true' ? s.then : s.else_;
        for (const bodyStmt of branch) {
          const result = this.execStmt(bodyStmt);
          if (result.kind !== 'ok') return result;
        }
        return { kind: 'ok' };
      }

      case 'RepeatStmt': {
        const s = stmt as RepeatStmt;
        const countResult = this.evalExpr(s.count);
        if (!countResult.ok) return { kind: 'error', error: countResult.error };

        const count = Math.floor(parseFloat(countResult.value));
        if (isNaN(count)) return { kind: 'error', error: { message: 'Repeat count is not a number', line: s.line } };

        for (let i = 0; i < count; i++) {
          const limitResult = this.checkLimit(s.line);
          if (limitResult !== null) return limitResult;

          for (const bodyStmt of s.body) {
            const result = this.execStmt(bodyStmt);
            if (result.kind !== 'ok') return result;
          }
        }
        return { kind: 'ok' };
      }

      case 'GoToCardStmt': {
        const s = stmt as GoToCardStmt;
        const targetResult = this.evalExpr(s.target);
        if (!targetResult.ok) return { kind: 'error', error: targetResult.error };

        const raw = targetResult.value;
        const asNum = parseFloat(raw);
        this.env.goToCard(isNaN(asNum) ? raw : asNum);
        return { kind: 'ok' };
      }

      case 'GoToNextStmt': {
        this.env.goToNext();
        return { kind: 'ok' };
      }

      case 'GoPrevStmt': {
        this.env.goToPrev();
        return { kind: 'ok' };
      }

      case 'AnswerStmt': {
        const s = stmt as AnswerStmt;
        const valResult = this.evalExpr(s.expr);
        if (!valResult.ok) return { kind: 'error', error: valResult.error };
        this.env.showDialog(valResult.value);
        return { kind: 'ok' };
      }
    }
  }

  run(handlers: HandlerDecl[], handlerName: string): InterpreterResult {
    this.steps = 0;
    this.locals = new Map<string, string>();
    this.it = '';

    const handler = handlers.find((h) => h.name === handlerName);
    if (!handler) {
      return {
        kind: 'error',
        error: { message: `Handler '${handlerName}' not defined`, line: null },
      };
    }

    for (const stmt of handler.body) {
      const result = this.execStmt(stmt);
      if (result.kind !== 'ok') return result;
    }

    return { kind: 'ok' };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function interpret(
  handlers: HandlerDecl[],
  handlerName: string,
  env: Environment,
  stepLimit?: number,
): InterpreterResult {
  const interpreter = new Interpreter(env, stepLimit);
  return interpreter.run(handlers, handlerName);
}
