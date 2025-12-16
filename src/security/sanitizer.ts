/**
 * Security utilities for preventing SQL injection and other attacks
 */

const DANGEROUS_KEYS = ['__proto__'];

/**
 * Sanitize input to prevent prototype pollution
 */
export function sanitizeInput(input: unknown, visited = new WeakSet<object>()): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'object') {
    if (visited.has(input)) {
      throw new Error('Circular reference detected');
    }
    visited.add(input);
  }

  if (Array.isArray(input)) {
    const result = input.map(item => sanitizeInput(item, visited));
    visited.delete(input);
    return result;
  }

  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.includes(key)) {
        continue; // Skip dangerous keys
      }
      result[key] = sanitizeInput((input as Record<string, unknown>)[key], visited);
    }
    visited.delete(input); // Allow revisiting in siblings (DAG)
    return result;
  }

  return input;
}

/**
 * Escape SQL identifier (column/table name) to prevent injection
 * Uses PostgreSQL quoting style with double quotes
 */
export function escapeIdentifier(name: string): string {
  // Support qualified names (table.column)
  if (name.includes('.')) {
    const parts = name.split('.');
    
    // Ensure strict structure (no empty parts, reasonable depth)
    if (parts.some(p => !p) || parts.length > 3) { // Allow schema.table.column max
      throw new Error(`Invalid identifier structure: ${name}`);
    }

    // Validate and escape each part strictly
    return parts.map(part => escapeIdentifier(part)).join('.');
  }

  // Strict validation: ONLY alphanumeric and underscore allowed
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  
  // Double-quote to prevent keyword collision/case issues
  return `"${name}"`;
}

/**
 * Escape JSONB path for safe use in queries
 */
export function escapeJsonPath(path: string): string {
  // Validate JSONB path format
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(->'[a-zA-Z_][a-zA-Z0-9_]*')*(->>?'[a-zA-Z_][a-zA-Z0-9_]*')?$/.test(path)) {
    throw new Error(`Invalid JSONB path: ${path}`);
  }
  return path;
}

/**
 * Validate that a value is safe for use in a parameter
 * Throws if value contains potentially dangerous content
 */
export function validateParameterValue(value: unknown): void {
  if (typeof value === 'string') {
    // Check for null bytes which could cause issues
    if (value.includes('\0')) {
      throw new Error('Parameter value contains null byte');
    }
  }
}
