import type { Operator, SqlResult, CompilerContext } from '../types';
import { OPERATOR_TO_SQL } from './index';

/**
 * Handle comparison operators: eq, ne, gt, gte, lt, lte
 */
export function handleComparison(
  operator: Operator,
  column: string,
  value: unknown,
  context: CompilerContext,
): SqlResult {
  const paramName = context.paramIndex.toString();
  context.paramIndex++;

  const sqlOperator = OPERATOR_TO_SQL[operator];
  
  return {
    sql: `${column} ${sqlOperator} $${paramName}`,
    params: { [`$${paramName}`]: value },
  };
}

/**
 * Handle 'between' and 'not_between' operators
 */
export function handleBetween(
  operator: Operator,
  column: string,
  values: [unknown, unknown],
  context: CompilerContext,
): SqlResult {
  const param1 = context.paramIndex.toString();
  context.paramIndex++;
  const param2 = context.paramIndex.toString();
  context.paramIndex++;

  const sqlOperator = operator === 'between' ? 'BETWEEN' : 'NOT BETWEEN';

  return {
    sql: `${column} ${sqlOperator} $${param1} AND $${param2}`,
    params: {
      [`$${param1}`]: values[0],
      [`$${param2}`]: values[1],
    },
  };
}

/**
 * Handle 'is_null' and 'is_not_null' operators
 */
export function handleNullCheck(
  operator: Operator,
  column: string,
): SqlResult {
  const sqlOperator = operator === 'is_null' ? 'IS NULL' : 'IS NOT NULL';
  
  return {
    sql: `${column} ${sqlOperator}`,
    params: {},
  };
}
