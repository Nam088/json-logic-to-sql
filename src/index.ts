// Main exports
export { JsonLogicCompiler, CompilerError, SchemaValidationError } from './compiler';

// Types
export type {
  JsonLogicRule,
  JsonLogicVar,
  JsonLogicValue,
  SqlResult,
  CompilerConfig,
  FilterSchema,
  SchemaSettings,
  FieldSchema,
  ComputedFieldSchema,
  FieldType,
  Operator,
  OptionConfig,
  OptionItem,
  LookupRegistry,
  LookupConfig,
  FieldConstraints,
  FieldTransform,
  TransformFn,
  CustomTransform,
} from './types';

// Utilities
export { sanitizeInput, escapeIdentifier } from './security/sanitizer';
export { SchemaValidator } from './schema/validator';
export { buildPagination, buildSort } from './utils/pagination';
export type { PaginationOptions, PaginationResult, SortOptions, SortResult } from './utils/pagination';
export { buildSelect } from './utils/select';
export type { SelectOptions, SelectResult } from './utils/select';
export { applyTransforms, applyTransform, applyBuiltinTransform } from './utils/transforms';
export {
  applyColumnMapping,
  applyJsonPathMapping,
  applyFieldMappings,
  toPublicSchema,
} from './utils/schema-mapping';
export type { ColumnMapping, JsonPathMapping, ExpressionMapping, FieldMappingConfig } from './utils/schema-mapping';
