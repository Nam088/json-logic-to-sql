import type { FilterSchema, FieldSchema, ComputedFieldSchema } from '../types';

/**
 * Safe deep retrieval of values from an object
 * similar to lodash.get
 * 
 * @example
 * ```typescript
 * const obj = { a: { b: { c: 1 } } };
 * const val = get(obj, 'a.b.c'); // 1
 * const val2 = get(obj, ['a', 'b', 'c']); // 1
 * const missing = get(obj, 'a.b.x', 'default'); // 'default'
 * ```
 */
export function get<T = any>(
    obj: any,
    path: string | string[],
    defaultValue?: T
): T {
    if (obj == null) {
        return defaultValue as T;
    }

    const paths = Array.isArray(path) ? path : path.split('.');
    let current = obj;

    for (const key of paths) {
        if (current == null) {
            return defaultValue as T;
        }
        current = current[key];
    }

    return current === undefined ? defaultValue as T : current;
}

/**
 * Generic pick function
 * Creates an object composed of the picked object properties
 */
export function pick<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    if (obj == null) return {} as Pick<T, K>;

    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}

/**
 * Generic omit function
 * Creates an object composed of the object properties that are not omitted
 */
/**
 * Generic omit function
 * Creates an object composed of the object properties that are not omitted
 * Optimized to avoid 'delete' which de-optimizes object shape in V8
 */
export function omit<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    if (obj == null) return {} as Omit<T, K>;

    // For small arrays, Array.includes is fast enough and avoids Set overhead
    // For larger arrays, Set is better. 
    // Given usage here (schema fields), keys array is usually small (< 10).
    const result = {} as Omit<T, K>;

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Check if key is in omits list
            if (!keys.includes(key as unknown as K)) {
                // @ts-ignore
                result[key] = obj[key];
            }
        }
    }
    return result;
}

/**
 * Pick specific fields from a schema
 * Useful for exposing a subset of the schema to the frontend
 * 
 * @example
 * ```typescript
 * const publicSchema = pickSchemaFields(fullSchema, ['id', 'name']);
 * ```
 */
export function pickSchemaFields(
    schema: FilterSchema,
    fieldsToPick: string[],
): FilterSchema {
    // Use generic pick for the fields object
    const fields = pick(schema.fields, fieldsToPick);
    return { ...schema, fields };
}

/**
 * Omit specific fields from a schema
 * Useful for hiding sensitive or internal fields from the frontend
 * 
 * @example
 * ```typescript
 * const publicSchema = omitSchemaFields(fullSchema, ['secret']);
 * ```
 */
export function omitSchemaFields(
    schema: FilterSchema,
    fieldsToOmit: string[],
): FilterSchema {
    // Use generic omit for the fields object
    const fields = omit(schema.fields, fieldsToOmit);
    return { ...schema, fields };
}

/**
 * Default internal fields to omit when sending schema to frontend
 */
export const DEFAULT_INTERNAL_FIELDS = [
    'column',
    'jsonPath',
    'expression',
    'computed',
    'transform',
    'internal',
];

/**
 * Get a public version of the schema for the frontend
 * Automatically omits internal DB mappings and sensitive fields
 * 
 * @example
 * ```typescript
 * // Use defaults
 * const publicSchema = getPublicSchema(fullSchema);
 * 
 * // Custom omits (overrides defaults)
 * const customSchema = getPublicSchema(fullSchema, ['secret']);
 * 
 * // Extend defaults
 * const extendedSchema = getPublicSchema(fullSchema, [...DEFAULT_INTERNAL_FIELDS, 'custom_field']);
 * ```
 */
export function getPublicSchema(
    schema: FilterSchema,
    omits: string[] = DEFAULT_INTERNAL_FIELDS,
): FilterSchema {
    const newFields: Record<string, FieldSchema | ComputedFieldSchema> = {};
    const schemaFields = schema.fields;

    // Optimize: keysToOmit is just the passed array (which defaults to internal fields)
    const keysToOmit = omits;

    if (schemaFields) {
        // Use Object.entries for cleaner iteration (modern JS engines optimize this efficiently)
        for (const [key, field] of Object.entries(schemaFields)) {
            // @ts-ignore
            newFields[key] = omit(field, keysToOmit);
        }
    }

    return { ...schema, fields: newFields };
}
