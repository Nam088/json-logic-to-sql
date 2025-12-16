import { Operator, SqlResult, CompilerContext } from '../types';
import { Dialect } from './type';

export abstract class BaseDialect implements Dialect {
  abstract name: string;
  abstract getParamPlaceholder(index: number): string;

  quoteIdentifier(key: string): string {
    return `"${key.replace(/"/g, '""')}"`;
  }

  abstract handleString(operator: Operator, column: string, value: string, context: CompilerContext, caseSensitive?: boolean): SqlResult;
  abstract handleArray(operator: Operator, column: string, values: unknown[], context: CompilerContext): SqlResult;

  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;

    let sqlOperator: string;
    switch (operator) {
      case 'eq': sqlOperator = '='; break;
      case 'ne': sqlOperator = '<>'; break;
      case 'gt': sqlOperator = '>'; break;
      case 'gte': sqlOperator = '>='; break;
      case 'lt': sqlOperator = '<'; break;
      case 'lte': sqlOperator = '<='; break;
      default: throw new Error(`Unknown comparison operator: ${operator}`);
    }

    return {
      sql: `${column} ${sqlOperator} ${param}`,
      params: { [param]: value },
    };
  }

  handleBetween(
    operator: Operator,
    column: string,
    values: [unknown, unknown],
    context: CompilerContext,
  ): SqlResult {
    const param1 = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;
    const param2 = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;

    const sqlOperator = operator === 'between' ? 'BETWEEN' : 'NOT BETWEEN';

    return {
      sql: `${column} ${sqlOperator} ${param1} AND ${param2}`,
      params: {
        [param1]: values[0],
        [param2]: values[1],
      },
    };
  }

  handleNullCheck(
    operator: Operator,
    column: string,
  ): SqlResult {
    const sqlOperator = operator === 'is_null' ? 'IS NULL' : 'IS NOT NULL';
    return {
      sql: `${column} ${sqlOperator}`,
      params: {},
    };
  }

  handleAnyOf(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    // Default implementation using = ANY or <> ALL which is specific to Postgres
    // Other dialects might override this or we need a generic fallback (not always possible without array type)
    // For now throwing error, specific dialects must implement if supported
    throw new Error(`Operator ${operator} not supported in ${this.name} dialect`);
  }
}
