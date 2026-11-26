import { type Result, ok, err } from './result';
import type { EngineError } from './result';
import type { Token, TokenKind } from './tokenizer';
import type {
  Expr,
  Stmt,
  Container,
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
} from './ast';

class Parser {
  tokens: Token[];
  pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private expect(kind: TokenKind): Result<Token, EngineError> {
    const token = this.peek();
    if (token.kind === kind) {
      this.advance();
      return ok(token);
    }
    return err(`Expected ${kind} but got ${token.kind}`, token.line);
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  parseProgram(): Result<HandlerDecl[], EngineError> {
    const handlers: HandlerDecl[] = [];
    this.skipNewlines();

    while (!this.check('EOF')) {
      const result = this.parseHandler();
      if (!result.ok) return result;
      handlers.push(result.value);
      this.skipNewlines();
    }

    return ok(handlers);
  }

  parseHandler(): Result<HandlerDecl, EngineError> {
    const onToken = this.expect('ON');
    if (!onToken.ok) return onToken;
    const line = onToken.value.line;

    const nameToken = this.expect('IDENT');
    if (!nameToken.ok) return nameToken;
    const name = nameToken.value.value;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    const body: Stmt[] = [];
    this.skipNewlines();

    while (!this.check('END') && !this.check('EOF')) {
      const stmt = this.parseStmt();
      if (!stmt.ok) return stmt;
      body.push(stmt.value);
      this.skipNewlines();
    }

    const endToken = this.expect('END');
    if (!endToken.ok) return endToken;

    const endName = this.expect('IDENT');
    if (!endName.ok) return endName;

    if (endName.value.value !== name) {
      return err(
        `Expected 'end ${name}' but got 'end ${endName.value.value}'`,
        endName.value.line,
      );
    }

    const endNl = this.expect('NEWLINE');
    if (!endNl.ok) return endNl;

    const handler: HandlerDecl = { kind: 'HandlerDecl', name, body, line };
    return ok(handler);
  }

  parseStmt(): Result<Stmt, EngineError> {
    this.skipNewlines();
    const token = this.peek();

    switch (token.kind) {
      case 'PUT':
        return this.parsePut();
      case 'GET':
        return this.parseGet();
      case 'IF':
        return this.parseIf();
      case 'REPEAT':
        return this.parseRepeat();
      case 'GO':
        return this.parseGo();
      case 'ANSWER':
        return this.parseAnswer();
      default:
        return err(`Unexpected token '${token.value}' in statement`, token.line);
    }
  }

  private parsePut(): Result<PutStmt, EngineError> {
    const putToken = this.expect('PUT');
    if (!putToken.ok) return putToken;
    const line = putToken.value.line;

    const expr = this.parseExpr();
    if (!expr.ok) return expr;

    const into = this.expect('INTO');
    if (!into.ok) return into;

    const container = this.parseContainer();
    if (!container.ok) return container;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    return ok<PutStmt>({ kind: 'PutStmt', expr: expr.value, container: container.value, line });
  }

  private parseGet(): Result<GetStmt, EngineError> {
    const getToken = this.expect('GET');
    if (!getToken.ok) return getToken;
    const line = getToken.value.line;

    const expr = this.parseExpr();
    if (!expr.ok) return expr;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    return ok<GetStmt>({ kind: 'GetStmt', expr: expr.value, line });
  }

  private parseIf(): Result<IfStmt, EngineError> {
    const ifToken = this.expect('IF');
    if (!ifToken.ok) return ifToken;
    const line = ifToken.value.line;

    const cond = this.parseExpr();
    if (!cond.ok) return cond;

    const then = this.expect('THEN');
    if (!then.ok) return then;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    this.skipNewlines();

    const thenBody: Stmt[] = [];
    while (!this.check('ELSE') && !this.check('END') && !this.check('EOF')) {
      const stmt = this.parseStmt();
      if (!stmt.ok) return stmt;
      thenBody.push(stmt.value);
      this.skipNewlines();
    }

    const elseBody: Stmt[] = [];
    if (this.check('ELSE')) {
      this.advance(); // consume ELSE
      const elseNl = this.expect('NEWLINE');
      if (!elseNl.ok) return elseNl;
      this.skipNewlines();

      while (!this.check('END') && !this.check('EOF')) {
        const stmt = this.parseStmt();
        if (!stmt.ok) return stmt;
        elseBody.push(stmt.value);
        this.skipNewlines();
      }
    }

    const endToken = this.expect('END');
    if (!endToken.ok) return endToken;

    const ifIdent = this.expect('IF');
    if (!ifIdent.ok) return ifIdent;

    const endNl = this.expect('NEWLINE');
    if (!endNl.ok) return endNl;

    return ok<IfStmt>({ kind: 'IfStmt', cond: cond.value, then: thenBody, else_: elseBody, line });
  }

  private parseRepeat(): Result<RepeatStmt, EngineError> {
    const repeatToken = this.expect('REPEAT');
    if (!repeatToken.ok) return repeatToken;
    const line = repeatToken.value.line;

    const count = this.parseExpr();
    if (!count.ok) return count;

    const times = this.expect('TIMES');
    if (!times.ok) return times;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    this.skipNewlines();

    const body: Stmt[] = [];
    while (!this.check('END') && !this.check('EOF')) {
      const stmt = this.parseStmt();
      if (!stmt.ok) return stmt;
      body.push(stmt.value);
      this.skipNewlines();
    }

    const endToken = this.expect('END');
    if (!endToken.ok) return endToken;

    const repeatIdent = this.expect('REPEAT');
    if (!repeatIdent.ok) return repeatIdent;

    const endNl = this.expect('NEWLINE');
    if (!endNl.ok) return endNl;

    return ok<RepeatStmt>({ kind: 'RepeatStmt', count: count.value, body, line });
  }

  private parseGo(): Result<GoToCardStmt | GoToNextStmt | GoPrevStmt, EngineError> {
    const goToken = this.expect('GO');
    if (!goToken.ok) return goToken;
    const line = goToken.value.line;

    const to = this.expect('TO');
    if (!to.ok) return to;

    if (this.check('NEXT')) {
      this.advance();
      const nl = this.expect('NEWLINE');
      if (!nl.ok) return nl;
      return ok<GoToNextStmt>({ kind: 'GoToNextStmt', line });
    }

    if (this.check('PREVIOUS')) {
      this.advance();
      const nl = this.expect('NEWLINE');
      if (!nl.ok) return nl;
      return ok<GoPrevStmt>({ kind: 'GoPrevStmt', line });
    }

    const card = this.expect('CARD');
    if (!card.ok) return card;

    const target = this.parseExpr();
    if (!target.ok) return target;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    return ok<GoToCardStmt>({ kind: 'GoToCardStmt', target: target.value, line });
  }

  private parseAnswer(): Result<AnswerStmt, EngineError> {
    const answerToken = this.expect('ANSWER');
    if (!answerToken.ok) return answerToken;
    const line = answerToken.value.line;

    const expr = this.parseExpr();
    if (!expr.ok) return expr;

    const nl = this.expect('NEWLINE');
    if (!nl.ok) return nl;

    return ok<AnswerStmt>({ kind: 'AnswerStmt', expr: expr.value, line });
  }

  parseContainer(): Result<Container, EngineError> {
    const token = this.peek();

    if (token.kind === 'FIELD') {
      this.advance();
      const name = this.expect('STRING');
      if (!name.ok) return name;
      return ok<FieldRef>({ kind: 'FieldRef', name: name.value.value });
    }

    if (token.kind === 'BUTTON') {
      this.advance();
      const name = this.expect('STRING');
      if (!name.ok) return name;
      return ok<ButtonRef>({ kind: 'ButtonRef', name: name.value.value });
    }

    if (token.kind === 'IDENT') {
      this.advance();
      return ok<VarRef>({ kind: 'VarRef', name: token.value });
    }

    return err(`Expected container (field, button, or variable) but got '${token.value}'`, token.line);
  }

  // Level 1: comparison operators (=, <, >)
  parseExpr(): Result<Expr, EngineError> {
    return this.parseLevel1();
  }

  private parseLevel1(): Result<Expr, EngineError> {
    const left = this.parseLevel2();
    if (!left.ok) return left;

    let result: Expr = left.value;

    while (this.check('EQ') || this.check('LT') || this.check('GT')) {
      const opToken = this.advance();
      const op = opToken.kind === 'EQ' ? '=' : opToken.kind === 'LT' ? '<' : '>';
      const right = this.parseLevel2();
      if (!right.ok) return right;
      result = { kind: 'BinOp', op, left: result, right: right.value } as BinOp;
    }

    return ok(result);
  }

  // Level 2: additive operators (+, -, &)
  private parseLevel2(): Result<Expr, EngineError> {
    const left = this.parseLevel3();
    if (!left.ok) return left;

    let result: Expr = left.value;

    while (this.check('PLUS') || this.check('MINUS') || this.check('AMP')) {
      const opToken = this.advance();
      const op = opToken.kind === 'PLUS' ? '+' : opToken.kind === 'MINUS' ? '-' : '&';
      const right = this.parseLevel3();
      if (!right.ok) return right;
      result = { kind: 'BinOp', op, left: result, right: right.value } as BinOp;
    }

    return ok(result);
  }

  // Level 3: multiplicative operators (*, /)
  private parseLevel3(): Result<Expr, EngineError> {
    const left = this.parsePrimary();
    if (!left.ok) return left;

    let result: Expr = left.value;

    while (this.check('STAR') || this.check('SLASH')) {
      const opToken = this.advance();
      const op = opToken.kind === 'STAR' ? '*' : '/';
      const right = this.parsePrimary();
      if (!right.ok) return right;
      result = { kind: 'BinOp', op, left: result, right: right.value } as BinOp;
    }

    return ok(result);
  }

  private parsePrimary(): Result<Expr, EngineError> {
    const token = this.peek();

    if (token.kind === 'LPAREN') {
      this.advance(); // consume (
      const expr = this.parseExpr();
      if (!expr.ok) return expr;
      const rparen = this.expect('RPAREN');
      if (!rparen.ok) return rparen;
      return ok(expr.value);
    }

    if (token.kind === 'NUMBER') {
      this.advance();
      return ok<NumberLit>({ kind: 'NumberLit', value: parseFloat(token.value) });
    }

    if (token.kind === 'STRING') {
      this.advance();
      return ok<StringLit>({ kind: 'StringLit', value: token.value });
    }

    if (token.kind === 'IDENT') {
      this.advance();
      return ok<VarRef>({ kind: 'VarRef', name: token.value });
    }

    if (token.kind === 'FIELD') {
      this.advance();
      const name = this.expect('STRING');
      if (!name.ok) return name;
      return ok<FieldRef>({ kind: 'FieldRef', name: name.value.value });
    }

    if (token.kind === 'BUTTON') {
      this.advance();
      const name = this.expect('STRING');
      if (!name.ok) return name;
      return ok<ButtonRef>({ kind: 'ButtonRef', name: name.value.value });
    }

    return err(`Unexpected token '${token.value}' in expression`, token.line);
  }
}

export function parse(tokens: Token[]): Result<HandlerDecl[], EngineError> {
  const parser = new Parser(tokens);
  return parser.parseProgram();
}
