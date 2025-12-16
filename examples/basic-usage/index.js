import { JsonLogicCompiler } from '@nam088/json-logic-to-sql';

console.log('🚀 Testing @nam088/json-logic-to-sql\n');

// 1. Define schema
const schema = {
  fields: {
    firstName: {
      type: 'string',
      operators: ['eq', 'ne', 'like', 'ilike'],
      column: 'first_name',
    },
    lastName: {
      type: 'string',
      operators: ['eq', 'like'],
      column: 'last_name',
    },
    age: {
      type: 'number',
      operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'between'],
      constraints: {
        min: 0,
        max: 150,
      },
    },
    email: {
      type: 'string',
      operators: ['eq', 'like', 'ilike'],
      transform: {
        input: 'lower',
      },
    },
    status: {
      type: 'string',
      operators: ['eq', 'in', 'ne'],
      options: {
        items: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'pending', label: 'Pending' },
        ],
        strict: true,
      },
    },
    country: {
      type: 'string',
      operators: ['eq', 'in'],
    },
    createdAt: {
      type: 'datetime',
      operators: ['gt', 'lt', 'gte', 'lte', 'between'],
      column: 'created_at',
    },
  },
  settings: {
    maxDepth: 5,
    maxConditions: 100,
  },
};

// 2. Initialize compiler for PostgreSQL
const pgCompiler = new JsonLogicCompiler({
  schema,
  dialect: 'postgresql',
});

console.log('═══════════════════════════════════════════════════════');
console.log('Example 1: Simple Equality');
console.log('═══════════════════════════════════════════════════════');

const rule1 = {
  '==': [{ var: 'status' }, 'active']
};

try {
  const result1 = pgCompiler.compile(rule1);
  console.log('Rule:', JSON.stringify(rule1, null, 2));
  console.log('SQL:', result1.sql);
  console.log('Params:', result1.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 2: AND Condition');
console.log('═══════════════════════════════════════════════════════');

const rule2 = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] }
  ]
};

try {
  const result2 = pgCompiler.compile(rule2);
  console.log('Rule:', JSON.stringify(rule2, null, 2));
  console.log('SQL:', result2.sql);
  console.log('Params:', result2.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 3: Complex Nested Query');
console.log('═══════════════════════════════════════════════════════');

const rule3 = {
  or: [
    {
      and: [
        { '==': [{ var: 'status' }, 'active'] },
        { '>': [{ var: 'age' }, 18] },
        { in: [{ var: 'country' }, ['US', 'CA', 'UK']] }
      ]
    },
    {
      and: [
        { '==': [{ var: 'status' }, 'pending'] },
        { '>=': [{ var: 'age' }, 21] }
      ]
    }
  ]
};

try {
  const result3 = pgCompiler.compile(rule3);
  console.log('Rule:', JSON.stringify(rule3, null, 2));
  console.log('SQL:', result3.sql);
  console.log('Params:', result3.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 4: String Operations (LIKE, ILIKE)');
console.log('═══════════════════════════════════════════════════════');

const rule4 = {
  and: [
    { ilike: [{ var: 'firstName' }, 'john%'] },
    { like: [{ var: 'email' }, '%@gmail.com'] }
  ]
};

try {
  const result4 = pgCompiler.compile(rule4);
  console.log('Rule:', JSON.stringify(rule4, null, 2));
  console.log('SQL:', result4.sql);
  console.log('Params:', result4.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 5: BETWEEN Operator');
console.log('═══════════════════════════════════════════════════════');

const rule5 = {
  between: [{ var: 'age' }, 18, 65]
};

try {
  const result5 = pgCompiler.compile(rule5);
  console.log('Rule:', JSON.stringify(rule5, null, 2));
  console.log('SQL:', result5.sql);
  console.log('Params:', result5.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 6: MySQL Dialect');
console.log('═══════════════════════════════════════════════════════');

const mysqlCompiler = new JsonLogicCompiler({
  schema,
  dialect: 'mysql',
});

const rule6 = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>': [{ var: 'age' }, 18] }
  ]
};

try {
  const result6 = mysqlCompiler.compile(rule6);
  console.log('Rule:', JSON.stringify(rule6, null, 2));
  console.log('SQL (MySQL):', result6.sql);
  console.log('Params:', result6.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 7: Validation Error (Invalid Value)');
console.log('═══════════════════════════════════════════════════════');

const rule7 = {
  '==': [{ var: 'status' }, 'invalid_status'] // Not in allowed options
};

try {
  const result7 = pgCompiler.compile(rule7);
  console.log('SQL:', result7.sql);
} catch (error) {
  console.error('✓ Expected Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('Example 8: Full Query Example');
console.log('═══════════════════════════════════════════════════════');

const rule8 = {
  and: [
    { '==': [{ var: 'status' }, 'active'] },
    { '>=': [{ var: 'age' }, 18] }
  ]
};

try {
  const result8 = pgCompiler.compile(rule8);
  
  const fullQuery = `
SELECT first_name, last_name, email, age, status
FROM users
WHERE ${result8.sql}
ORDER BY created_at DESC
LIMIT 10;
  `.trim();
  
  console.log('Full Query:');
  console.log(fullQuery);
  console.log('\nParams:', result8.params);
} catch (error) {
  console.error('Error:', error.message);
}

console.log('\n✅ All examples completed!');

