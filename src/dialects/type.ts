import { Operator, SqlResult, CompilerContext } from '../types';

export interface Dialect {
  /**
   * Get parameter placeholder for the given index (1-based)
   * e.g. $1, ?, @p1
   */
  getParamPlaceholder(index: number): string;

  /**
   * Handle basic comparison operators: eq, ne, gt, gte, lt, lte
   */
  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult;

  /**
   * Handle 'between' and 'not_between' operators
   */
  handleBetween(
    operator: Operator,
    column: string,
    values: [unknown, unknown],
    context: CompilerContext,
  ): SqlResult;

  /**
   * Handle 'is_null' and 'is_not_null' operators
   */
  handleNullCheck(operator: Operator, column: string): SqlResult;

  /**
   * Handle array operators: in, not_in, contains, contained_by, overlaps
   */
  handleArray(
    operator: Operator,
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult;

  /**
   * Handle any_of / not_any_of operators
   */
  handleAnyOf(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult;

  /**
   * Handle string operators: like, ilike, starts_with, ends_with, contains, regex
   */
  handleString(
    operator: Operator,
    column: string,
    value: string,
    context: CompilerContext,
    caseSensitive?: boolean,
  ): SqlResult;

  /**
   * Quote an identifier (table or column name)
   */
  quoteIdentifier(key: string): string;
}
