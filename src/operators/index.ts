import type { Operator } from '../types';

export interface OperatorResult {
  sql: string;
  params: Record<string, unknown>;
}

/**
 * Map JSON Logic operators to internal operators
 */
export const JSON_LOGIC_TO_OPERATOR: Record<string, Operator> = {
  '==': 'eq',
  '===': 'eq',
  '!=': 'ne',
  '!==': 'ne',
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
  'in': 'in',
  '!in': 'not_in',
};

/**
 * Map internal operators to SQL
 */
export const OPERATOR_TO_SQL: Record<Operator, string> = {
  eq: '=',
  ne: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'IN',
  not_in: 'NOT IN',
  contains: 'LIKE',
  contained_by: '<@',
  overlaps: '&&',
  any_of: '= ANY',
  not_any_of: '<> ALL',
  like: 'LIKE',
  ilike: 'ILIKE',
  starts_with: 'LIKE',
  ends_with: 'LIKE',
  regex: '~',
  is_null: 'IS NULL',
  is_not_null: 'IS NOT NULL',
  between: 'BETWEEN',
  not_between: 'NOT BETWEEN',
  json_contains: '@>',
  json_has_key: '?',
  json_has_any_keys: '?|',
};

/**
 * Operators that don't need a value
 */
export const UNARY_OPERATORS: Operator[] = ['is_null', 'is_not_null'];

/**
 * Operators that take two values (range)
 */
export const RANGE_OPERATORS: Operator[] = ['between', 'not_between'];

/**
 * Operators that take array values
 */
export const ARRAY_OPERATORS: Operator[] = ['in', 'not_in', 'overlaps', 'contained_by'];
