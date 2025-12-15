import type { FieldSchema, FilterSchema, ComputedFieldSchema } from '../types';
import { escapeIdentifier } from '../security/sanitizer';
import { applyTransforms } from './transforms';

export interface SelectOptions {
  fields?: string[];
  exclude?: string[];
}

export interface SelectResult {
  sql: string;
  fields: string[];
}

/**
 * Build SELECT clause from field list
 */
export function buildSelect(
  schema: FilterSchema,
  options: SelectOptions = {},
): SelectResult {
  const { fields: requestedFields, exclude = [] } = options;

  // Determine which fields to select
  let fieldsToSelect: string[];

  if (requestedFields && requestedFields.length > 0) {
    // Use explicitly requested fields
    fieldsToSelect = requestedFields.filter((f) => !exclude.includes(f));
  } else {
    // Use all selectable fields
    fieldsToSelect = Object.keys(schema.fields).filter((fieldName) => {
      const field = schema.fields[fieldName];
      return field?.selectable !== false && !exclude.includes(fieldName);
    });
  }

  // Build SQL parts
  const parts: string[] = [];

  for (const fieldName of fieldsToSelect) {
    const field = schema.fields[fieldName];

    if (!field) {
      throw new Error(`Unknown field: ${fieldName}`);
    }

    if (field.selectable === false) {
      throw new Error(`Field not selectable: ${fieldName}`);
    }

    const column = buildColumnExpression(fieldName, field);
    parts.push(column);
  }

  if (parts.length === 0) {
    return { sql: '*', fields: [] };
  }

  return {
    sql: parts.join(', '),
    fields: fieldsToSelect,
  };
}

function buildColumnExpression(
  fieldName: string,
  field: FieldSchema | ComputedFieldSchema,
): string {
  // Computed field
  if ('computed' in field && field.computed) {
    return `(${field.expression}) AS ${escapeIdentifier(fieldName)}`;
  }

  const regularField = field as FieldSchema;

  // JSONB path
  if (regularField.jsonPath) {
    return `${regularField.jsonPath} AS ${escapeIdentifier(fieldName)}`;
  }

  // Regular column with alias if different
  const columnName = regularField.column ?? fieldName;
  
  if (columnName !== fieldName) {
    return `${escapeIdentifier(columnName)} AS ${escapeIdentifier(fieldName)}`;
  }

  // Apply output transforms using shared utility
  if (regularField.transform?.output) {
    const expr = applyTransforms(escapeIdentifier(columnName), regularField.transform.output);
    return `${expr} AS ${escapeIdentifier(fieldName)}`;
  }

  return escapeIdentifier(columnName);
}

