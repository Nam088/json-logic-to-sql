import { Operator, SqlResult, CompilerContext } from '../types';
import { BaseDialect } from './base';

export class MysqlDialect extends BaseDialect {
  name = 'mysql';

  getParamPlaceholder(index: number): string {
    return '?';
  }

  quoteIdentifier(key: string): string {
    return `\`${key}\``;
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
    // MySQL uses ? so we must use the key for result mapping

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
      case 'ilike': // MySQL LIKE is case insensitive by default (usually)
        sqlOperator = 'LIKE';
        paramValue = value;
        break;
      case 'regex':
        sqlOperator = 'REGEXP';
        paramValue = value;
        break;
      default:
        throw new Error(`Unknown string operator: ${operator}`);
    }

    // For case sensitivity, we might need BINARY operator in MySQL, 
    // but assuming default collation for now or user config.
    // If caseSensitive is true, we might want to prefix with BINARY?
    // Not implementing BINARY prefix for now to keep it simple.

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
        // Assuming column is JSON array
        return this.handleJsonContains(column, values, context);
      case 'contained_by':
      case 'overlaps':
        throw new Error(`Operator '${operator}' is not supported in MySQL dialect (requires PostgreSQL-style array operations)`);
      default:
        throw new Error(`Operator ${operator} not supported in MySQL dialect`);
    }
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
      // MySQL uses ? for all params, but our params map needs unique keys?
      // Actually SqlResult params is Record<string, unknown>.
      // If we return '?' we can't use it as key easily if we want named binding in result?
      // Wait, standard node mysql driver uses array for values, '?' in sql.
      // But our interface returns `params: Record<string, unknown>`.
      // The `compiler` aggregates these?
      // Currently `compiler.ts` returns `params: result.params`.
      // If `params` keys are `$1`, `$2`, it works for pg.
      // For mysql, we might need to return ordered array?
      // Or we name them 'p1', 'p2' internally and user needs to convert?
      // If we use '?' in SQL, the driver expects array.
      // But `paramStyle` config exists.
      
      // If we use '?' in SQL, we can't use named params in the `params` object to map back to the '?' position easily 
      // unless we assume order matches iteration order (which it does in JS objects mostly, but not guaranteed).
      
      // Better strategy for '?' dialects:
      // use a placeholder like `__p1__` temporarily? No.
      // The `SqlResult` interface implies named parameters or a map.
      // If the output SQL has `?`, the `params` object is useless for drivers that need array.
      // But if we return `params` map, we can reconstruct the array by sorting keys?
      
      // Let's assume we return mapped params (e.g. p1, p2) and the placeholder is `?`.
      // But `?` doesn't identify WHICH param.
      // So valid SQL loop: `?` corresponds to values in order.
      // Our CompilerContext tracks paramIndex.
      // So we can use that to order the values.
      
      const key = `p${context.paramIndex}`;
      context.paramIndex++;
      placeholders.push('?');
      params[key] = value;
    }

    const sqlOperator = operator === 'in' ? 'IN' : 'NOT IN';
    
    return {
      sql: `${column} ${sqlOperator} (${placeholders.join(', ')})`,
      params,
    };
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

  // Override to handle '?' placeholders 
  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    // Basic comparison
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
    
    // JSON operators
    // MySQL JSON_CONTAINS(target, candidate[, path])
    if (operator === 'json_contains') {
        const paramIndex = context.paramIndex;
        context.paramIndex++;
        const key = `p${paramIndex}`;
        // value should be JSON string or cast to JSON? 
        // usually passed as stringified JSON if using JSON_CONTAINS
        return {
            sql: `JSON_CONTAINS(${column}, ?)`,
            params: { [key]: value }
        };
    }
    
    return super.handleComparison(operator, column, value, context);
  }

  // Helper for JSON contains array
  private handleJsonContains(
      column: string,
      values: unknown[],
      context: CompilerContext,
  ): SqlResult {
      const paramIndex = context.paramIndex;
      context.paramIndex++;
      const key = `p${paramIndex}`;
      // values array -> json string
      const jsonValue = JSON.stringify(values);
      return {
          sql: `JSON_CONTAINS(${column}, ?)`,
          params: { [key]: jsonValue }
      };
  }

  private escapeLike(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }
}
