import type {
  JsonLogicRule,
  JsonLogicVar,
  SqlResult,
  CompilerConfig,
  CompilerContext,
  Operator,
  FieldSchema,
  ComputedFieldSchema,
} from './types';
import { applyTransforms } from './utils/transforms';
import { SchemaValidator, SchemaValidationError } from './schema/validator';
import { sanitizeInput, escapeIdentifier } from './security/sanitizer';
import { JSON_LOGIC_TO_OPERATOR, UNARY_OPERATORS, RANGE_OPERATORS, ARRAY_OPERATORS } from './operators/index';
import { handleAnd, handleOr, handleNot } from './operators/logical';
import { handleComparison, handleBetween, handleNullCheck } from './operators/comparison';
import { handleString } from './operators/string';
import { handleArray } from './operators/array';

import { Dialect } from './dialects/type';
import { PostgresDialect } from './dialects/postgresql';
import { MysqlDialect } from './dialects/mysql';
import { MssqlDialect } from './dialects/mssql';
import { SqliteDialect } from './dialects/sqlite';

export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompilerError';
  }
}

export class JsonLogicCompiler {
  private validator: SchemaValidator;
  private maxDepth: number;
  private maxConditions: number;
  private paramStyle: 'positional' | 'named';
  private dialect: Dialect;

  constructor(private config: CompilerConfig) {
    this.validator = new SchemaValidator(config.schema);
    this.maxDepth = config.maxDepth ?? config.schema.settings?.maxDepth ?? 5;
    this.maxConditions = config.maxConditions ?? config.schema.settings?.maxConditions ?? 100;
    this.paramStyle = config.paramStyle ?? config.schema.settings?.paramStyle ?? 'positional';

    // Initialize dialect
    switch (config.dialect) {
      case 'mysql':
        this.dialect = new MysqlDialect();
        break;
      case 'mssql':
        this.dialect = new MssqlDialect();
        break;
      case 'sqlite':
        this.dialect = new SqliteDialect();
        break;
      case 'postgresql':
      default:
        this.dialect = new PostgresDialect();
        break;
    }
  }

  /**
   * Compile JSON Logic rule to SQL
   */
  compile(rule: JsonLogicRule): SqlResult {
    // Sanitize input first
    const sanitized = sanitizeInput(rule) as JsonLogicRule;

    const context: CompilerContext = {
      depth: 0,
      conditionCount: 0,
      paramIndex: 1, // Start from 1 for PostgreSQL $1, $2, ...
      params: {},
    };

    const result = this.visit(sanitized, context);

    return {
      sql: result.sql,
      params: result.params,
    };
  }

  /**
   * Visit a JSON Logic node
   */
  private visit(rule: JsonLogicRule, context: CompilerContext): SqlResult {
    // Check depth limit
    if (context.depth > this.maxDepth) {
      throw new CompilerError(
        `Maximum nesting depth exceeded: ${this.maxDepth}`,
      );
    }

    // Check condition count
    if (context.conditionCount > this.maxConditions) {
      throw new CompilerError(
        `Maximum condition count exceeded: ${this.maxConditions}`,
      );
    }

    // Handle primitives (should not happen at top level)
    if (rule === null || typeof rule !== 'object') {
      throw new CompilerError('Invalid rule: expected object');
    }

    // Get operator
    const operator = Object.keys(rule)[0];
    if (!operator) {
      throw new CompilerError('Invalid rule: empty object');
    }

    const operands = (rule as Record<string, unknown>)[operator];

    // Handle logical operators
    switch (operator) {
      case 'and':
        return this.handleLogicalAnd(operands as JsonLogicRule[], context);

      case 'or':
        return this.handleLogicalOr(operands as JsonLogicRule[], context);

      case '!':
      case 'not':
        return this.handleLogicalNot(operands as JsonLogicRule, context);

      default:
        return this.handleCondition(operator, operands, context);
    }
  }

  private handleLogicalAnd(
    operands: JsonLogicRule[],
    context: CompilerContext,
  ): SqlResult {
    if (!Array.isArray(operands)) {
      throw new CompilerError("'and' operator requires array");
    }

    const conditions: SqlResult[] = [];

    // Increment depth for nested visits
    context.depth++;

    for (const operand of operands) {
      // Pass same context to maintain paramIndex ordering
      const result = this.visit(operand, context);
      conditions.push(result);
      context.conditionCount++;
    }

    // Restore depth
    context.depth--;

    return handleAnd(conditions, context);
  }

  private handleLogicalOr(
    operands: JsonLogicRule[],
    context: CompilerContext,
  ): SqlResult {
    if (!Array.isArray(operands)) {
      throw new CompilerError("'or' operator requires array");
    }

    const conditions: SqlResult[] = [];

    // Increment depth for nested visits
    context.depth++;

    for (const operand of operands) {
      // Pass same context to maintain paramIndex ordering
      const result = this.visit(operand, context);
      conditions.push(result);
      context.conditionCount++;
    }

    // Restore depth
    context.depth--;

    return handleOr(conditions, context);
  }

  private handleLogicalNot(
    operand: JsonLogicRule,
    context: CompilerContext,
  ): SqlResult {
    // Increment depth for nested visit
    context.depth++;
    
    // Pass same context to maintain paramIndex ordering
    const result = this.visit(operand, context);
    context.conditionCount++;
    
    // Restore depth
    context.depth--;
    
    return handleNot(result);
  }

  private handleCondition(
    jsonOperator: string,
    operands: unknown,
    context: CompilerContext,
  ): SqlResult {
    if (!Array.isArray(operands) || operands.length < 1) {
      throw new CompilerError(`Invalid operands for operator: ${jsonOperator}`);
    }

    // Extract field name from var
    const fieldRef = operands[0];
    if (!this.isVar(fieldRef)) {
      throw new CompilerError('First operand must be a field reference (var)');
    }
    const fieldName = this.extractVarName(fieldRef);

    // Get field schema and validate
    const fieldSchema = this.validator.getFieldSchema(fieldName);

    // Map JSON Logic operator to internal operator
    const operator = this.mapOperator(jsonOperator, fieldSchema);

    // Validate operator is allowed
    this.validator.validateOperator(fieldName, operator);

    // Get value(s)
    const value = operands.length > 1 ? operands[1] : null;
    const value2 = operands.length > 2 ? operands[2] : null;

    // Validate value
    if (!UNARY_OPERATORS.includes(operator)) {
      this.validator.validateValue(fieldName, operator, value);
    }

    // Build column reference
    const column = this.buildColumnRef(fieldName, fieldSchema);

    context.conditionCount++;

    // Handle based on operator type
    if (UNARY_OPERATORS.includes(operator)) {
      return this.dialect.handleNullCheck(operator, column);
    }

    if (RANGE_OPERATORS.includes(operator)) {
      if (value2 === null) {
        throw new CompilerError(`${operator} requires two values`);
      }
      this.validator.validateValue(fieldName, operator, value2);
      return this.dialect.handleBetween(operator, column, [value, value2], context);
    }

    if (ARRAY_OPERATORS.includes(operator)) {
      if (!Array.isArray(value)) {
        throw new CompilerError(`${operator} requires array value`);
      }
      return this.dialect.handleArray(operator, column, value, context);
    }

    // Any of array column operators
    if (['any_of', 'not_any_of'].includes(operator)) {
      return this.dialect.handleAnyOf(operator, column, value, context);
    }

    // String operators
    if (['like', 'ilike', 'starts_with', 'ends_with', 'contains', 'regex'].includes(operator)) {
      // Special handling for 'contains' which can be Array or String
      if (operator === 'contains' && (fieldSchema.type === 'array' || fieldSchema.type === 'jsonb')) {
         if (!Array.isArray(value)) {
            // It might be a single value check? e.g. tags contains 'a'
            // But Postgres @> expects array.
            // If user passed a single value, we could wrap it?
            // Strict mode: expect array.
            throw new CompilerError(`Array 'contains' requires array value`); 
         }
         return this.dialect.handleArray(operator, column, value, context);
      }

      if (typeof value !== 'string') {
        throw new CompilerError(`${operator} requires string value`);
      }
      const caseSensitive = fieldSchema.caseSensitive ?? false;
      return this.dialect.handleString(operator, column, value, context, caseSensitive);
    }

    // Comparison operators
    return this.dialect.handleComparison(operator, column, value, context);
  }

  private isVar(value: unknown): value is JsonLogicVar {
    return (
      typeof value === 'object' &&
      value !== null &&
      'var' in value
    );
  }

  private extractVarName(varRef: JsonLogicVar): string {
    const name = varRef.var;
    if (typeof name === 'number') {
      return name.toString();
    }
    return name;
  }

  private mapOperator(jsonOp: string, field: FieldSchema | ComputedFieldSchema): Operator {
    // Direct mapping from JSON Logic operators
    if (jsonOp in JSON_LOGIC_TO_OPERATOR) {
      return JSON_LOGIC_TO_OPERATOR[jsonOp]!;
    }

    // Already an internal operator
    if (field.operators.includes(jsonOp as Operator)) {
      return jsonOp as Operator;
    }

    throw new CompilerError(`Unknown operator: ${jsonOp}`);
  }

  private buildColumnRef(
    fieldName: string,
    field: FieldSchema | ComputedFieldSchema,
  ): string {
    // Computed field
    if ('computed' in field && field.computed) {
      return `(${field.expression})`;
    }

    // From here, field is FieldSchema
    const regularField = field as FieldSchema;

    // JSONB path
    if (regularField.jsonPath) {
      return regularField.jsonPath;
    }

    // Regular column
    const columnName = regularField.column ?? fieldName;
    
    // Split by dot and quote each part using dialect
    let column = columnName.split('.')
      .map(part => this.dialect.quoteIdentifier(part))
      .join('.');

    // Apply input transforms
    if (regularField.transform?.input) {
      column = applyTransforms(column, regularField.transform.input);
    }

    return column;
  }
}

export { SchemaValidationError };
