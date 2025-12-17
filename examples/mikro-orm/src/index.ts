import 'reflect-metadata';
import { MikroORM, Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { 
  JsonLogicCompiler, 
  CompilerConfig, 
  buildSelect, 
  buildSort, 
  buildPagination 
} from '@nam088/json-logic-to-sql';

// 1. Define an Entity (Mock DB Schema)
@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property({ name: 'firstName' })
  firstName!: string;

  @Property({ name: 'lastName' })
  lastName!: string;

  @Property({ name: 'email' })
  @Unique()
  email!: string;

  @Property({ name: 'age' })
  age!: number;

  @Property({ name: 'roles' })
  roles!: string[]; // Simple array for JSON/String storage simulation
  
  @Property({ name: 'isActive', nullable: true })
  isActive?: boolean;
}

async function main() {
  // ... (Init and Seeding same) ...

  const orm = await MikroORM.init({
    entities: [User],
    dbName: ':memory:',
    driver: SqliteDriver,
    debug: false, // Turn off ORM debug to focus on our logs
  });
  
  // ... (Schema Generator and Seeding) ...
  const generator = orm.getSchemaGenerator();
  await generator.refreshDatabase();

  const em = orm.em.fork();

  const user1 = em.create(User, {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    age: 30,
    roles: ['admin', 'editor'],
    isActive: true,
  });

  const user2 = em.create(User, {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    age: 25,
    roles: ['viewer'],
    isActive: true,
  });

  const user3 = em.create(User, {
    firstName: 'Bob',
    lastName: 'Brown',
    email: 'bob@example.com',
    age: 40,
    roles: ['editor'],
    isActive: false,
  });

  const user4 = em.create(User, {
    firstName: 'Alice',
    lastName: 'Null',
    email: 'alice@example.com',
    age: 22,
    roles: ['guest'],
    isActive: null as any, // Explicitly null for testing IS NULL
  });

  await em.persistAndFlush([user1, user2, user3, user4]);
  console.log('--- Database Seeded ---');

  // === TEST: What does compiler.compile() return? ===
  console.log('\n=== TESTING COMPILER OUTPUT STRUCTURE ===');
  
  const testConfig: CompilerConfig = {
    schema: {
      fields: {
        name: { type: 'string', operators: ['eq', 'in'] },
        age: { type: 'number', operators: ['eq', 'gt', 'lt'] },
        status: { type: 'string', operators: ['eq'] },
      },
    },
    dialect: 'postgresql', // Use postgresql to show $N style
  };
  
  const testCompiler = new JsonLogicCompiler(testConfig);
  
  // Test: Complex AND with IN
  const testResult = testCompiler.compile({
    and: [
      { '==': [{ var: 'status' }, 'active'] },
      { '>': [{ var: 'age' }, 18] },
      { in: [{ var: 'name' }, ['Alice', 'Bob', 'Charlie']] },
    ]
  });
  
  console.log('SQL:', testResult.sql);
  console.log('Params (object):', testResult.params);
  console.log('Params keys:', Object.keys(testResult.params));
  
  // How to convert to array:
  const paramsArray = Object.keys(testResult.params)
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
    .map(k => testResult.params[k]);
  console.log('Params as array:', paramsArray);
  console.log('=== END TEST ===\n');

  // 4. Configure JSON Logic Compiler
  const config: CompilerConfig = {
    schema: {
      fields: {
        firstName: { type: 'string', operators: ['eq', 'like', 'in'], column: 'first_name' },
        lastName: { type: 'string', operators: ['eq', 'like'], column: 'last_name' },
        age: { type: 'number', operators: ['gt', 'lt', 'gte', 'lte', 'eq'] },
        email: { type: 'string', operators: ['eq'] },
        isActive: { type: 'boolean', operators: ['eq'], column: 'is_active', nullable: true },
        fullName: { 
          type: 'string', 
          operators: ['like'], 
          computed: true, 
          expression: "first_name || ' ' || last_name" // SQLite concat
        }
      },
    },
    dialect: 'sqlite',
  };

  const compiler = new JsonLogicCompiler(config);

  // 5. Define Query Parts
  const rule = {
    // Logic: Active users OR users older than 35
    or: [
      { eq: [{ var: 'isActive' }, true] },
      { '>': [{ var: 'age' }, 35] }
    ]
  };

  // 8. Advanced: Build Full SQL Query with Select, Sort, Pagination
  console.log('\n--- Building Full RAW SQL Query ---');

  // A. Build SELECT (Explicit fields + Computed field)
  const selectResult = buildSelect(config.schema, { 
    fields: ['firstName', 'age', 'fullName'] 
  });
  console.log('SELECT:', selectResult.sql);

  // B. Build WHERE (Compile Logic)
  const whereResult = compiler.compile(rule as any);
  console.log('WHERE:', whereResult.sql);

  // C. Build SORT (Order by Age DESC)
  const sortResult = buildSort([
    { field: 'age', direction: 'desc' }
  ], config.schema);
  console.log('ORDER BY:', sortResult.sql);

  // D. Build PAGINATION (Limit 2, Offset 0)
  const nextParamIndex = Object.keys(whereResult.params).length + 1;
  const paginationResult = buildPagination(
    { limit: 2, offset: 0 },
    100,
    nextParamIndex
  );
  console.log('LIMIT/OFFSET:', paginationResult.sql);

  // E. Combine SQL
  const fullSql = `
    SELECT ${selectResult.sql}
    FROM user
    WHERE ${whereResult.sql}
    ${sortResult.sql}
    ${paginationResult.sql}
  `;

  // F. Combine Params
  const allParams = {
    ...whereResult.params,
    ...paginationResult.params
  };

  console.log('FULL SQL:', fullSql.trim());
  console.log('FULL PARAMS:', allParams);

  // G. Execute Raw
  const paramValues = Object.keys(allParams)
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
    .map(k => allParams[k]);
  const driverParams = paramValues.map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const finalSql = fullSql.replace(/\$\d+/g, '?');

  const results = await em.getConnection().execute(finalSql, driverParams);
  console.log('\n--- Query Results ---');
  console.log(results);

  // 9. CASE NULL: Verify IS NULL handling (Fixed earlier)
  console.log('\n--- Testing NULL Handling (IS NULL) ---');
  const nullRule = {
    'eq': [{ var: 'isActive' }, null]
  };
  
  const nullWhere = compiler.compile(nullRule as any);
  console.log('Logic:', JSON.stringify(nullRule));
  console.log('SQL:', nullWhere.sql); // Should be "is_active" IS NULL
  
  // Execute
  const qbNull = em.createQueryBuilder(User);
  // IS NULL has no params usually, so pass []
  // But wait, if nullWhere has params (should be empty), we should handle it
  // In our case == null -> IS NULL, no params.
  qbNull.where(nullWhere.sql, Object.values(nullWhere.params)); 
  const nullResults = await qbNull.getResult();
  console.log('Result (Alice?):', nullResults.map(u => u.firstName));

  await orm.close();
}

main().catch(console.error);
