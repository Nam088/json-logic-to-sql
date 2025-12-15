
import sql from 'mssql';
import { JsonLogicCompiler } from '../compiler';
import { FilterSchema } from '../types';

/**
 * Exhaustive Integration Tests for MSSQL
 * 
 * Uses 'mssql' driver (node-mssql) and requires a running MSSQL instance.
 * (See docker-compose.yml, port 14330)
 */
describe('MSSQL Integration (Exhaustive)', () => {
  let pool: sql.ConnectionPool;
  let hasConnection = false;

  // Schema Definition
  const testSchema: FilterSchema = {
    fields: {
      // String types
      name: { type: 'string', operators: ['eq', 'ne', 'like', 'ilike', 'contains', 'starts_with', 'ends_with'] },
      email: { type: 'string', operators: ['eq', 'is_null', 'is_not_null', 'starts_with', 'ends_with'], nullable: true },
      
      // Number types
      age: { type: 'number', operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in'] },
      score: { type: 'number', operators: ['eq', 'gt', 'lt'] }, // float
      
      // Boolean
      active: { type: 'boolean', operators: ['eq'] },
      verified: { type: 'boolean', operators: ['is_null', 'eq'], nullable: true },
      
      // Date
      joinedAt: { type: 'date', operators: ['gt', 'lt', 'between', 'gte', 'lte'] },
      
      // JSON (Not fully supported in dialect yet, but let's test basic string operators on nvarchar or fail gracefully)
      // tags: { type: 'json', operators: ['json_contains'] } 
    }
  };

  const compiler = new JsonLogicCompiler({ schema: testSchema, dialect: 'mssql' });

  beforeAll(async () => {
    try {
      const config = {
        user: 'sa',
        password: 'StrongP@ssw0rd!',
        server: 'localhost',
        port: 14330,
        database: 'master', // Start with master to create test db
        options: {
          encrypt: false, // For localhost Docker
          trustServerCertificate: true
        }
      };

      // Connect to master
      const masterPool = await new sql.ConnectionPool(config).connect();
      
      // Create test database if not exists
      await masterPool.query`IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'json_logic_test')
      BEGIN
        CREATE DATABASE json_logic_test;
      END`;
      
      await masterPool.close();

      // Connect to test database
      config.database = 'json_logic_test';
      pool = await new sql.ConnectionPool(config).connect();
      hasConnection = true;

      // Setup Schema
      // MSSQL syntax for drop if exists
      await pool.query`IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users`;
      
      // Identity is AUTO_INCREMENT, BIT is boolean
      await pool.query`
        CREATE TABLE users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255),
          email NVARCHAR(255),
          age INT,
          score FLOAT,
          active BIT,
          verified BIT,
          joinedAt DATETIME2
        )
      `;

      // Seed Data
      // Use parameterized query properly or string literal for setup
      const request = pool.request();
      // Insert one by one to keep simple validation
      const users = [
        { name: 'Alice', email: 'alice@test.com', age: 25, score: 98.5, active: 1, verified: 1, joinedAt: '2023-01-01T10:00:00' },
        { name: 'Bob', email: 'bob@test.com', age: 30, score: 85.0, active: 0, verified: 0, joinedAt: '2022-05-15T08:30:00' },
        { name: 'Charlie', email: null, age: 35, score: 72.5, active: 1, verified: null, joinedAt: '2021-12-20T14:00:00' },
        { name: 'David', email: 'david@test.com', age: 40, score: 90.0, active: 1, verified: 1, joinedAt: '2020-03-10T09:15:00' },
        { name: 'Eve', email: 'eve@example.com', age: 20, score: 95.0, active: 0, verified: 1, joinedAt: '2023-11-05T16:45:00' },
        { name: 'Frank', email: 'frank@example.com', age: 45, score: 60.0, active: 1, verified: 0, joinedAt: '2019-08-15T11:20:00' },
      ];

      for (const u of users) {
        await pool.request()
          .input('name', sql.NVarChar, u.name)
          .input('email', sql.NVarChar, u.email)
          .input('age', sql.Int, u.age)
          .input('score', sql.Float, u.score)
          .input('active', sql.Bit, u.active)
          .input('verified', sql.Bit, u.verified) // Nullable bit
          .input('joinedAt', sql.DateTime2, u.joinedAt)
          .query('INSERT INTO users (name, email, age, score, active, verified, joinedAt) VALUES (@name, @email, @age, @score, @active, @verified, @joinedAt)');
      }

    } catch (err) {
      console.warn('Skipping MSSQL tests: Could not connect to database. Ensure Docker container is running.', err);
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.close();
    }
  });

  // Helper to run query
  const query = async (logic: any) => {
    if (!hasConnection) return [];
    const { sql: whereClause, params } = compiler.compile(logic);
    
    // MSSQL Params: object key @p1 -> value.
    // node-mssql 'input' needs name without @.
    
    const request = pool.request();
    for (const key in params) {
        // key is @p1, @p2... strip @
        const info = key.substring(1);
        request.input(info, params[key]);
    }
    
    // console.log(`DEBUG MSSQL: SELECT * FROM users WHERE ${whereClause}`, params);

    const result = await request.query(`SELECT * FROM users WHERE ${whereClause}`);
    return result.recordset;
  };

  const runTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!hasConnection) {
        console.warn(`Skipping test ${name} - No DB connection`);
        return;
      }
      await fn();
    });
  };

  // =====================================
  // STRING OPERATORS
  // =====================================
  describe('String Operators', () => {
      runTest('eq - exact match', async () => {
          const rows = await query({ '==': [{ var: 'name' }, 'Alice'] });
          expect(rows).toHaveLength(1);
          expect(rows[0].name).toBe('Alice');
      });

      runTest('ne - not equal', async () => {
          const rows = await query({ '!=': [{ var: 'name' }, 'Alice'] });
          expect(rows).toHaveLength(5);
      });

      runTest('like - pattern match', async () => {
          const rows = await query({ 'like': [{ var: 'name' }, 'Bob%'] });
          expect(rows).toHaveLength(1);
          expect(rows[0].name).toBe('Bob');
      });

      runTest('contains - substring', async () => {
          const rows = await query({ 'contains': [{ var: 'name' }, 'li'] }); // Alice, Charlie
          expect(rows).toHaveLength(2);
      });

      runTest('starts_with', async () => {
           const rows = await query({ 'starts_with': [{ var: 'email' }, 'bob'] });
           expect(rows).toHaveLength(1);
      });

      runTest('ends_with', async () => {
           const rows = await query({ 'ends_with': [{ var: 'email' }, 'example.com'] }); // Eve, Frank
           expect(rows).toHaveLength(2);
      });

      // Regex not supported in MSSQL standard
  });

  // =====================================
  // NUMBER OPERATORS
  // =====================================
  describe('Number Operators', () => {
      runTest('eq', async () => {
           const rows = await query({ '==': [{ var: 'age' }, 30] });
           expect(rows).toHaveLength(1);
           expect(rows[0].name).toBe('Bob');
      });

      runTest('gt - greater than', async () => {
           const rows = await query({ '>': [{ var: 'age' }, 30] });
           expect(rows).toHaveLength(3); // Charlie, David, Frank
      });

      runTest('gte - greater or equal', async () => {
           const rows = await query({ '>=': [{ var: 'age' }, 30] });
           expect(rows).toHaveLength(4); // Bob + others
      });
      
      runTest('in', async () => {
          const rows = await query({ 'in': [{ var: 'age' }, [20, 30]] }); // Eve, Bob
          expect(rows).toHaveLength(2);
      });
      
      runTest('between', async () => {
          const rows = await query({ 'between': [{ var: 'age' }, 20, 30] }); // Eve(20), Alice(25), Bob(30)
          expect(rows).toHaveLength(3);
      });

      runTest('float comparison', async () => {
          const rows = await query({ '>': [{ var: 'score' }, 90.0] }); // Alice(98.5), Eve(95.0)
          expect(rows).toHaveLength(2);
      });
  });

  // =====================================
  // BOOLEAN OPERATORS
  // =====================================
  describe('Boolean Operators', () => {
      // MSSQL active=1 or active=0
      runTest('eq true', async () => {
          const rows = await query({ '==': [{ var: 'active' }, true] });
          // Alice, Charlie, David, Frank
          expect(rows).toHaveLength(4);
      });

      runTest('eq false', async () => {
           const rows = await query({ '==': [{ var: 'active' }, false] });
           // Bob, Eve
           expect(rows).toHaveLength(2);
      });
  });

  // =====================================
  // NULL OPERATORS
  // =====================================
  describe('Null Operators', () => {
      runTest('is_null', async () => {
           const rows = await query({ 'is_null': [{ var: 'email' }] }); // Charlie
           expect(rows).toHaveLength(1);
           expect(rows[0].name).toBe('Charlie');
      });

      runTest('is_not_null', async () => {
           const rows = await query({ 'is_not_null': [{ var: 'email' }] });
           expect(rows).toHaveLength(5);
      });
  });

  // =====================================
  // DATE OPERATORS
  // =====================================
  describe('Date Operators', () => {
     runTest('gt date', async () => {
         const rows = await query({ '>': [{ var: 'joinedAt' }, '2023-01-01'] }); 
         // MSSQL implicitly converts string to date if valid format
         expect(rows.length).toBeGreaterThanOrEqual(2); 
     });
  });

});
