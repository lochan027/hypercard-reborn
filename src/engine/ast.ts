// AST node interfaces for the HyperTalk engine.
// This file contains types only — no runtime code.

// ── Expression nodes ──────────────────────────────────────────────────────────

export interface NumberLit {
  kind: 'NumberLit';
  value: number;
}

export interface StringLit {
  kind: 'StringLit';
  value: string;
}

export interface VarRef {
  kind: 'VarRef';
  name: string;
}

export interface FieldRef {
  kind: 'FieldRef';
  name: string;
}

export interface ButtonRef {
  kind: 'ButtonRef';
  name: string;
}

export interface BinOp {
  kind: 'BinOp';
  op: '+' | '-' | '*' | '/' | '&' | '=' | '<' | '>';
  left: Expr;
  right: Expr;
}

export type Expr = NumberLit | StringLit | VarRef | FieldRef | ButtonRef | BinOp;

// ── Container (write targets) ─────────────────────────────────────────────────

export type Container = VarRef | FieldRef | ButtonRef;

// ── Statement nodes ───────────────────────────────────────────────────────────

export interface HandlerDecl {
  kind: 'HandlerDecl';
  name: string;
  body: Stmt[];
  line: number;
}

export interface PutStmt {
  kind: 'PutStmt';
  expr: Expr;
  container: Container;
  line: number;
}

export interface GetStmt {
  kind: 'GetStmt';
  expr: Expr;
  line: number;
}

export interface IfStmt {
  kind: 'IfStmt';
  cond: Expr;
  then: Stmt[];
  else_: Stmt[];
  line: number;
}

export interface RepeatStmt {
  kind: 'RepeatStmt';
  count: Expr;
  body: Stmt[];
  line: number;
}

export interface GoToCardStmt {
  kind: 'GoToCardStmt';
  target: Expr;
  line: number;
}

export interface GoToNextStmt {
  kind: 'GoToNextStmt';
  line: number;
}

export interface GoPrevStmt {
  kind: 'GoPrevStmt';
  line: number;
}

export interface AnswerStmt {
  kind: 'AnswerStmt';
  expr: Expr;
  line: number;
}

export type Stmt =
  | HandlerDecl
  | PutStmt
  | GetStmt
  | IfStmt
  | RepeatStmt
  | GoToCardStmt
  | GoToNextStmt
  | GoPrevStmt
  | AnswerStmt;
