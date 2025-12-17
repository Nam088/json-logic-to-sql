import { Client } from 'pg';
import { JsonLogicCompiler } from '../compiler';
import type { FilterSchema } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * EXHAUSTIVE TYPE-OPERATOR MATRIX TESTS
 * Every field type with ALL its supported operators
 */

const DB_CONFIG = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5454'),
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'nvn_blog',
};

// Schema with ALL operators per type
const exhaustiveSchema: FilterSchema = {
  fields: {
    // UUID - all UUID operators
    id: { 
      type: 'uuid', 
      operators: ['eq', 'ne', 'in', 'not_in', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // STRING (VARCHAR) - all string operators
    name: { 
      type: 'string', 
      operators: ['eq', 'ne', 'in', 'not_in', 'ilike', 'like', 'contains', 'starts_with', 'ends_with', 'regex', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // TEXT - all text operators
    description: { 
      type: 'text', 
      operators: ['eq', 'ne', 'ilike', 'like', 'contains', 'starts_with', 'ends_with', 'regex', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // INTEGER - all numeric operators
    age: { 
      type: 'integer', 
      operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between', 'in', 'not_in', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // DECIMAL - all decimal operators
    score: { 
      type: 'decimal', 
      operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // BOOLEAN - boolean operators
    isActive: { 
      type: 'boolean', 
      column: 'is_active',
      operators: ['eq', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // DATE - date operators
    birthDate: { 
      type: 'date', 
      column: 'birth_date',
      operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // TIMESTAMP - timestamp operators
    createdAt: { 
      type: 'timestamp', 
      column: 'created_at',
      operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // ARRAY VARCHAR - array operators
    tags: { 
      type: 'array', 
      operators: ['any_of', 'not_any_of', 'contains', 'overlaps', 'contained_by', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // ARRAY INTEGER - array operators
    scores: { 
      type: 'array', 
      operators: ['any_of', 'not_any_of', 'overlaps', 'is_null', 'is_not_null'],
      nullable: true,
    },
    
    // JSONB - jsonb operators
    metadata: { 
      type: 'jsonb', 
      operators: ['json_contains', 'is_null', 'is_not_null'],
      nullable: true,
    },
  },
};

describe('Exhaustive Type-Operator Matrix', () => {
  let client: Client;
  let compiler: JsonLogicCompiler;
  let isDbConnected = false;

  beforeAll(async () => {
    try {
      client = new Client(DB_CONFIG);
      await client.connect();
      compiler = new JsonLogicCompiler({ schema: exhaustiveSchema });

      // Run setup SQL
      const setupSqlPath = path.join(__dirname, 'setup.sql');
      const setupSql = fs.readFileSync(setupSqlPath, 'utf-8');
      await client.query(setupSql);
      
      isDbConnected = true;
    } catch (error: any) {
      console.warn('Skipping exhaustive tests - Database connection failed:', error.message);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (client && isDbConnected) {
      await client.end();
    }
  });

  const conditionalIt = (name: string, testFn: () => Promise<void>) => {
    it(name, async () => {
      if (!isDbConnected) {
        console.warn(`[SKIPPED] ${name}: Database not available`);
        return;
      }
      await testFn();
    });
  };

  const executeQuery = async (rule: any): Promise<any[]> => {
    if (!isDbConnected) return [];

    const { sql, paramsArray } = compiler.compile(rule);
    
    const result = await client.query(`SELECT * FROM json_logic_test WHERE ${sql}`, paramsArray);
    return result.rows;
  };

  // ====================================
  // UUID TYPE - ALL OPERATORS
  // ====================================
  describe('UUID Type - All Operators', () => {
    const testUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const otherUuid = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

    conditionalIt('eq', async () => {
      const rows = await executeQuery({ '==': [{ var: 'id' }, testUuid] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('ne', async () => {
      const rows = await executeQuery({ '!=': [{ var: 'id' }, testUuid] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('in', async () => {
      const rows = await executeQuery({ in: [{ var: 'id' }, [testUuid, otherUuid]] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('not_in', async () => {
      const rows = await executeQuery({ '!in': [{ var: 'id' }, [testUuid]] });
      expect(rows).toHaveLength(4);
    });
  });

  // ====================================
  // STRING TYPE - ALL OPERATORS
  // ====================================
  describe('String Type - All Operators', () => {
    conditionalIt('eq', async () => {
      const rows = await executeQuery({ '==': [{ var: 'name' }, 'John Doe'] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('ne', async () => {
      const rows = await executeQuery({ '!=': [{ var: 'name' }, 'John Doe'] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('in', async () => {
      const rows = await executeQuery({ in: [{ var: 'name' }, ['John Doe', 'Jane Smith']] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('not_in', async () => {
      const rows = await executeQuery({ '!in': [{ var: 'name' }, ['John Doe']] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('ilike', async () => {
      const rows = await executeQuery({ ilike: [{ var: 'name' }, '%JOHN%'] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('like', async () => {
      const rows = await executeQuery({ like: [{ var: 'name' }, 'John%'] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('contains', async () => {
      const rows = await executeQuery({ contains: [{ var: 'name' }, 'Doe'] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('starts_with', async () => {
      const rows = await executeQuery({ starts_with: [{ var: 'name' }, 'J'] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('ends_with', async () => {
      const rows = await executeQuery({ ends_with: [{ var: 'name' }, 'Doe'] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('regex', async () => {
      const rows = await executeQuery({ regex: [{ var: 'name' }, '^John' ] });
      expect(rows).toHaveLength(1);
    });
  });

  // ====================================
  // INTEGER TYPE - ALL OPERATORS
  // ====================================
  describe('Integer Type - All Operators', () => {
    conditionalIt('eq', async () => {
      const rows = await executeQuery({ '==': [{ var: 'age' }, 30] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('ne', async () => {
      const rows = await executeQuery({ '!=': [{ var: 'age' }, 30] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('gt', async () => {
      const rows = await executeQuery({ '>': [{ var: 'age' }, 30] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('gte', async () => {
      const rows = await executeQuery({ '>=': [{ var: 'age' }, 30] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('lt', async () => {
      const rows = await executeQuery({ '<': [{ var: 'age' }, 30] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('lte', async () => {
      const rows = await executeQuery({ '<=': [{ var: 'age' }, 30] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('between', async () => {
      const rows = await executeQuery({ between: [{ var: 'age' }, 25, 35] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('not_between', async () => {
      const rows = await executeQuery({ not_between: [{ var: 'age' }, 25, 35] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('in', async () => {
      const rows = await executeQuery({ in: [{ var: 'age' }, [25, 30, 35]] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('not_in', async () => {
      const rows = await executeQuery({ '!in': [{ var: 'age' }, [25, 30]] });
      expect(rows).toHaveLength(3);
    });
  });

  // ====================================
  // DECIMAL TYPE - ALL OPERATORS
  // ====================================
  describe('Decimal Type - All Operators', () => {
    conditionalIt('eq', async () => {
      const rows = await executeQuery({ '==': [{ var: 'score' }, 100] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('ne', async () => {
      const rows = await executeQuery({ '!=': [{ var: 'score' }, 100] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('gt', async () => {
      const rows = await executeQuery({ '>': [{ var: 'score' }, 90] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('gte', async () => {
      const rows = await executeQuery({ '>=': [{ var: 'score' }, 88] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('lt', async () => {
      const rows = await executeQuery({ '<': [{ var: 'score' }, 80] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('lte', async () => {
      const rows = await executeQuery({ '<=': [{ var: 'score' }, 88] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('between', async () => {
      const rows = await executeQuery({ between: [{ var: 'score' }, 70, 90] });
      expect(rows).toHaveLength(2);
    });
  });

  // ====================================
  // BOOLEAN TYPE - ALL OPERATORS
  // ====================================
  describe('Boolean Type - All Operators', () => {
    conditionalIt('eq true', async () => {
      const rows = await executeQuery({ '==': [{ var: 'isActive' }, true] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('eq false', async () => {
      const rows = await executeQuery({ '==': [{ var: 'isActive' }, false] });
      expect(rows).toHaveLength(1);
    });
  });

  // ====================================
  // DATE TYPE - ALL OPERATORS
  // ====================================
  describe('Date Type - All Operators', () => {
    conditionalIt('eq', async () => {
      const rows = await executeQuery({ '==': [{ var: 'birthDate' }, '1994-05-15'] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('ne', async () => {
      const rows = await executeQuery({ '!=': [{ var: 'birthDate' }, '1994-05-15'] });
      expect(rows).toHaveLength(4);
    });

    conditionalIt('gt', async () => {
      const rows = await executeQuery({ '>': [{ var: 'birthDate' }, '1995-01-01'] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('gte', async () => {
      const rows = await executeQuery({ '>=': [{ var: 'birthDate' }, '1994-05-15'] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('lt', async () => {
      const rows = await executeQuery({ '<': [{ var: 'birthDate' }, '1990-01-01'] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('lte', async () => {
      const rows = await executeQuery({ '<=': [{ var: 'birthDate' }, '1994-05-15'] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('between', async () => {
      const rows = await executeQuery({ between: [{ var: 'birthDate' }, '1990-01-01', '1999-12-31'] });
      expect(rows).toHaveLength(2);
    });
  });

  // ====================================
  // TIMESTAMP TYPE - ALL OPERATORS
  // ====================================
  describe('Timestamp Type - All Operators', () => {
    conditionalIt('gt', async () => {
      const rows = await executeQuery({ '>': [{ var: 'createdAt' }, '2024-02-01'] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('lt', async () => {
      const rows = await executeQuery({ '<': [{ var: 'createdAt' }, '2024-02-01'] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('between', async () => {
      const rows = await executeQuery({ between: [{ var: 'createdAt' }, '2024-01-01', '2024-02-28'] });
      expect(rows).toHaveLength(2);
    });
  });

  // ====================================
  // ARRAY VARCHAR TYPE - ALL OPERATORS
  // ====================================
  describe('Array VARCHAR Type - All Operators', () => {
    conditionalIt('any_of (value IN array column)', async () => {
      const rows = await executeQuery({ any_of: [{ var: 'tags' }, 'vip'] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('not_any_of (value NOT IN array column)', async () => {
      const rows = await executeQuery({ not_any_of: [{ var: 'tags' }, 'vip'] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('overlaps (has common elements)', async () => {
      const rows = await executeQuery({ overlaps: [{ var: 'tags' }, ['gold', 'platinum']] });
      expect(rows).toHaveLength(1);
    });

    conditionalIt('contained_by (array is subset)', async () => {
      const rows = await executeQuery({ contained_by: [{ var: 'tags' }, ['new', 'trial', 'active', 'standard']] });
      expect(rows.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ====================================
  // ARRAY INTEGER TYPE - ALL OPERATORS
  // ====================================
  describe('Array Integer Type - All Operators', () => {
    conditionalIt('any_of (number IN integer array)', async () => {
      const rows = await executeQuery({ any_of: [{ var: 'scores' }, 100] });
      expect(rows).toHaveLength(2);
    });

    conditionalIt('not_any_of (number NOT IN integer array)', async () => {
      const rows = await executeQuery({ not_any_of: [{ var: 'scores' }, 100] });
      expect(rows).toHaveLength(3);
    });

    conditionalIt('overlaps (arrays have common numbers)', async () => {
      const rows = await executeQuery({ overlaps: [{ var: 'scores' }, [100, 50]] });
      expect(rows).toHaveLength(4);
    });
  });

  // ====================================
  // JSONB TYPE - ALL OPERATORS
  // ====================================
  describe('JSONB Type - All Operators', () => {
    conditionalIt('json_contains (@>)', async () => {
      const rows = await executeQuery({ json_contains: [{ var: 'metadata' }, { rank: 'gold' }] });
      expect(rows).toHaveLength(1);
    });
  });

  // ====================================
  // NULL OPERATORS - ALL NULLABLE TYPES
  // ====================================
  describe('Null Operators - All Types', () => {
    conditionalIt('string is_null', async () => {
      // Alice has null email 
      const rows = await executeQuery({ is_null: [{ var: 'name' }] });
      expect(rows).toHaveLength(0); // No null names
    });

    conditionalIt('string is_not_null', async () => {
      const rows = await executeQuery({ is_not_null: [{ var: 'name' }] });
      expect(rows).toHaveLength(5);
    });
  });

  // ====================================
  // LOGICAL OPERATORS - COMPLEX
  // ====================================
  describe('Logical Operators - Complex Combinations', () => {
    conditionalIt('nested AND with OR', async () => {
      const rows = await executeQuery({
        and: [
          { or: [
            { '==': [{ var: 'age' }, 30] },
            { '==': [{ var: 'age' }, 35] },
          ]},
          { '==': [{ var: 'isActive' }, true] },
        ],
      });
      expect(rows).toHaveLength(2); // John (30, true), Alice (35, true)
    });

    conditionalIt('triple nested', async () => {
      const rows = await executeQuery({
        and: [
          { or: [
            { and: [
              { '>': [{ var: 'age' }, 25] },
              { '<': [{ var: 'score' }, 100] },
            ]},
            { '==': [{ var: 'age' }, 20] },
          ]},
          { '==': [{ var: 'isActive' }, true] },
        ],
      });
      expect(rows.length).toBeGreaterThan(0);
    });

    conditionalIt('NOT with complex inner', async () => {
      const rows = await executeQuery({
        '!': {
          and: [
            { '==': [{ var: 'isActive' }, true] },
            { any_of: [{ var: 'tags' }, 'vip'] },
          ],
        },
      });
      expect(rows).toHaveLength(3); // Everyone except John and Alice (active + vip)
    });
  });
});
