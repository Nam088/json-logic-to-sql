import { Operator, SqlResult, CompilerContext } from '../types';
import { Dialect, PlaceholderStyle } from './type';

export abstract class BaseDialect implements Dialect {
  abstract name: string;
  protected abstract defaultPlaceholderStyle: PlaceholderStyle;
  protected _placeholderStyle?: PlaceholderStyle;

  setPlaceholderStyle(style: PlaceholderStyle): void {
    this._placeholderStyle = style;
  }

  protected get placeholderStyle(): PlaceholderStyle {
    return this._placeholderStyle ?? this.defaultPlaceholderStyle;
  }

  getParamPlaceholder(index: number): string {
    switch (this.placeholderStyle) {
      case 'question':
        return '?';
      case 'at':
        return `@p${index}`;
      case 'dollar':
      default:
        return `$${index}`;
    }
  }

  /**
   * Get a unique key for storing params in the params object.
   * Always uses unique keys (p1, p2, etc.) regardless of placeholder style.
   */
  getParamKey(index: number): string {
    return `p${index}`;
  }

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
    const placeholder = this.getParamPlaceholder(context.paramIndex);
    const paramKey = this.getParamKey(context.paramIndex);
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
      sql: `${column} ${sqlOperator} ${placeholder}`,
      params: { [paramKey]: value },
    };
  }

  handleBetween(
    operator: Operator,
    column: string,
    values: [unknown, unknown],
    context: CompilerContext,
  ): SqlResult {
    const placeholder1 = this.getParamPlaceholder(context.paramIndex);
    const paramKey1 = this.getParamKey(context.paramIndex);
    context.paramIndex++;
    const placeholder2 = this.getParamPlaceholder(context.paramIndex);
    const paramKey2 = this.getParamKey(context.paramIndex);
    context.paramIndex++;

    const sqlOperator = operator === 'between' ? 'BETWEEN' : 'NOT BETWEEN';

    return {
      sql: `${column} ${sqlOperator} ${placeholder1} AND ${placeholder2}`,
      params: {
        [paramKey1]: values[0],
        [paramKey2]: values[1],
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

  handleAnyIlike(
    column: string,
    value: string,
    context: CompilerContext,
  ): SqlResult {
    // Default implementation throws error - only PostgreSQL supports this
    // This uses EXISTS (SELECT 1 FROM unnest(column) AS x WHERE x ILIKE ?)
    throw new Error(`Operator 'any_ilike' not supported in ${this.name} dialect (PostgreSQL only)`);
  }
}
