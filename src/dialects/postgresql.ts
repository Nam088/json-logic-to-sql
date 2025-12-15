import { Operator, SqlResult, CompilerContext } from '../types';
import { BaseDialect } from './base';

export class PostgresDialect extends BaseDialect {
  name = 'postgresql';

  getParamPlaceholder(index: number): string {
    return `$${index}`;
  }

  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    // Handle JSON operators
    switch (operator) {
      case 'json_contains':
        return this.simpleOp(column, '@>', value, context);
      case 'json_has_key':
        return this.simpleOp(column, '?', value, context);
      case 'json_has_any_keys':
        return this.simpleOp(column, '?|', value, context);
      default:
        // Delegate to base for standard operators
        return super.handleComparison(operator, column, value, context);
    }
  }

  private simpleOp(
    column: string,
    sqlOp: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;
    return {
      sql: `${column} ${sqlOp} ${param}`,
      params: { [param]: value },
    };
  }

  handleAnyOf(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;
    const sqlOp = operator === 'any_of' ? '= ANY' : '<> ALL';
    return {
      sql: `${param} ${sqlOp}(${column})`,
      params: { [param]: value },
    };
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
        sqlOperator = caseSensitive ? 'LIKE' : 'ILIKE';
        paramValue = `${this.escapeLike(value)}%`;
        break;
      case 'ends_with':
        sqlOperator = caseSensitive ? 'LIKE' : 'ILIKE';
        paramValue = `%${this.escapeLike(value)}`;
        break;
      case 'contains':
        sqlOperator = caseSensitive ? 'LIKE' : 'ILIKE';
        paramValue = `%${this.escapeLike(value)}%`;
        break;
      case 'like':
        sqlOperator = 'LIKE';
        paramValue = value;
        break;
      case 'ilike':
        sqlOperator = 'ILIKE';
        paramValue = value;
        break;
      case 'regex':
        sqlOperator = caseSensitive ? '~' : '~*';
        paramValue = value;
        break;
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
        return this.handleArrayContains(column, values, context);
      case 'contained_by':
        return this.handleContainedBy(column, values, context);
      case 'overlaps':
        return this.handleOverlaps(column, values, context);
      default:
        throw new Error(`Unknown array operator: ${operator}`);
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

  private handleArrayContains(
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;
    return {
      sql: `${column} @> ${param}`,
      params: { [param]: values },
    };
  }

  private handleContainedBy(
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;
    return {
      sql: `${column} <@ ${param}`,
      params: { [param]: values },
    };
  }

  private handleOverlaps(
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    const param = this.getParamPlaceholder(context.paramIndex);
    context.paramIndex++;
    return {
      sql: `${column} && ${param}`,
      params: { [param]: values },
    };
  }

  private escapeLike(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }
}
