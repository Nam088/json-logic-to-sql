import type { CompilerContext, SqlResult } from '../types';

export interface LogicalOperatorResult extends SqlResult {
  conditionCount: number;
}

/**
 * Handle 'and' operator
 */
export function handleAnd(
  conditions: SqlResult[],
  _context: CompilerContext, // Reserved for future use
): LogicalOperatorResult {
  if (conditions.length === 0) {
    return { sql: '1=1', params: {}, conditionCount: 0 };
  }

  const sql = conditions
    .map((c) => `(${c.sql})`)
    .join(' AND ');

  const params: Record<string, unknown> = {};
  for (const c of conditions) {
    Object.assign(params, c.params);
  }

  return {
    sql: `(${sql})`,
    params,
    conditionCount: conditions.length,
  };
}

/**
 * Handle 'or' operator
 */
export function handleOr(
  conditions: SqlResult[],
  _context: CompilerContext, // Reserved for future use
): LogicalOperatorResult {
  if (conditions.length === 0) {
    return { sql: '1=0', params: {}, conditionCount: 0 };
  }

  const sql = conditions
    .map((c) => `(${c.sql})`)
    .join(' OR ');

  const params: Record<string, unknown> = {};
  for (const c of conditions) {
    Object.assign(params, c.params);
  }

  return {
    sql: `(${sql})`,
    params,
    conditionCount: conditions.length,
  };
}

/**
 * Handle '!' (not) operator
 */
export function handleNot(
  condition: SqlResult,
): SqlResult {
  return {
    sql: `NOT (${condition.sql})`,
    params: condition.params,
  };
}
