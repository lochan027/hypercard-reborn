import type {
  Expr,
  Stmt,
  HandlerDecl,
} from './ast';

// ── Expression printer ────────────────────────────────────────────────────────

export function printExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'NumberLit':
      return String(expr.value);
    case 'StringLit':
      return '"' + expr.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    case 'VarRef':
      return expr.name;
    case 'FieldRef':
      return `field "${expr.name}"`;
    case 'ButtonRef':
      return `button "${expr.name}"`;
    case 'BinOp':
      return `(${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)})`;
  }
}

// ── Statement printer ─────────────────────────────────────────────────────────

export function printStmt(stmt: Stmt, depth: number): string {
  const pad = '  '.repeat(depth);

  switch (stmt.kind) {
    case 'HandlerDecl': {
      const body = stmt.body.map((s) => printStmt(s, depth + 1)).join('\n');
      return `${pad}on ${stmt.name}\n${body}\n${pad}end ${stmt.name}`;
    }
    case 'PutStmt':
      return `${pad}put ${printExpr(stmt.expr)} into ${printExpr(stmt.container)}`;
    case 'GetStmt':
      return `${pad}get ${printExpr(stmt.expr)}`;
    case 'IfStmt': {
      const thenBody = stmt.then.map((s) => printStmt(s, depth + 1)).join('\n');
      if (stmt.else_.length > 0) {
        const elseBody = stmt.else_.map((s) => printStmt(s, depth + 1)).join('\n');
        return `${pad}if ${printExpr(stmt.cond)} then\n${thenBody}\n${pad}else\n${elseBody}\n${pad}end if`;
      }
      return `${pad}if ${printExpr(stmt.cond)} then\n${thenBody}\n${pad}end if`;
    }
    case 'RepeatStmt': {
      const body = stmt.body.map((s) => printStmt(s, depth + 1)).join('\n');
      return `${pad}repeat ${printExpr(stmt.count)} times\n${body}\n${pad}end repeat`;
    }
    case 'GoToCardStmt':
      return `${pad}go to card ${printExpr(stmt.target)}`;
    case 'GoToNextStmt':
      return `${pad}go to next`;
    case 'GoPrevStmt':
      return `${pad}go to previous`;
    case 'AnswerStmt':
      return `${pad}answer ${printExpr(stmt.expr)}`;
  }
}

// ── Program printer ───────────────────────────────────────────────────────────

export function printProgram(handlers: HandlerDecl[]): string {
  return handlers.map((h) => printStmt(h, 0)).join('\n\n');
}
