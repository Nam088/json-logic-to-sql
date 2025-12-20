# Quick Start Guide

Get started with `@nam088/json-logic-to-sql` in 5 minutes!

## Installation

```bash
npm install @nam088/json-logic-to-sql
```

## Basic Example

```javascript
import { JsonLogicCompiler } from '@nam088/json-logic-to-sql';

// 1. Define your schema
const schema = {
  fields: {
    status: {
      type: 'string',
      operators: ['eq', 'in'],
    },
    age: {
      type: 'number',
      operators: ['gt', 'lt', 'gte', 'lte', 'between'],
    },
  },
};

// 2. Create compiler
const compiler = new JsonLogicCompiler({
  schema,
  dialect: 'postgresql', // or 'mysql', 'mssql', 'sqlite'
});

// 3. Compile a rule
const rule = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] }
  ]
};

const result = compiler.compile(rule);

console.log(result.sql);
// Output: (("status" = $1) AND ("age" > $2))

console.log(result.params);
// Output: { '$1': 'active', '$2': 18 }

// 4. Use in your query
const query = `SELECT * FROM users WHERE ${result.sql}`;
// Execute with your database client using result.params
```

## Real-World Example with Express

```javascript
import express from 'express';
import { JsonLogicCompiler } from '@nam088/json-logic-to-sql';
import pg from 'pg';

const app = express();
app.use(express.json());

const schema = {
  fields: {
    firstName: { type: 'string', operators: ['eq', 'like'], column: 'first_name' },
    lastName: { type: 'string', operators: ['eq', 'like'], column: 'last_name' },
    age: { type: 'number', operators: ['eq', 'gt', 'lt', 'between'] },
    status: { type: 'string', operators: ['eq', 'in'] },
  },
};

const compiler = new JsonLogicCompiler({ schema, dialect: 'postgresql' });
const pool = new pg.Pool({ /* your config */ });

app.post('/api/users/search', async (req, res) => {
  try {
    // Compile the filter from request
    const { sql, params } = compiler.compile(req.body.filter);
    
    // Build full query
    const query = `
      SELECT first_name, last_name, age, status
      FROM users
      WHERE ${sql}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    
    // Execute with parameterized values
    const result = await pool.query(query, Object.values(params));
    
    res.json({ users: result.rows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

## Example Requests

```bash
# Find active users over 18
curl -X POST http://localhost:3000/api/users/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "and": [
        { "==": [{ "var": "status" }, "active"] },
        { ">": [{ "var": "age" }, 18] }
      ]
    }
  }'

# Find users named John or Jane
curl -X POST http://localhost:3000/api/users/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "in": [{ "var": "firstName" }, ["John", "Jane"]]
    }
  }'

# Complex query
curl -X POST http://localhost:3000/api/users/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "or": [
        {
          "and": [
            { "==": [{ "var": "status" }, "active"] },
            { "between": [{ "var": "age" }, 18, 65] }
          ]
        },
        { "like": [{ "var": "lastName" }, "Smith%"] }
      ]
    }
  }'
```

## TypeScript Example

```typescript
import { 
  JsonLogicCompiler, 
  type FilterSchema,
  type JsonLogicRule 
} from '@nam088/json-logic-to-sql';

const schema: FilterSchema = {
  fields: {
    email: {
      type: 'string',
      operators: ['eq', 'like'],
      transform: { input: 'lower' }, // Auto-lowercase for comparison
    },
    age: {
      type: 'number',
      operators: ['gt', 'lt', 'between'],
      constraints: { min: 0, max: 150 }, // Validation
    },
    status: {
      type: 'string',
      operators: ['eq', 'in'],
      options: {
        items: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        strict: true, // Only allow these values
      },
    },
  },
};

const compiler = new JsonLogicCompiler({ schema, dialect: 'postgresql' });

const rule: JsonLogicRule = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] },
  ],
};

const { sql, params } = compiler.compile(rule);
```

## Next Steps

- Read the [full documentation](./README.md)
- Check out [examples](./examples/)
- Learn about [advanced features](./README.md#advanced-features)

## Common Use Cases

### 1. Dynamic Filters in Admin Panels

Allow admins to build complex filters without writing SQL:

```javascript
const rule = {
  and: [
    { '==': [{ var: 'role' }, 'admin'] },
    { '>': [{ var: 'lastLogin' }, '2024-01-01'] }
  ]
};
```

### 2. API Query Parameters

Convert URL query params to SQL:

```javascript
// GET /api/products?status=active&price_gt=100
const rule = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'price' }, 100] }
  ]
};
```

### 3. Saved Filters

Store user-defined filters as JSON:

```javascript
// Save to database
const savedFilter = {
  name: "My Active Users",
  rule: {
    and: [
      { '==': [{ var: 'status' }, 'active'] },
      { '>': [{ var: 'age' }, 18] }
    ]
  }
};

// Load and use later
const { sql, params } = compiler.compile(savedFilter.rule);
```

## Security

The library automatically:
- Uses parameterized queries (prevents SQL injection)
- Validates all fields against schema
- Validates all operators against allowed list
- Validates all values against constraints
- Escapes identifiers properly

You're safe by default!

## Support

- Issues: https://github.com/nam088/json-logic-to-sql/issues
- npm: https://www.npmjs.com/package/@nam088/json-logic-to-sql


