import { Operator, SqlResult, CompilerContext } from '../types';
import { BaseDialect } from './base';

export class PostgresDialect extends BaseDialect {
  name = 'postgresql';
  protected defaultPlaceholderStyle = 'dollar' as const;

  handleComparison(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    // Handle JSON operators
    switch (operator) {
      case 'json_contains':
        // For JSONB, cast parameter to JSONB
        const placeholder = this.getParamPlaceholder(context.paramIndex);
        const paramKey = this.getParamKey(context.paramIndex);
        context.paramIndex++;
        // Cast to JSONB for proper type handling (json_contains is always for JSONB)
        const castPlaceholder = placeholder === '?' ? '?::jsonb' : `${placeholder}::jsonb`;
        return {
          sql: `${column} @> ${castPlaceholder}`,
          params: { [paramKey]: value },
        };
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
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;
    return {
      sql: `${column} ${sqlOp} ${placeholder}`,
      params: { [paramKey]: value },
    };
  }

  handleAnyOf(
    operator: Operator,
    column: string,
    value: unknown,
    context: CompilerContext,
  ): SqlResult {
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;
    const sqlOp = operator === 'any_of' ? '= ANY' : '<> ALL';
    return {
      sql: `${placeholder} ${sqlOp}(${column})`,
      params: { [paramKey]: value },
    };
  }

  handleString(
    operator: Operator,
    column: string,
    value: string,
    context: CompilerContext,
    caseSensitive: boolean = false,
  ): SqlResult {
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
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
      sql: `${column} ${sqlOperator} ${placeholder}`,
      params: { [paramKey]: paramValue },
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
      const placeholder = this.getParamPlaceholder(context.paramIndex);
      const paramKey = this.getParamKey(context.paramIndex);
      context.paramIndex++;
      placeholders.push(placeholder);
      params[paramKey] = value;
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
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;
    // Cast to JSONB only for JSONB columns, not PostgreSQL native arrays
    const castPlaceholder = context.fieldType === 'jsonb'
      ? (placeholder === '?' ? '?::jsonb' : `${placeholder}::jsonb`)
      : placeholder;
    return {
      sql: `${column} @> ${castPlaceholder}`,
      params: { [paramKey]: values },
    };
  }

  private handleContainedBy(
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;
    // Cast to JSONB only for JSONB columns, not PostgreSQL native arrays
    const castPlaceholder = context.fieldType === 'jsonb'
      ? (placeholder === '?' ? '?::jsonb' : `${placeholder}::jsonb`)
      : placeholder;
    return {
      sql: `${column} <@ ${castPlaceholder}`,
      params: { [paramKey]: values },
    };
  }

  private handleOverlaps(
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;
    // Cast to JSONB only for JSONB columns, not PostgreSQL native arrays
    const castPlaceholder = context.fieldType === 'jsonb'
      ? (placeholder === '?' ? '?::jsonb' : `${placeholder}::jsonb`)
      : placeholder;
    return {
      sql: `${column} && ${castPlaceholder}`,
      params: { [paramKey]: values },
    };
  }

  private escapeLike(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }
}
