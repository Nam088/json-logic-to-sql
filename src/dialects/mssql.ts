import { Operator, SqlResult, CompilerContext } from '../types';
import { BaseDialect } from './base';

export class MssqlDialect extends BaseDialect {
  name = 'mssql';
  protected defaultPlaceholderStyle = 'at' as const;

  quoteIdentifier(key: string): string {
    return `[${key}]`;
  }

  handleString(
    operator: Operator,
    column: string,
    value: string,
    context: CompilerContext,
    caseSensitive: boolean = false,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;

    let sqlOperator: string;
    let paramValue: string;

    switch (operator) {
      case 'starts_with':
        sqlOperator = 'LIKE';
        paramValue = `${this.escapeLike(value)}%`;
        break;
      case 'ends_with':
        sqlOperator = 'LIKE';
        paramValue = `%${this.escapeLike(value)}`;
        break;
      case 'contains':
        sqlOperator = 'LIKE';
        paramValue = `%${this.escapeLike(value)}%`;
        break;
      case 'like':
      case 'ilike': // MSSQL is collation dependent, usually case insensitive
        sqlOperator = 'LIKE';
        paramValue = value;
        break;
      case 'regex':
        throw new Error('Regex not supported in MSSQL');
      default:
        throw new Error(`Unknown string operator: ${operator}`);
    }

    return {
      sql: `${column} ${sqlOperator} ${param}`,
      params: { [param]: paramValue },
    };
  }

  handleArray(
    operator: Operator,
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    switch (operator) {
      case 'in':
      case 'not_in':
        return this.handleIn(operator, column, values, context);
      case 'contains':
      case 'contained_by':
      case 'overlaps':
        throw new Error(`Array operator '${operator}' is not supported in MSSQL dialect`);
      default:
        throw new Error(`Operator ${operator} not supported in MSSQL dialect`);
    }
  }

  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
     if (['json_contains', 'json_has_key', 'json_has_any_keys'].includes(operator)) {
         throw new Error(`JSON operator '${operator}' is not supported in MSSQL dialect`);
     }
     return super.handleComparison(operator, column, value, context);
  }

  private handleIn(
    operator: Operator,
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    if (values.length === 0) {
      return {
        sql: operator === 'in' ? '1=0' : '1=1',
        params: {},
      };
    }

    const params: Record<string, unknown> = {};
    const placeholders: string[] = [];

    for (const value of values) {
      const param = this.getParamPlaceholder(context.paramIndex);
      context.paramIndex++;
      placeholders.push(param);
      params[param] = value;
    }

    const sqlOperator = operator === 'in' ? 'IN' : 'NOT IN';
    
    return {
      sql: `${column} ${sqlOperator} (${placeholders.join(', ')})`,
      params,
    };
  }

  private escapeLike(value: string): string {
    // MSSQL uses brackets for escaping usually, but standard SQL escape works if ESCAPE keyword used?
    // Defaulting to standard backslash escaping might not work if ESCAPE not specified
    // Simplest: regex replace [ with [[]
    return value
      .replace(/\[/g, '[[]')
      .replace(/%/g, '[%]')
      .replace(/_/g, '[_]');
  }
}
