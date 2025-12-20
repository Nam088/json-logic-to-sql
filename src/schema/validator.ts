import type {
  FilterSchema,
  FieldSchema,
  ComputedFieldSchema,
  Operator,
  OptionConfig,
  FieldConstraints,
  DateFormat,
} from '../types';

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public operator?: string,
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class SchemaValidator {
  constructor(private schema: FilterSchema) {}

  /**
   * Get field schema, throws if not found or not filterable
   */
  getFieldSchema(fieldName: string): FieldSchema | ComputedFieldSchema {
    const field = this.schema.fields[fieldName];
    
    if (!field) {
      if (this.schema.settings?.strict !== false) {
        throw new SchemaValidationError(
          `Unknown field: ${fieldName}`,
          fieldName,
        );
      }
      // In non-strict mode, we can't validate without schema
      throw new SchemaValidationError(
        `Field schema required for: ${fieldName}`,
        fieldName,
      );
    }

    if (field.filterable === false) {
      throw new SchemaValidationError(
        `Field is not filterable: ${fieldName}`,
        fieldName,
      );
    }

    return field;
  }

  /**
   * Validate that operator is allowed for field
   */
  validateOperator(fieldName: string, operator: Operator): void {
    const field = this.getFieldSchema(fieldName);
    
    if (!field.operators.includes(operator)) {
      throw new SchemaValidationError(
        `Operator '${operator}' not allowed for field '${fieldName}'. ` +
        `Allowed: ${field.operators.join(', ')}`,
        fieldName,
        operator,
      );
    }
  }

  /**
   * Validate and sanitize value according to field schema
   */
  validateValue(
    fieldName: string,
    operator: Operator,
    value: unknown,
  ): unknown {
    const field = this.getFieldSchema(fieldName);
    
    // For array operators (in, not_in), validate each item
    if (['in', 'not_in'].includes(operator) && Array.isArray(value)) {
      for (const item of value) {
        this.validateSingleValue(fieldName, field, operator, item);
      }
      return value;
    }
    
    // For range operators (between, not_between), validate array with 2 elements
    if (['between', 'not_between'].includes(operator) && Array.isArray(value)) {
      if (value.length !== 2) {
        throw new SchemaValidationError(
          `Operator '${operator}' requires an array with exactly 2 values`,
          fieldName,
          operator,
        );
      }
      // Validate each element
      for (const item of value) {
        this.validateSingleValue(fieldName, field, operator, item);
      }
      return value;
    }
    
    return this.validateSingleValue(fieldName, field, operator, value);
  }

  private validateSingleValue(
    fieldName: string,
    field: FieldSchema | ComputedFieldSchema,
    operator: Operator,
    value: unknown,
  ): unknown {
    // Check nullable
    if (value === null) {
      if (field.nullable !== true && !['is_null', 'is_not_null'].includes(operator)) {
        throw new SchemaValidationError(
          `Null value not allowed for field: ${fieldName}`,
          fieldName,
          operator,
        );
      }
      return value;
    }

    // Validate options if defined
    if (field.options) {
      this.validateOptions(fieldName, field.options, value);
    }

    // Validate constraints if defined (skip for array items in 'in' operator)
    if (field.constraints && !['in', 'not_in'].includes(operator)) {
      this.validateConstraints(fieldName, field.constraints, value);
    }

    // Skip type validation for any_of/any_ilike on array fields
    // These operators check a single value against an array column
    if (
      ['any_of', 'not_any_of', 'any_ilike', 'not_any_ilike'].includes(operator) &&
      field.type === 'array'
    ) {
      return value;
    }

    // Type-specific validation
    return this.validateType(fieldName, field.type, value);
  }

  private validateOptions(
    fieldName: string,
    options: OptionConfig,
    value: unknown,
  ): void {
    if (options.strict === false) {
      return; // Skip validation
    }

    if (options.items) {
      const values = Array.isArray(value) ? value : [value];
      const allowedValues = options.items.map((item) => item.value);
      
      for (const v of values) {
        if (!allowedValues.includes(v as string | number)) {
          throw new SchemaValidationError(
            `Invalid option value '${v}' for field '${fieldName}'. ` +
            `Allowed: ${allowedValues.join(', ')}`,
            fieldName,
          );
        }
      }
    }
    // For lookupCode, validation happens at runtime when data is fetched
  }

  private validateConstraints(
    fieldName: string,
    constraints: FieldConstraints,
    value: unknown,
  ): void {
    if (typeof value === 'string') {
      if (constraints.minLength !== undefined && value.length < constraints.minLength) {
        throw new SchemaValidationError(
          `Value too short for field '${fieldName}'. Min: ${constraints.minLength}`,
          fieldName,
        );
      }
      if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
        throw new SchemaValidationError(
          `Value too long for field '${fieldName}'. Max: ${constraints.maxLength}`,
          fieldName,
        );
      }
      if (constraints.pattern) {
        const regex = typeof constraints.pattern === 'string' 
          ? new RegExp(constraints.pattern) 
          : constraints.pattern;
        if (!regex.test(value)) {
          throw new SchemaValidationError(
            `Value does not match pattern for field: ${fieldName}`,
            fieldName,
          );
        }
      }
    }

    if (typeof value === 'number') {
      if (constraints.min !== undefined && value < constraints.min) {
        throw new SchemaValidationError(
          `Value too small for field '${fieldName}'. Min: ${constraints.min}`,
          fieldName,
        );
      }
      if (constraints.max !== undefined && value > constraints.max) {
        throw new SchemaValidationError(
          `Value too large for field '${fieldName}'. Max: ${constraints.max}`,
          fieldName,
        );
      }
    }

    if (Array.isArray(value)) {
      if (constraints.minItems !== undefined && value.length < constraints.minItems) {
        throw new SchemaValidationError(
          `Array too short for field '${fieldName}'. Min items: ${constraints.minItems}`,
          fieldName,
        );
      }
      if (constraints.maxItems !== undefined && value.length > constraints.maxItems) {
        throw new SchemaValidationError(
          `Array too long for field '${fieldName}'. Max items: ${constraints.maxItems}`,
          fieldName,
        );
      }
    }

    // Date constraints
    if (typeof value === 'string' && (constraints.dateFormat || constraints.minDate || constraints.maxDate)) {
      // Validate date format
      if (constraints.dateFormat) {
        const isValid = this.validateDateFormat(value, constraints.dateFormat);
        if (!isValid) {
          throw new SchemaValidationError(
            `Invalid date format for field '${fieldName}'. Expected format: ${constraints.dateFormat}`,
            fieldName,
          );
        }
      }

      // Validate min/max date
      const dateValue = new Date(value);
      if (!isNaN(dateValue.getTime())) {
        if (constraints.minDate) {
          const minDate = new Date(constraints.minDate);
          if (dateValue < minDate) {
            throw new SchemaValidationError(
              `Date too early for field '${fieldName}'. Min: ${constraints.minDate}`,
              fieldName,
            );
          }
        }
        if (constraints.maxDate) {
          const maxDate = new Date(constraints.maxDate);
          if (dateValue > maxDate) {
            throw new SchemaValidationError(
              `Date too late for field '${fieldName}'. Max: ${constraints.maxDate}`,
              fieldName,
            );
          }
        }
      }
    }

    if (constraints.validate) {
      const result = constraints.validate(value);
      if (result !== true) {
        throw new SchemaValidationError(
          typeof result === 'string' ? result : `Validation failed for field: ${fieldName}`,
          fieldName,
        );
      }
    }
  }

  private validateDateFormat(
    value: string,
    format: DateFormat | RegExp | string,
  ): boolean {
    if (format instanceof RegExp) {
      return format.test(value);
    }

    // Built-in format patterns
    const FORMAT_PATTERNS: Record<string, RegExp> = {
      // ISO formats
      'iso': /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/,
      'date-only': /^\d{4}-\d{2}-\d{2}$/,
      'datetime': /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/,
      
      // YYYY formats
      'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
      'YYYY/MM/DD': /^\d{4}\/\d{2}\/\d{2}$/,
      
      // DD formats
      'DD-MM-YYYY': /^\d{2}-\d{2}-\d{4}$/,
      'DD/MM/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
      'DD.MM.YYYY': /^\d{2}\.\d{2}\.\d{4}$/,
      
      // MM formats
      'MM-DD-YYYY': /^\d{2}-\d{2}-\d{4}$/,
      'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
      
      // Time formats
      'HH:mm': /^\d{2}:\d{2}$/,
      'HH:mm:ss': /^\d{2}:\d{2}:\d{2}$/,
    };

    const pattern = FORMAT_PATTERNS[format];
    if (pattern) {
      return pattern.test(value);
    }

    // Custom regex string
    if (typeof format === 'string') {
      return new RegExp(format).test(value);
    }

    return true;
  }

  private validateType(
    fieldName: string,
    type: string,
    value: unknown,
  ): unknown {
    switch (type) {
      case 'string':
      case 'text':
        if (typeof value !== 'string') {
          throw new SchemaValidationError(
            `Expected string for field: ${fieldName}`,
            fieldName,
          );
        }
        return value;

      case 'number':
      case 'integer':
      case 'decimal':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new SchemaValidationError(
            `Expected number for field: ${fieldName}`,
            fieldName,
          );
        }
        if (type === 'integer' && !Number.isInteger(value)) {
          throw new SchemaValidationError(
            `Expected integer for field: ${fieldName}`,
            fieldName,
          );
        }
        return value;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new SchemaValidationError(
            `Expected boolean for field: ${fieldName}`,
            fieldName,
          );
        }
        return value;

      case 'uuid':
        if (typeof value !== 'string' || 
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          throw new SchemaValidationError(
            `Expected UUID for field: ${fieldName}`,
            fieldName,
          );
        }
        return value;

      case 'date':
      case 'datetime':
      case 'timestamp':
        // Accept ISO strings or Date objects
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new SchemaValidationError(
              `Invalid date for field: ${fieldName}`,
              fieldName,
            );
          }
          return value;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        throw new SchemaValidationError(
          `Expected date for field: ${fieldName}`,
          fieldName,
        );

      case 'array':
        if (!Array.isArray(value)) {
          throw new SchemaValidationError(
            `Expected array for field: ${fieldName}`,
            fieldName,
          );
        }
        return value;

      case 'jsonb':
        // Accept any JSON-serializable value
        return value;

      default:
        return value;
    }
  }
}
