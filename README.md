# @nam088/json-logic-to-sql

![License](https://img.shields.io/npm/l/@nam088/json-logic-to-sql)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

A powerful, secure, and type-safe library to convert [JSON Logic](http://jsonlogic.com/) rules into SQL `WHERE` clauses with comprehensive schema validation and multi-dialect support.

## Features

- **Secure by Default**: Generates parameterized SQL queries to prevent SQL injection attacks
- **Multi-Dialect Support**: Works with PostgreSQL, MySQL, MSSQL (SQL Server), and SQLite
- **Type-Safe**: Written in TypeScript with comprehensive type definitions and strict validation
- **Schema Validation**: Validates rules against a defined schema before compilation with customizable constraints
- **Advanced Field Mapping**: Support for column mapping, JSONB paths, and computed fields
- **Field Transformations**: Built-in SQL transforms (LOWER, UPPER, TRIM, DATE functions, etc.)
- **Flexible Operators**: Comprehensive operator support including comparison, logical, string, array, and JSONB operations
- **Query Utilities**: Built-in helpers for pagination, sorting, and SELECT clause generation
- **Extensible**: Support for custom transforms and field constraints

## Installation

```bash
npm install @nam088/json-logic-to-sql
```

## Quick Start

### 1. Define your Schema

Define the fields that are allowed to be queried with their types, operators, and optional constraints.

```typescript
import { FilterSchema } from '@nam088/json-logic-to-sql';

const schema: FilterSchema = {
  fields: {
    firstName: {
      type: 'string',
      operators: ['eq', 'ne', 'like', 'in'],
      column: 'first_name', // Maps 'firstName' to 'first_name' column
    },
    age: {
      type: 'number',
      operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'between'],
      constraints: {
        min: 0,
        max: 150,
      },
    },
    status: {
      type: 'string',
      operators: ['eq', 'in'],
      options: {
        items: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'pending', label: 'Pending' },
        ],
        strict: true, // Only allow predefined values
      },
    },
    email: {
      type: 'string',
      operators: ['eq', 'like', 'ilike'],
      constraints: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
    },
  },
  settings: {
    maxDepth: 5,
    maxConditions: 100,
  },
};
```

### 2. Initialize the Compiler

```typescript
import { JsonLogicCompiler } from '@nam088/json-logic-to-sql';

const compiler = new JsonLogicCompiler({
  schema,
  dialect: 'postgresql', // or 'mysql', 'mssql', 'sqlite'
});
```

### 3. Compile Rules

```typescript
const rule = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] }
  ]
};

try {
  const result = compiler.compile(rule);
  console.log(result.sql);
  // Output: (status = $1 AND age > $2)
  
  console.log(result.params);
  // Output: { '$1': 'active', '$2': 18 }
} catch (error) {
  console.error('Compilation failed:', error.message);
}
```

## Core Concepts

### Field Schema

Each field in your schema can have:

```typescript
{
  type: FieldType;              // Data type (string, number, boolean, date, array, etc.)
  operators: Operator[];        // Allowed operators for this field
  column?: string;              // Database column name (if different from field name)
  filterable?: boolean;         // Allow in WHERE clauses (default: true)
  selectable?: boolean;         // Allow in SELECT clauses (default: true)
  sortable?: boolean;           // Allow in ORDER BY (default: true)
  nullable?: boolean;           // Allow null values
  caseSensitive?: boolean;      // For string comparisons
  options?: OptionConfig;       // Predefined values
  constraints?: FieldConstraints; // Validation rules
  transform?: FieldTransform;   // SQL transformations
  jsonPath?: string;            // JSONB path for nested data
  meta?: Record<string, unknown>; // Custom metadata
}
```

### Computed Fields

Define fields that are calculated from SQL expressions:

```typescript
const schema: FilterSchema = {
  fields: {
    fullName: {
      type: 'string',
      operators: ['like', 'ilike'],
      computed: true,
      expression: "first_name || ' ' || last_name",
    },
    ageGroup: {
      type: 'string',
      operators: ['eq', 'in'],
      computed: true,
      expression: "CASE WHEN age < 18 THEN 'minor' ELSE 'adult' END",
    },
  },
};
```

### Field Transformations

Apply SQL transformations to fields:

```typescript
const schema: FilterSchema = {
  fields: {
    email: {
      type: 'string',
      operators: ['eq', 'like'],
      transform: {
        input: 'lower', // Apply LOWER() when filtering
        output: 'lower', // Apply LOWER() when selecting
      },
    },
    createdAt: {
      type: 'datetime',
      operators: ['eq', 'gt', 'lt'],
      transform: {
        input: 'date', // Extract date part for comparison
      },
    },
  },
};
```

Built-in transforms: `lower`, `upper`, `trim`, `ltrim`, `rtrim`, `unaccent`, `date`, `year`, `month`, `day`

Custom transforms:

```typescript
transform: {
  input: {
    name: 'custom',
    sql: 'CUSTOM_FUNCTION({column})'
  }
}
```

### Field Constraints

Validate values before compilation:

```typescript
constraints: {
  // String constraints
  minLength: 3,
  maxLength: 100,
  pattern: /^[a-zA-Z]+$/,
  
  // Number constraints
  min: 0,
  max: 1000,
  
  // Array constraints
  minItems: 1,
  maxItems: 10,
  
  // Date constraints
  dateFormat: 'YYYY-MM-DD',
  minDate: '2020-01-01',
  maxDate: '2025-12-31',
  
  // Custom validation
  validate: (value) => {
    if (typeof value === 'string' && value.includes('admin')) {
      return 'Cannot filter by admin values';
    }
    return true;
  }
}
```

## Supported Operators

### Comparison Operators

| JSON Logic | Internal | SQL | Description |
|------------|----------|-----|-------------|
| `==`, `===` | `eq` | `=` | Equal |
| `!=`, `!==` | `ne` | `<>` | Not equal |
| `>` | `gt` | `>` | Greater than |
| `>=` | `gte` | `>=` | Greater than or equal |
| `<` | `lt` | `<` | Less than |
| `<=` | `lte` | `<=` | Less than or equal |

### Logical Operators

- `and` - Logical AND
- `or` - Logical OR
- `!`, `not` - Logical NOT

### String Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `like` | SQL LIKE (case-sensitive) | `{ like: [{ var: 'name' }, 'John%'] }` |
| `ilike` | Case-insensitive LIKE (PostgreSQL) | `{ ilike: [{ var: 'name' }, 'john%'] }` |
| `starts_with` | Starts with string | `{ starts_with: [{ var: 'name' }, 'John'] }` |
| `ends_with` | Ends with string | `{ ends_with: [{ var: 'email' }, '.com'] }` |
| `contains` | Contains substring | `{ contains: [{ var: 'description' }, 'urgent'] }` |
| `regex` | Regular expression match | `{ regex: [{ var: 'code' }, '^[A-Z]{3}'] }` |

### Array Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `in` | Value in list | `{ in: [{ var: 'status' }, ['active', 'pending']] }` |
| `not_in` | Value not in list | `{ not_in: [{ var: 'status' }, ['deleted']] }` |
| `between` | Value between two values | `{ between: [{ var: 'age' }, 18, 65] }` |
| `not_between` | Value not between | `{ not_between: [{ var: 'price' }, 100, 200] }` |

### Array Column Operators (PostgreSQL)

For fields with `type: 'array'`:

| Operator | Description | Example |
|----------|-------------|---------|
| `contains` | Array contains values | `{ contains: [{ var: 'tags' }, ['urgent', 'bug']] }` |
| `contained_by` | Array contained by values | `{ contained_by: [{ var: 'tags' }, ['all', 'possible', 'tags']] }` |
| `overlaps` | Arrays overlap | `{ overlaps: [{ var: 'categories' }, ['tech', 'news']] }` |
| `any_of` | Value equals any element | `{ any_of: [{ var: 'tags' }, 'urgent'] }` |
| `not_any_of` | Value not in array | `{ not_any_of: [{ var: 'tags' }, 'spam'] }` |

### JSONB Operators (PostgreSQL)

| Operator | Description | Example |
|----------|-------------|---------|
| `json_contains` | JSONB contains | `{ json_contains: [{ var: 'metadata' }, {"key": "value"}] }` |
| `json_has_key` | JSONB has key | `{ json_has_key: [{ var: 'metadata' }, 'priority'] }` |
| `json_has_any_keys` | JSONB has any keys | `{ json_has_any_keys: [{ var: 'metadata' }, ['key1', 'key2']] }` |

### Null Check Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `is_null` | Value is NULL | `{ is_null: [{ var: 'deletedAt' }] }` |
| `is_not_null` | Value is not NULL | `{ is_not_null: [{ var: 'email' }] }` |

## Database Dialect Support

| Dialect | Key | Placeholder Style | Notes |
|---------|-----|-------------------|-------|
| PostgreSQL | `postgresql` | `$1`, `$2`, `$3`, ... | Full feature support including ILIKE, array operators, JSONB |
| MySQL | `mysql` | `?`, `?`, `?`, ... | Standard SQL features |
| SQL Server | `mssql` | `@p1`, `@p2`, `@p3`, ... | Standard SQL features |
| SQLite | `sqlite` | `?`, `?`, `?`, ... | Standard SQL features |

## Advanced Features

### Schema Mapping Utilities

Separate public schema (for frontend) from internal database schema:

```typescript
import { applyFieldMappings, toPublicSchema } from '@nam088/json-logic-to-sql';

// Define public schema (clean, no DB details)
const publicSchema: FilterSchema = {
  fields: {
    userName: { type: 'string', operators: ['eq', 'like'] },
    userEmail: { type: 'string', operators: ['eq'] },
    tags: { type: 'array', operators: ['contains'] },
    priority: { type: 'string', operators: ['eq'] },
  },
};

// Apply internal mappings on backend
const internalSchema = applyFieldMappings(publicSchema, {
  columns: {
    userName: { table: 'users', column: 'name' },
    userEmail: { table: 'users', column: 'email' },
    tags: '_tags', // Simple column rename
  },
  jsonPaths: {
    priority: "metadata->>'priority'", // JSONB path
  },
});

// Send public schema to frontend (without internal details)
const schemaForFrontend = toPublicSchema(internalSchema);
```

### Pagination and Sorting

```typescript
import { buildPagination, buildSort } from '@nam088/json-logic-to-sql';

// Build pagination
const pagination = buildPagination(
  { page: 2, pageSize: 20 },
  100, // max page size
  1    // starting param index
);
console.log(pagination.sql);
// Output: LIMIT $1 OFFSET $2
console.log(pagination.params);
// Output: { '$1': 20, '$2': 20 }

// Build sorting
const sort = buildSort(
  [
    { field: 'createdAt', direction: 'desc' },
    { field: 'name', direction: 'asc' },
  ],
  schema
);
console.log(sort.sql);
// Output: ORDER BY "created_at" DESC, "name" ASC
```

### SELECT Clause Generation

```typescript
import { buildSelect } from '@nam088/json-logic-to-sql';

const select = buildSelect(schema, {
  fields: ['firstName', 'lastName', 'email'],
  exclude: ['password'],
});
console.log(select.sql);
// Output: "first_name" AS "firstName", "last_name" AS "lastName", "email"
```

### Complete Query Example

```typescript
const compiler = new JsonLogicCompiler({ schema, dialect: 'postgresql' });

// Compile WHERE clause
const where = compiler.compile({
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] }
  ]
});

// Build SELECT
const select = buildSelect(schema, {
  fields: ['firstName', 'lastName', 'email', 'age']
});

// Build ORDER BY
const sort = buildSort([{ field: 'lastName', direction: 'asc' }], schema);

// Build LIMIT/OFFSET
const pagination = buildPagination({ page: 1, pageSize: 20 });

// Combine into full query
const query = `
  SELECT ${select.sql}
  FROM users
  WHERE ${where.sql}
  ${sort.sql}
  ${pagination.sql}
`;

const allParams = { ...where.params, ...pagination.params };
```

## Error Handling

The library throws specific error types for different scenarios:

```typescript
import { 
  CompilerError, 
  SchemaValidationError 
} from '@nam088/json-logic-to-sql';

try {
  const result = compiler.compile(rule);
} catch (error) {
  if (error instanceof SchemaValidationError) {
    // Schema validation failed
    console.error('Field:', error.field);
    console.error('Operator:', error.operator);
    console.error('Message:', error.message);
  } else if (error instanceof CompilerError) {
    // Compilation error (invalid rule structure, etc.)
    console.error('Compilation error:', error.message);
  }
}
```

## Security

The library implements multiple security layers:

1. **Parameterized Queries**: All values are passed as parameters, never interpolated
2. **Identifier Escaping**: Column and table names are properly quoted
3. **Schema Validation**: Only allowed fields and operators can be used
4. **Input Sanitization**: Deep sanitization of input rules
5. **Constraint Validation**: Values are validated against defined constraints
6. **Depth Limiting**: Prevents deeply nested rules that could cause performance issues
7. **Condition Limiting**: Prevents queries with excessive conditions

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  FilterSchema,
  FieldSchema,
  ComputedFieldSchema,
  CompilerConfig,
  SqlResult,
  Operator,
  FieldType,
  FieldConstraints,
  FieldTransform,
  TransformFn,
  CustomTransform,
  OptionConfig,
  OptionItem,
  LookupRegistry,
  LookupConfig,
} from '@nam088/json-logic-to-sql';
```

## Examples
479: 
480: For more comprehensive examples, check out the [examples directory](./examples) or the [unit tests](./src/__tests__) which cover all supported scenarios.


### Complex Nested Query

```typescript
const rule = {
  or: [
    {
      and: [
        { '==': [{ var: 'status' }, 'active'] },
        { '>': [{ var: 'age' }, 18] },
        { 'in': [{ var: 'country' }, ['US', 'CA', 'UK']] }
      ]
    },
    {
      and: [
        { '==': [{ var: 'role' }, 'admin'] },
        { 'is_not_null': [{ var: 'lastLogin' }] }
      ]
    }
  ]
};

const result = compiler.compile(rule);
// Generates: ((status = $1 AND age > $2 AND country IN ($3, $4, $5)) OR (role = $6 AND last_login IS NOT NULL))
```

### Array Operations (PostgreSQL)

```typescript
const schema: FilterSchema = {
  fields: {
    tags: {
      type: 'array',
      operators: ['contains', 'overlaps', 'any_of'],
    },
  },
};

// Check if array contains all values
const rule1 = { contains: [{ var: 'tags' }, ['urgent', 'bug']] };
// SQL: tags @> $1  (where $1 = ['urgent', 'bug'])

// Check if arrays overlap
const rule2 = { overlaps: [{ var: 'tags' }, ['tech', 'news']] };
// SQL: tags && $1

// Check if value is in array column
const rule3 = { any_of: [{ var: 'tags' }, 'urgent'] };
// SQL: $1 = ANY(tags)
```

### JSONB Queries (PostgreSQL)

```typescript
const schema: FilterSchema = {
  fields: {
    metadata: {
      type: 'jsonb',
      operators: ['json_contains', 'json_has_key'],
    },
    priority: {
      type: 'string',
      operators: ['eq', 'in'],
      jsonPath: "metadata->>'priority'",
    },
  },
};

const rule = {
  and: [
    { json_has_key: [{ var: 'metadata' }, 'priority'] },
    { '==': [{ var: 'priority' }, 'high'] }
  ]
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

@nam088
