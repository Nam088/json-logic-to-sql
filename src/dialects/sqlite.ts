import { Operator, SqlResult, CompilerContext } from '../types';
import { BaseDialect } from './base';

export class SqliteDialect extends BaseDialect {
  name = 'sqlite';

  getParamPlaceholder(index: number): string {
    return '?';
  }

  handleString(
    operator: Operator,
    column: string,
    value: string,
    context: CompilerContext,
    caseSensitive: boolean = false,
  ): SqlResult {
    const paramIndex = context.paramIndex;
    context.paramIndex++;
    const key = `p${paramIndex}`;
    
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
        sqlOperator = 'LIKE';
        paramValue = value;
        break;
      case 'ilike':
        sqlOperator = 'LIKE'; // SQLite LIKE is case insensitive for ASCII
        paramValue = value;
        break;
      case 'regex':
        sqlOperator = 'REGEXP'; // Requires extension or user function
        paramValue = value;
        break;
      default:
        throw new Error(`Unknown string operator: ${operator}`);
    }

    return {
      sql: `${column} ${sqlOperator} ?`,
      params: { [key]: paramValue },
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
        throw new Error(`Array operator '${operator}' is not supported in SQLite dialect`);
      default:
        throw new Error(`Operator ${operator} not supported in SQLite dialect`);
    }
  }

  // Override handleBetween to use correct param keys
  handleBetween(
    operator: Operator,
    column: string,
    values: [unknown, unknown],
    context: CompilerContext,
  ): SqlResult {
    const p1 = `p${context.paramIndex}`;
    context.paramIndex++;
    const p2 = `p${context.paramIndex}`;
    context.paramIndex++;

    const sqlOperator = operator === 'between' ? 'BETWEEN' : 'NOT BETWEEN';

    return {
      sql: `${column} ${sqlOperator} ? AND ?`,
      params: {
        [p1]: values[0],
        [p2]: values[1],
      },
    };
  }

  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    // Override to use ? and pN key mapping
    if (['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(operator)) {
        const paramIndex = context.paramIndex;
        context.paramIndex++;
        const key = `p${paramIndex}`;
        
        let sqlOperator: string;
        switch (operator) {
          case 'eq': sqlOperator = '='; break;
          case 'ne': sqlOperator = '<>'; break;
          case 'gt': sqlOperator = '>'; break;
          case 'gte': sqlOperator = '>='; break;
          case 'lt': sqlOperator = '<'; break;
          case 'lte': sqlOperator = '<='; break;
          default: sqlOperator = '=';
        }

        return {
          sql: `${column} ${sqlOperator} ?`,
          params: { [key]: value },
        };
    }
    
    if (['json_contains', 'json_has_key', 'json_has_any_keys'].includes(operator)) {
         throw new Error(`JSON operator '${operator}' is not supported in SQLite dialect`);
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
      const paramIndex = context.paramIndex;
      context.paramIndex++;
      const key = `p${paramIndex}`;
      placeholders.push('?');
      params[key] = value;
    }

    const sqlOperator = operator === 'in' ? 'IN' : 'NOT IN';
    
    return {
      sql: `${column} ${sqlOperator} (${placeholders.join(', ')})`,
      params,
    };
  }

  private escapeLike(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }
}
