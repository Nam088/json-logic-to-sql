import {
  JsonLogicCompiler,
  type FilterSchema,
  type JsonLogicRule,
  buildPagination,
  buildSort,
  buildSelect,
  applyFieldMappings,
  toPublicSchema,
} from '@nam088/json-logic-to-sql';

console.log('🚀 Advanced TypeScript Examples\n');

// ============================================
// Example 1: Schema with Computed Fields
// ============================================
console.log('═══════════════════════════════════════════════════════');
console.log('Example 1: Computed Fields & Transforms');
console.log('═══════════════════════════════════════════════════════\n');

const schema: FilterSchema = {
  fields: {
    firstName: {
      type: 'string',
      title: 'First Name',
      inputType: 'text',
      operators: ['eq', 'like', 'ilike', 'in'],
      column: 'first_name',
      selectable: true,
      sortable: true,
    },
    lastName: {
      type: 'string',
      title: 'Last Name',
      inputType: 'text',
      operators: ['eq', 'like'],
      column: 'last_name',
      selectable: true,
      sortable: true,
    },
    fullName: {
      type: 'string',
      title: 'Full Name',
      inputType: 'text',
      operators: ['like', 'ilike'],
      computed: true,
      expression: "first_name || ' ' || last_name",
      selectable: true,
      sortable: true,
    },
    email: {
      type: 'string',
      title: 'Email',
      inputType: 'text',
      operators: ['eq', 'like', 'ilike'],
      transform: {
        input: 'lower',
        output: 'lower',
      },
      selectable: true,
    },
    age: {
      type: 'number',
      title: 'Age',
      inputType: 'number',
      operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'between'],
      constraints: {
        min: 0,
        max: 150,
      },
      selectable: true,
      sortable: true,
    },
    ageGroup: {
      type: 'string',
      title: 'Age Group',
      inputType: 'text',
      operators: ['eq', 'in'],
      computed: true,
      expression: "CASE WHEN age < 18 THEN 'minor' WHEN age < 65 THEN 'adult' ELSE 'senior' END",
      selectable: true,
    },
    status: {
      type: 'string',
      title: 'Status',
      inputType: 'select',
      operators: ['eq', 'in', 'ne'],
      options: {
        items: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'pending', label: 'Pending' },
        ],
        strict: true,
      },
      selectable: true,
      sortable: true,
    },
    createdAt: {
      type: 'datetime',
      title: 'Created At',
      inputType: 'datetime',
      operators: ['gt', 'lt', 'gte', 'lte', 'between'],
      column: 'created_at',
      selectable: true,
      sortable: true,
    },
  },
  settings: {
    maxDepth: 5,
    maxConditions: 100,
  },
};

const compiler = new JsonLogicCompiler({
  schema,
  dialect: 'postgresql',
});

// Query with computed field
const rule1: JsonLogicRule = {
  and: [
    { ilike: [{ var: 'fullName' }, '%john doe%'] },
    { '==': [{ var: 'ageGroup' }, 'adult'] },
  ],
};

const result1 = compiler.compile(rule1);
console.log('Query with computed fields:');
console.log('SQL:', result1.sql);
console.log('Params:', result1.params);

// ============================================
// Example 2: Complete Query Builder
// ============================================
console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 2: Complete Query with Pagination & Sorting');
console.log('═══════════════════════════════════════════════════════\n');

const rule2: JsonLogicRule = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>=': [{ var: 'age' }, 18] },
  ],
};

const whereClause = compiler.compile(rule2);

const selectClause = buildSelect(schema, {
  fields: ['firstName', 'lastName', 'email', 'age', 'status'],
});

const sortClause = buildSort(
  [
    { field: 'lastName', direction: 'asc' },
    { field: 'firstName', direction: 'asc' },
  ],
  schema
);

const paginationClause = buildPagination(
  { page: 1, pageSize: 20 },
  100,
  whereClause.params ? Object.keys(whereClause.params).length + 1 : 1
);

const fullQuery = `
SELECT ${selectClause.sql}
FROM users
WHERE ${whereClause.sql}
${sortClause.sql}
${paginationClause.sql}
`.trim();

console.log('Complete Query:');
console.log(fullQuery);
console.log('\nAll Params:', {
  ...whereClause.params,
  ...paginationClause.params,
});

// ============================================
// Example 3: Schema Mapping (Public vs Internal)
// ============================================
console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 3: Schema Mapping (Public/Internal Separation)');
console.log('═══════════════════════════════════════════════════════\n');

// Public schema (sent to frontend)
const publicSchema: FilterSchema = {
  fields: {
    userName: {
      type: 'string',
      title: 'User Name',
      inputType: 'text',
      operators: ['eq', 'like', 'ilike'],
    },
    userEmail: {
      type: 'string',
      title: 'User Email',
      inputType: 'text',
      operators: ['eq', 'like'],
    },
    userAge: {
      type: 'number',
      title: 'User Age',
      inputType: 'number',
      operators: ['eq', 'gt', 'lt', 'between'],
    },
    accountStatus: {
      type: 'string',
      title: 'Account Status',
      inputType: 'select',
      operators: ['eq', 'in'],
    },
  },
};

// Apply internal mappings on backend
const internalSchema = applyFieldMappings(publicSchema, {
  columns: {
    userName: { table: 'users', column: 'name' },
    userEmail: { table: 'users', column: 'email' },
    userAge: { table: 'users', column: 'age' },
    accountStatus: 'status', // Simple column rename
  },
});

console.log('Public Schema (for frontend):');
console.log(JSON.stringify(toPublicSchema(internalSchema), null, 2));

const mappedCompiler = new JsonLogicCompiler({
  schema: internalSchema,
  dialect: 'postgresql',
});

const rule3: JsonLogicRule = {
  and: [
    { '==': [{ var: 'accountStatus' }, 'active'] },
    { '>': [{ var: 'userAge' }, 18] },
  ],
};

const result3 = mappedCompiler.compile(rule3);
console.log('\nCompiled SQL with mapped columns:');
console.log('SQL:', result3.sql);
console.log('Params:', result3.params);

// ============================================
// Example 4: Multi-Dialect Support
// ============================================
console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 4: Multi-Dialect Support');
console.log('═══════════════════════════════════════════════════════\n');

const testRule: JsonLogicRule = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] },
    { in: [{ var: 'firstName' }, ['John', 'Jane', 'Bob']] },
  ],
};

const dialects = ['postgresql', 'mysql', 'mssql', 'sqlite'] as const;

for (const dialect of dialects) {
  const dialectCompiler = new JsonLogicCompiler({
    schema,
    dialect,
  });

  const result = dialectCompiler.compile(testRule);
  console.log(`${dialect.toUpperCase()}:`);
  console.log('  SQL:', result.sql);
  console.log('  Params:', result.params);
  console.log();
}

// ============================================
// Example 5: Error Handling
// ============================================
console.log('═══════════════════════════════════════════════════════');
console.log('Example 5: Type-Safe Error Handling');
console.log('═══════════════════════════════════════════════════════\n');

import { SchemaValidationError, CompilerError } from '@nam088/json-logic-to-sql';

const invalidRules: Array<{ name: string; rule: JsonLogicRule }> = [
  {
    name: 'Invalid field',
    rule: { '==': [{ var: 'nonExistentField' }, 'value'] },
  },
  {
    name: 'Invalid operator',
    rule: { '>': [{ var: 'firstName' }, 'John'] }, // 'firstName' doesn't have 'gt' operator
  },
  {
    name: 'Invalid option value',
    rule: { '==': [{ var: 'status' }, 'invalid_status'] },
  },
  {
    name: 'Age constraint violation',
    rule: { '==': [{ var: 'age' }, 200] }, // Max is 150
  },
];

for (const { name, rule } of invalidRules) {
  try {
    compiler.compile(rule);
    console.log(`❌ ${name}: Should have thrown error`);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      console.log(`✓ ${name}:`);
      console.log(`  Field: ${error.field}`);
      console.log(`  Operator: ${error.operator}`);
      console.log(`  Message: ${error.message}`);
    } else if (error instanceof CompilerError) {
      console.log(`✓ ${name}:`);
      console.log(`  Message: ${error.message}`);
    }
  }
}

// ============================================
// Example 6: Complex Real-World Query
// ============================================
console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 6: Complex Real-World Query');
console.log('═══════════════════════════════════════════════════════\n');

const complexRule: JsonLogicRule = {
  or: [
    {
      // Active users over 18 from specific countries
      and: [
        { '==': [{ var: 'status' }, 'active'] },
        { '>=': [{ var: 'age' }, 18] },
        { ilike: [{ var: 'email' }, '%@company.com'] },
      ],
    },
    {
      // Or pending users in age range
      and: [
        { '==': [{ var: 'status' }, 'pending'] },
        { between: [{ var: 'age' }, 25, 45] },
      ],
    },
  ],
};

const complexResult = compiler.compile(complexRule);

console.log('Complex Business Logic Query:');
console.log('SQL:', complexResult.sql);
console.log('Params:', complexResult.params);

const businessQuery = `
-- Find users matching complex criteria
SELECT 
  first_name,
  last_name,
  email,
  age,
  status,
  created_at
FROM users
WHERE ${complexResult.sql}
ORDER BY created_at DESC
LIMIT 100;
`.trim();

console.log('\nFull Business Query:');
console.log(businessQuery);

console.log('\n✅ All advanced examples completed!');

