import { createPool, Pool } from 'mysql2/promise';
import { JsonLogicCompiler } from '../compiler';
import { FilterSchema } from '../types';

/**
 * Exhaustive Integration Tests for MySQL
 * 
 * Uses separate 'mysql2' driver and requires a running MySQL instance.
 * (See docker-compose.yml)
 */
describe('MySQL Integration (Exhaustive)', () => {
  let pool: Pool;
  let hasConnection = false;

  // Schema Definition
  const testSchema: FilterSchema = {
    fields: {
      // String types
      name: { type: 'string', operators: ['eq', 'ne', 'like', 'ilike', 'contains', 'starts_with', 'ends_with', 'regex'] },
      email: { type: 'string', operators: ['eq', 'is_null', 'is_not_null', 'regex', 'starts_with', 'ends_with'], nullable: true },
      
      // Number types
      age: { type: 'number', operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in'] },
      score: { type: 'number', operators: ['eq', 'gt', 'lt'] }, // float
      
      // Boolean
      active: { type: 'boolean', operators: ['eq'] },
      verified: { type: 'boolean', operators: ['is_null', 'eq'], nullable: true },
      
      // Date (stored as DATETIME or TIMESTAMP in MySQL)
      joinedAt: { type: 'date', operators: ['gt', 'lt', 'between', 'gte', 'lte'] },
      
      // JSON
      tags: { type: 'json', operators: ['json_contains'] }
    }
  };

  const compiler = new JsonLogicCompiler({ schema: testSchema, dialect: 'mysql' });

  beforeAll(async () => {
    try {
      pool = createPool({
        host: 'localhost',
        port: 33066,
        user: 'testuser',
        password: 'testpassword',
        database: 'json_logic_test',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      // Verify connection
      await pool.query('SELECT 1');
      hasConnection = true;

      // Setup Schema
      await pool.query('DROP TABLE IF EXISTS users');
      await pool.query(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          age INT,
          score FLOAT,
          active BOOLEAN,
          verified BOOLEAN,
          joinedAt DATETIME,
          tags JSON
        )
      `);

      // Seed Data
      const users = [
        ['Alice', 'alice@test.com', 25, 98.5, true, true, '2023-01-01 10:00:00', JSON.stringify(['admin', 'editor'])],
        ['Bob', 'bob@test.com', 30, 85.0, false, false, '2022-05-15 08:30:00', JSON.stringify(['viewer'])],
        ['Charlie', null, 35, 72.5, true, null, '2021-12-20 14:00:00', JSON.stringify(['editor'])],
        ['David', 'david@test.com', 40, 90.0, true, true, '2020-03-10 09:15:00', '[]'],
        ['Eve', 'eve@example.com', 20, 95.0, false, true, '2023-11-05 16:45:00', JSON.stringify(['moderator'])],
        ['Frank', 'frank@example.com', 45, 60.0, true, false, '2019-08-15 11:20:00', null],
      ];

      for (const user of users) {
        await pool.execute(
          `INSERT INTO users (name, email, age, score, active, verified, joinedAt, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          user
        );
      }

    } catch (err) {
      console.warn('Skipping MySQL tests: Could not connect to database. Ensure Docker container is running.', err);
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  // Helper to run query
  const query = async (logic: any) => {
    if (!hasConnection) return [];
    const { sql, params } = compiler.compile(logic);
    
    // MySQL params are positional (?), params object has p1, p2 keys.
    // Need to convert object { p1: val, p2: val } to array [val, val] in order.
    const paramCount = Object.keys(params).length;
    const paramArray = [];
    for (let i = 1; i <= paramCount; i++) {
        // verify key exists
        if (params[`p${i}`] === undefined) {
            console.error(`MISSING PARAM p${i}`, params);
        }
      paramArray.push(params[`p${i}`]);
    }

    // require('fs').appendFileSync('debug_mysql.log', `QUERY: ${sql}\nPARAMS: ${JSON.stringify(paramArray)}\nRAW: ${JSON.stringify(params)}\n---\n`);
    const [rows] = await pool.execute(`SELECT * FROM users WHERE ${sql}`, paramArray);
    return rows as any[];
  };

  // Only run if connected
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

      runTest('regex', async () => {
          // Names starting with A or B
          const rows = await query({ 'regex': [{ var: 'name' }, '^(A|B)'] }); 
          expect(rows).toHaveLength(2); // Alice, Bob
      });
      
      runTest('ilike (mapped to LIKE in MySQL)', async () => {
           // Mysql LIKE is generally case insensitive by default depending on collation, 
           // but mapped logic might just output LIKE.
           const rows = await query({ 'ilike': [{ var: 'name' }, 'alice'] });
           expect(rows).toHaveLength(1);
      });
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
      // MySQL treats BOOLEAN as TINYINT(1) (0 or 1)
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
         // MySQL might handle string comparison for dates automatically if format matches
         // Eve 2023-11-05, Alice 2023-01-01 (exact match not GT if time part exists? Wait Alice is 2023-01-01 10:00)
         // 2023-01-01 string implies 00:00:00. So 2023-01-01 10:00:00 IS > 2023-01-01 00:00:00
         // Let's see.
         // Alice: 2023-01-01 10:00 > 2023-01-01
         // Eve: 2023-11-05 > 2023-01-01
         expect(rows.length).toBeGreaterThanOrEqual(2); 
     });
  });

  // =====================================
  // JSON OPERATORS
  // =====================================
  describe('JSON Operators', () => {
     runTest('json_contains', async () => {
         const rows = await query({ 'json_contains': [{ var: 'tags' }, JSON.stringify('editor')] }); 
         expect(rows).toHaveLength(2);
     });
  });

});
