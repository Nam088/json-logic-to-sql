import type { FilterSchema, FieldSchema, ComputedFieldSchema } from '../types';

/**
 * Column mapping - maps public field names to internal DB column names
 */
export type ColumnMapping = Record<string, string | { table: string; column: string }>;

/**
 * JSONB path mapping - maps public field names to JSONB paths
 */
export type JsonPathMapping = Record<string, string>;

/**
 * Expression mapping for computed fields
 */
export type ExpressionMapping = Record<string, string>;

/**
 * Combined field mapping configuration
 */
export interface FieldMappingConfig {
  /** Map field name -> DB column name */
  columns?: ColumnMapping;
  /** Map field name -> JSONB path expression */
  jsonPaths?: JsonPathMapping;
  /** Map field name -> computed expression (field becomes computed) */
  expressions?: ExpressionMapping;
}

/**
 * Apply column mapping to a public schema
 * This keeps the public schema clean (for sending to FE) while adding
 * internal DB column mappings on the backend.
 * 
 * @example
 * ```typescript
 * const publicSchema = {
 *   fields: {
 *     tags: { type: 'array', operators: ['contains'] },
 *     authorName: { type: 'string', operators: ['eq'] },
 *   },
 * };
 * 
 * const mapping = {
 *   tags: '_tags',
 *   authorName: { table: 'authors', column: 'name' },
 * };
 * 
 * const fullSchema = applyColumnMapping(publicSchema, mapping);
 * // Result:
 * // tags.column = '_tags'
 * // authorName.column = 'authors.name' (logic in sanitizer escapes this correctly)
 * ```
 */
export function applyColumnMapping(
  schema: FilterSchema,
  mapping: ColumnMapping,
): FilterSchema {
  const fields: Record<string, FieldSchema | ComputedFieldSchema> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const mapConfig = mapping[fieldName];
    let columnName: string | undefined;

    if (mapConfig) {
      if (typeof mapConfig === 'string') {
        columnName = mapConfig;
      } else {
        // Handle object mapping { table, column }
        // Return qualified identifier: table.column
        // Sanitizer will split by dot and quote each part: "table"."column"
        columnName = `${mapConfig.table}.${mapConfig.column}`;
      }
    }
    
    if (columnName && !('computed' in fieldSchema && fieldSchema.computed)) {
      // Add column mapping to regular field
      fields[fieldName] = {
        ...fieldSchema,
        column: columnName,
      } as FieldSchema;
    } else {
      // Keep field as-is
      fields[fieldName] = fieldSchema;
    }
  }

  return { ...schema, fields };
}

/**
 * Apply JSONB path mapping to a public schema
 * 
 * @example
 * ```typescript
 * const publicSchema = {
 *   fields: {
 *     'metadata.priority': { type: 'string', operators: ['eq'] },
 *   },
 * };
 * 
 * const mapping = {
 *   'metadata.priority': "data->>'priority'",
 * };
 * 
 * const fullSchema = applyJsonPathMapping(publicSchema, mapping);
 * ```
 */
export function applyJsonPathMapping(
  schema: FilterSchema,
  mapping: JsonPathMapping,
): FilterSchema {
  const fields: Record<string, FieldSchema | ComputedFieldSchema> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const jsonPath = mapping[fieldName];
    
    if (jsonPath && !('computed' in fieldSchema && fieldSchema.computed)) {
      fields[fieldName] = {
        ...fieldSchema,
        jsonPath,
      } as FieldSchema;
    } else {
      fields[fieldName] = fieldSchema;
    }
  }

  return { ...schema, fields };
}

/**
 * Apply all field mappings at once
 * 
 * @example
 * ```typescript
 * const publicSchema = {
 *   fields: {
 *     tags: { type: 'array', operators: ['contains'] },
 *     priority: { type: 'string', operators: ['eq'] },
 *     fullName: { type: 'string', operators: ['ilike'] },
 *   },
 * };
 * 
 * const fullSchema = applyFieldMappings(publicSchema, {
 *   columns: { tags: '_tags' },
 *   jsonPaths: { priority: "metadata->>'priority'" },
 *   expressions: { fullName: "first_name || ' ' || last_name" },
 * });
 * ```
 */
export function applyFieldMappings(
  schema: FilterSchema,
  config: FieldMappingConfig,
): FilterSchema {
  let result = schema;

  // Apply column mappings
  if (config.columns) {
    result = applyColumnMapping(result, config.columns);
  }

  // Apply JSONB path mappings
  if (config.jsonPaths) {
    result = applyJsonPathMapping(result, config.jsonPaths);
  }

  // Apply expression mappings (makes fields computed)
  if (config.expressions) {
    const fields: Record<string, FieldSchema | ComputedFieldSchema> = { ...result.fields };

    for (const [fieldName, expression] of Object.entries(config.expressions)) {
      const existingField = fields[fieldName];
      if (existingField) {
        // Convert to computed field
        fields[fieldName] = {
          ...existingField,
          computed: true,
          expression,
        } as ComputedFieldSchema;
      }
    }

    result = { ...result, fields };
  }

  return result;
}

/**
 * Strip internal mapping fields from schema for sending to frontend
 * Removes: column, jsonPath, expression, computed
 * 
 * @example
 * ```typescript
 * const fullSchema = { ... }; // Has column mappings
 * const publicSchema = toPublicSchema(fullSchema);
 * // Send publicSchema to frontend
 * ```
 */
export function toPublicSchema(schema: FilterSchema): FilterSchema {
  const fields: Record<string, FieldSchema | ComputedFieldSchema> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    // Clone and remove internal properties
    const publicField = { ...fieldSchema };
    
    if ('column' in publicField) {
      delete (publicField as Partial<FieldSchema>).column;
    }
    if ('jsonPath' in publicField) {
      delete (publicField as Partial<FieldSchema>).jsonPath;
    }
    if ('computed' in publicField) {
      delete (publicField as Partial<ComputedFieldSchema>).computed;
      delete (publicField as Partial<ComputedFieldSchema>).expression;
    }

    fields[fieldName] = publicField;
  }

  return { ...schema, fields };
}
