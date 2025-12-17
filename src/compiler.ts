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
import { applyTransforms, applyValueTransforms } from './utils/transforms';
import { paramsToArray } from './utils/pagination';
import { SchemaValidator, SchemaValidationError } from './schema/validator';
import { sanitizeInput, escapeIdentifier, validateParameterValue } from './security/sanitizer';
import { JSON_LOGIC_TO_OPERATOR, UNARY_OPERATORS, RANGE_OPERATORS, ARRAY_OPERATORS } from './operators/index';
import { handleAnd, handleOr, handleNot } from './operators/logical';
import { Dialect } from './dialects/type';
import { createDialect } from './dialects/factory';

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

  constructor(private config: CompilerConfig, dialect?: Dialect) {
    this.validator = new SchemaValidator(config.schema);
    this.maxDepth = config.maxDepth ?? config.schema.settings?.maxDepth ?? 5;
    this.maxConditions = config.maxConditions ?? config.schema.settings?.maxConditions ?? 100;
    this.paramStyle = config.paramStyle ?? config.schema.settings?.paramStyle ?? 'positional';

    // Initialize dialect
    if (dialect) {
      this.dialect = dialect;
      // Apply placeholder style if provided
      if (config.placeholderStyle) {
        this.dialect.setPlaceholderStyle(config.placeholderStyle);
      }
    } else {
      this.dialect = createDialect({
        name: config.dialect,
        placeholderStyle: config.placeholderStyle,
      });
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
      paramsArray: paramsToArray(result.params),
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
    let value = operands.length > 1 ? operands[1] : null;
    let value2 = operands.length > 2 ? operands[2] : null;

    // Validate value
    if (!UNARY_OPERATORS.includes(operator)) {
      if (value !== null) validateParameterValue(value);
      if (value2 !== null && value2 !== undefined) validateParameterValue(value2);
      this.validator.validateValue(fieldName, operator, value);
    }

    // Apply input transforms to values (e.g., lower, trim)
    // Only apply to regular fields (not computed fields)
    if ('transform' in fieldSchema && fieldSchema.transform?.input) {
      if (value !== null) {
        value = applyValueTransforms(value, fieldSchema.transform.input);
      }
      if (value2 !== null && value2 !== undefined) {
        value2 = applyValueTransforms(value2, fieldSchema.transform.input);
      }
    }

    // Build column reference
    const column = this.buildColumnRef(fieldName, fieldSchema);

    context.conditionCount++;
    
    // Set field type in context for conditional JSONB casting
    const previousFieldType = context.fieldType;
    context.fieldType = fieldSchema.type;

    try {
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

      // Handle 'contains' for array/jsonb fields BEFORE checking ARRAY_OPERATORS
      if (operator === 'contains' && (fieldSchema.type === 'array' || fieldSchema.type === 'jsonb')) {
        if (!Array.isArray(value)) {
          throw new CompilerError(
            `Operator 'contains' on array field '${fieldName}' requires an array value (subset check). ` +
            `To check if array contains a single value, use 'any_of' operator.`
          );
        }
        // Field type already set above
        return this.dialect.handleArray(operator, column, value, context);
      }

      if (ARRAY_OPERATORS.includes(operator)) {
        if (!Array.isArray(value)) {
          throw new CompilerError(`${operator} requires array value`);
        }
        return this.dialect.handleArray(operator, column, value, context);
      }
    } finally {
      // Restore previous field type
      context.fieldType = previousFieldType;
    }

    // Any of array column operators
    if (['any_of', 'not_any_of'].includes(operator)) {
      // Set field type for any_of (may need JSONB casting)
      const previousFieldType = context.fieldType;
      context.fieldType = fieldSchema.type;
      try {
        return this.dialect.handleAnyOf(operator, column, value, context);
      } finally {
        context.fieldType = previousFieldType;
      }
    }

    // String operators (contains for string fields only)
    if (['like', 'ilike', 'starts_with', 'ends_with', 'contains', 'regex'].includes(operator)) {
      if (typeof value !== 'string') {
        throw new CompilerError(`${operator} requires string value`);
      }
      const caseSensitive = fieldSchema.caseSensitive ?? false;
      return this.dialect.handleString(operator, column, value, context, caseSensitive);
    }

    // Handle null values for comparison operators (implicit rewrite)
    if (value === null && ['eq', 'ne'].includes(operator)) {
      const nullOperator = operator === 'eq' ? 'is_null' : 'is_not_null';
      return this.dialect.handleNullCheck(nullOperator, column);
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
      let jsonPathExpr = regularField.jsonPath;
      
      // Auto-cast JSONB text values to appropriate types
      // When using ->> operator, it returns text, so we need to cast for non-string types
      if (regularField.type === 'boolean' && this.dialect.name === 'postgresql') {
        // PostgreSQL: cast text to boolean
        jsonPathExpr = `(${regularField.jsonPath})::boolean`;
      } else if (regularField.type === 'number' || regularField.type === 'integer' || regularField.type === 'decimal') {
        // Cast text to numeric for all dialects
        if (this.dialect.name === 'postgresql') {
          jsonPathExpr = `(${regularField.jsonPath})::numeric`;
        } else if (this.dialect.name === 'mysql') {
          jsonPathExpr = `CAST(${regularField.jsonPath} AS DECIMAL)`;
        } else if (this.dialect.name === 'sqlite') {
          jsonPathExpr = `CAST(${regularField.jsonPath} AS REAL)`;
        }
      } else if (regularField.type === 'date' || regularField.type === 'datetime' || regularField.type === 'timestamp') {
        // Cast text to date/timestamp for proper comparison
        if (this.dialect.name === 'postgresql') {
          if (regularField.type === 'date') {
            jsonPathExpr = `(${regularField.jsonPath})::date`;
          } else {
            jsonPathExpr = `(${regularField.jsonPath})::timestamp`;
          }
        } else if (this.dialect.name === 'mysql') {
          if (regularField.type === 'date') {
            jsonPathExpr = `CAST(${regularField.jsonPath} AS DATE)`;
          } else {
            jsonPathExpr = `CAST(${regularField.jsonPath} AS DATETIME)`;
          }
        } else if (this.dialect.name === 'sqlite') {
          jsonPathExpr = `CAST(${regularField.jsonPath} AS TEXT)`;
        }
      } else if (regularField.type === 'uuid' && this.dialect.name === 'postgresql') {
        // PostgreSQL: cast text to uuid
        jsonPathExpr = `(${regularField.jsonPath})::uuid`;
      }
      
      return jsonPathExpr;
    }

    // Regular column
    const columnName = regularField.column ?? fieldName;
    
    // Split by dot and quote each part using dialect
    let column = columnName.split('.')
      .map(part => this.dialect.quoteIdentifier(part))
      .join('.');

    // Apply input transforms (with dialect-specific support)
    if (regularField.transform?.input) {
      column = applyTransforms(column, regularField.transform.input, this.dialect.name);
    }

    return column;
  }
}

export { SchemaValidationError };
