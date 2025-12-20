// ============================================
// JSON LOGIC TYPES
// ============================================

/** Primitive and array values in JSON Logic */
export type JsonLogicValue = string | number | boolean | null | JsonLogicValue[];

/** Variable reference */
export interface JsonLogicVar {
  var: string | number;
}

/** JSON Logic rule - the input format */
export type JsonLogicRule =
  | { [operator: string]: JsonLogicOperand | JsonLogicOperand[] }
  | JsonLogicVar
  | JsonLogicValue;

/** Operand can be a rule, var, or value */
export type JsonLogicOperand = JsonLogicRule | JsonLogicValue;

// ============================================
// SQL OUTPUT TYPES
// ============================================

/** The output of compilation */
export interface SqlResult {
  /** WHERE clause without the WHERE keyword */
  sql: string;
  /** Parameterized values as key-value map */
  params: Record<string, unknown>;
  /** Parameterized values as ordered array (for Knex/MySQL style queries) */
  paramsArray?: unknown[];
}

// ============================================
// COMPILER CONFIG
// ============================================

import { Dialect } from './dialects/type';

export interface CompilerConfig {
  /** Field schema definition */
  schema: FilterSchema;
  /** Maximum nesting depth (default: 5) */
  maxDepth?: number;
  /** Maximum number of conditions (default: 100) */
  maxConditions?: number;
  /** Parameter style (default: 'positional') */
  paramStyle?: 'positional' | 'named';
  /** Target SQL dialect (default: 'postgresql') */
  dialect?: 'postgresql' | 'mysql' | 'mssql' | 'sqlite';
  /** 
   * Placeholder style for parameters (default: 'dollar' for postgresql, 'question' for mysql/sqlite)
   * - 'dollar': $1, $2, $3 (PostgreSQL native)
   * - 'question': ?, ?, ? (Knex, MySQL, SQLite)
   * - 'at': @p1, @p2, @p3 (MSSQL)
   */
  placeholderStyle?: 'dollar' | 'question' | 'at';
  /**
   * Parameter key style in params object (default: 'unified')
   * - 'unified': Always use p1, p2, p3... (consistent across all dialects)
   * - 'legacy': Use $1, $2 for PostgreSQL, @p1, @p2 for MSSQL, p1, p2 for MySQL/SQLite
   * 
   * @todo TODO: Implement paramKeyStyle feature
   * Currently always uses 'unified' style (p1, p2, p3...).
   * To implement 'legacy' style:
   * 1. Pass paramKeyStyle from CompilerConfig to CompilerContext
   * 2. Update BaseDialect.getParamKey() to check context.paramKeyStyle
   * 3. If 'legacy', return placeholder as key (e.g., '$1', '@p1')
   * 4. If 'unified' (default), return 'p1', 'p2'...
   * 5. Update all dialect implementations to use context.paramKeyStyle
   * 
   * This will allow backward compatibility for code that accesses params['$1'] directly
   * instead of using paramsArray.
   */
  paramKeyStyle?: 'unified' | 'legacy';
  /** Lookup resolvers for remote options */
  lookups?: LookupRegistry;
}

// ============================================
// FILTER SCHEMA
// ============================================

export interface FilterSchema {
  fields: Record<string, FieldSchema | ComputedFieldSchema>;
  settings?: SchemaSettings;
}

export interface SchemaSettings {
  defaultOperator?: Operator;
  caseSensitive?: boolean;
  strict?: boolean;
  maxDepth?: number;
  maxConditions?: number;
  paramStyle?: 'positional' | 'named';
}

// ============================================
// FIELD SCHEMA
// ============================================

export interface FieldSchema {
  type: FieldType;
  operators: Operator[];
  
  /** Display title for the field (used in UI) */
  title: string;
  
  /** Input type for UI rendering */
  inputType: string;
  
  /** DB column name if different from field name */
  column?: string;
  
  /** Permissions */
  filterable?: boolean;
  selectable?: boolean;
  sortable?: boolean;
  
  /** Validation */
  nullable?: boolean;
  options?: OptionConfig;
  constraints?: FieldConstraints;
  
  /** SQL transforms */
  transform?: FieldTransform;
  
  /** JSONB path for nested access */
  jsonPath?: string;
  
  /** Case sensitivity for string comparisons */
  caseSensitive?: boolean;
  
  /** Extension point */
  meta?: Record<string, unknown>;
}

export interface ComputedFieldSchema extends Omit<FieldSchema, 'column'> {
  computed: true;
  expression: string;
}

// ============================================
// FIELD TYPES
// ============================================

export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'uuid'
  | 'array'
  | 'json'
  | 'jsonb';

// ============================================
// OPERATORS
// ============================================

export type Operator =
  // Comparison
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  // Array/Set
  | 'in'
  | 'not_in'
  | 'contains'
  | 'contained_by'
  | 'overlaps'
  | 'any_of'      // value = ANY(column) - check if value is in array column
  | 'not_any_of'  // value <> ALL(column) - check if value is NOT in array column
  | 'any_ilike'   // EXISTS (SELECT 1 FROM unnest(column) AS x WHERE x ILIKE value) - ILIKE search in varchar[]/text[]
  // String
  | 'like'
  | 'ilike'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  // Null
  | 'is_null'
  | 'is_not_null'
  // Range
  | 'between'
  | 'not_between'
  // JSONB
  | 'json_contains'
  | 'json_has_key'
  | 'json_has_any_keys';

// ============================================
// OPTIONS CONFIG
// ============================================

export interface OptionConfig {
  /** Static options */
  items?: OptionItem[];
  /** Lookup code for remote data */
  lookupCode?: string;
  /** Key to extract value for DB */
  valueKey?: string;
  /** Key for display label */
  labelKey?: string;
  /** Reject if value not in options */
  strict?: boolean;
}

export interface OptionItem {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
  icon?: string;
  color?: string;
  [key: string]: unknown;
}

// ============================================
// LOOKUP REGISTRY
// ============================================

export type LookupRegistry = Record<string, LookupConfig>;

export interface LookupConfig {
  endpoint: string;
  method?: 'GET' | 'POST';
  valueKey: string;
  labelKey: string;
  /** Static params to send with request */
  params?: Record<string, unknown>;
  /** Search key for filtering */
  searchKey?: string;
  searchMinLength?: number;
  /** Dependencies for cascading */
  dependsOn?: string[];
  dependsOnParams?: Record<string, string>;
}

// ============================================
// CONSTRAINTS
// ============================================

export interface FieldConstraints {
  // String
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  
  // Number
  min?: number;
  max?: number;
  
  // Array
  minItems?: number;
  maxItems?: number;
  
  // Date/Datetime
  dateFormat?: DateFormat | RegExp | string;
  minDate?: string | Date;
  maxDate?: string | Date;
  
  // Custom
  validate?: (value: unknown) => boolean | string;
}

// Built-in date format patterns
export type DateFormat =
  | 'iso'
  | 'date-only'
  | 'datetime'
  | 'YYYY-MM-DD'
  | 'YYYY/MM/DD'
  | 'DD-MM-YYYY'
  | 'DD/MM/YYYY'
  | 'DD.MM.YYYY'
  | 'MM-DD-YYYY'
  | 'MM/DD/YYYY'
  | 'HH:mm'
  | 'HH:mm:ss';

// ============================================
// TRANSFORMS
// ============================================

export interface FieldTransform {
  input?: TransformFn | TransformFn[];
  output?: TransformFn | TransformFn[];
}

export type TransformFn =
  | 'lower'
  | 'upper'
  | 'trim'
  | 'ltrim'
  | 'rtrim'
  | 'unaccent'
  | 'date'
  | 'year'
  | 'month'
  | 'day'
  | CustomTransform;

export interface CustomTransform {
  name: string;
  /** SQL template with {column} placeholder */
  sql: string;
}

// ============================================
// INTERNAL TYPES
// ============================================

export interface CompilerContext {
  depth: number;
  conditionCount: number;
  paramIndex: number;
  params: Record<string, unknown>;
  /** Current field type being processed (for conditional JSONB casting) */
  fieldType?: FieldType;
}
