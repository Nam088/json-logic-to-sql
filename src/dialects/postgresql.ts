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
        // For Knex (? placeholder), need to JSON.stringify array values
        // For PostgreSQL ($N placeholder), can use cast
        let paramValue: unknown = value;
        let castPlaceholder: string;

        if (placeholder === '?') {
          // Knex: convert array to JSON string, no cast needed (Knex handles it)
          if (Array.isArray(value)) {
            paramValue = JSON.stringify(value);
          }
          castPlaceholder = '?::jsonb';
        } else {
          // PostgreSQL native: use cast
          castPlaceholder = `${placeholder}::jsonb`;
        }

        return {
          sql: `${column} @> ${castPlaceholder}`,
          params: { [paramKey]: paramValue },
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

    // For JSONB, use EXISTS with jsonb_array_elements_text
    if (context.fieldType === 'jsonb') {
      if (!Array.isArray(value)) {
        throw new Error('any_of operator requires array value for JSONB fields');
      }

      // Build array literal for PostgreSQL
      const arrayPlaceholders: string[] = [];
      const params: Record<string, unknown> = {};

      for (let i = 0; i < value.length; i++) {
        const elemPlaceholder = this.getParamPlaceholder(context.paramIndex);
        const elemKey = this.getParamKey(context.paramIndex);
        context.paramIndex++;
        arrayPlaceholders.push(elemPlaceholder);
        params[elemKey] = value[i];
      }

      const arrayLiteral = `ARRAY[${arrayPlaceholders.join(', ')}]`;
      const sqlOp = operator === 'any_of' ? 'EXISTS' : 'NOT EXISTS';

      return {
        sql: `${sqlOp} (SELECT 1 FROM jsonb_array_elements_text(${column}) AS elem WHERE elem = ANY(${arrayLiteral}))`,
        params,
      };
    }

    // For PostgreSQL native arrays, use ANY/ALL
    const sqlOp = operator === 'any_of' ? '= ANY' : '<> ALL';
    return {
      sql: `${placeholder} ${sqlOp}(${column})`,
      params: { [paramKey]: value },
    };
  }

  /**
   * Handles ILIKE search on varchar[]/text[] array columns.
   * Generates: EXISTS (SELECT 1 FROM unnest(column) AS x WHERE x ILIKE ?)
   *
   * @param {string} column - Column name
   * @param {string} value - Search pattern (e.g., '%foo%')
   * @param {CompilerContext} context - Compiler context
   * @returns {SqlResult} SQL result with EXISTS clause
   */
  handleAnyIlike(
    operator: Operator,
    column: string,
    value: string,
    context: CompilerContext,
  ): SqlResult {
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;

    const existsOp = operator === 'any_ilike' ? 'EXISTS' : 'NOT EXISTS';

    return {
      sql: `${existsOp} (SELECT 1 FROM unnest(${column}) AS x WHERE x ILIKE ${placeholder})`,
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
    // If field is array or jsonb, map 'in' to 'overlaps' logic (checking intersection)
    if (context.fieldType && ['array', 'jsonb'].includes(context.fieldType)) {
      const result = this.handleOverlaps(column, values, context);

      // If operator is NOT IN, negate the condition
      if (operator === 'not_in') {
        return {
          sql: `NOT (${result.sql})`,
          params: result.params,
        };
      }

      return result;
    }

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

    let paramValue: unknown = values;
    let castPlaceholder: string;

    if (context.fieldType === 'jsonb') {
      // For JSONB columns, cast to JSONB
      if (placeholder === '?') {
        // Knex: convert array to JSON string
        paramValue = JSON.stringify(values);
        castPlaceholder = '?::jsonb';
      } else {
        // PostgreSQL native: use cast
        castPlaceholder = `${placeholder}::jsonb`;
      }
    } else {
      // PostgreSQL native array: no cast needed
      castPlaceholder = placeholder;
    }

    return {
      sql: `${column} @> ${castPlaceholder}`,
      params: { [paramKey]: paramValue },
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

    let paramValue: unknown = values;
    let castPlaceholder: string;

    if (context.fieldType === 'jsonb') {
      // For JSONB columns, cast to JSONB
      if (placeholder === '?') {
        // Knex: convert array to JSON string
        paramValue = JSON.stringify(values);
        castPlaceholder = '?::jsonb';
      } else {
        // PostgreSQL native: use cast
        castPlaceholder = `${placeholder}::jsonb`;
      }
    } else {
      // PostgreSQL native array: no cast needed
      castPlaceholder = placeholder;
    }

    return {
      sql: `${column} <@ ${castPlaceholder}`,
      params: { [paramKey]: paramValue },
    };
  }

  private handleOverlaps(
    column: string,
    values: unknown[],
    context: CompilerContext,
  ): SqlResult {
    // For JSONB, use EXISTS with jsonb_array_elements_text (same as any_of)
    if (context.fieldType === 'jsonb') {
      // Build array literal for PostgreSQL
      const arrayPlaceholders: string[] = [];
      const params: Record<string, unknown> = {};

      for (let i = 0; i < values.length; i++) {
        const elemPlaceholder = this.getParamPlaceholder(context.paramIndex);
        const elemKey = this.getParamKey(context.paramIndex);
        context.paramIndex++;
        arrayPlaceholders.push(elemPlaceholder);
        params[elemKey] = values[i];
      }

      const arrayLiteral = `ARRAY[${arrayPlaceholders.join(', ')}]`;

      return {
        sql: `EXISTS (SELECT 1 FROM jsonb_array_elements_text(${column}) AS elem WHERE elem = ANY(${arrayLiteral}))`,
        params,
      };
    }

    // For PostgreSQL native arrays, use && operator
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
    context.paramIndex++;

    return {
      sql: `${column} && ${placeholder}`,
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
