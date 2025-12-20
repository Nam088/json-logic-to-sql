import Database from 'better-sqlite3';
import { JsonLogicCompiler } from '../compiler';
import { FilterSchema } from '../types';
import { applyColumnMapping } from '../utils/schema-mapping';

describe('SQLite Integration (Exhaustive)', () => {
  let db: Database.Database;
  let compiler: JsonLogicCompiler;

  const schema: FilterSchema = {
    fields: {
      // String types
      name: { type: 'string', title: 'Name', inputType: 'text', operators: ['eq', 'ne', 'like', 'ilike', 'contains', 'starts_with', 'ends_with', 'regex'] },
      email: { type: 'string', title: 'Email', inputType: 'text', operators: ['eq', 'is_null', 'is_not_null', 'regex'], nullable: true },
      
      // Number types
      age: { type: 'number', title: 'Age', inputType: 'number', operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in'] },
      score: { type: 'number', title: 'Score', inputType: 'number', operators: ['gt', 'lt'] },
      
      // Boolean type
      active: { type: 'boolean', title: 'Active', inputType: 'checkbox', operators: ['eq'] },
      verified: { type: 'boolean', title: 'Verified', inputType: 'checkbox', operators: ['eq', 'is_null'], nullable: true },
      
      // Date type (stored as TEXT in SQLite)
      joinedAt: { type: 'date', title: 'Joined At', inputType: 'date', operators: ['gt', 'lt', 'gte', 'lte', 'between'] },
    },
    settings: {
      paramStyle: 'positional',
    }
  };

  beforeAll(() => {
    db = new Database(':memory:');
    compiler = new JsonLogicCompiler({ schema, dialect: 'sqlite' });
    
    // Register REGEXP function
    db.function('REGEXP', (pattern: string, value: string) => {
        if (!pattern || !value) return 0;
        return new RegExp(pattern).test(value) ? 1 : 0;
    });

    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        age INTEGER,
        score REAL,
        active INTEGER,   -- boolean 0/1
        verified INTEGER, -- boolean 0/1 or NULL
        joinedAt TEXT     -- ISO date string
      )
    `);

    db.exec(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        title TEXT,
        published INTEGER, -- boolean 0/1
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    
    const insertUser = db.prepare(`
        INSERT INTO users (id, name, email, age, score, active, verified, joinedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPost = db.prepare(`
        INSERT INTO posts (id, user_id, title, published)
        VALUES (?, ?, ?, ?)
    `);
    
    const request = db.transaction((users: any[], posts: any[]) => {
        for (const user of users) insertUser.run(user);
        for (const post of posts) insertPost.run(post);
    });
    
    request([
        // id, name, email, age, score, active, verified, joinedAt
        [1, 'Alice', 'alice@test.com', 25, 98.5, 1, 1, '2023-01-01'],
        [2, 'Bob', 'bob@test.com', 30, 85.0, 0, 0, '2022-05-15'],
        [3, 'Charlie', null, 35, 72.5, 1, null, '2021-12-20'],
        [4, 'David', 'david@test.com', 40, 90.0, 1, 1, '2020-03-10'],
        [5, 'Eve', 'eve@example.com', 20, 95.0, 0, 1, '2023-11-05'],
        [6, 'Frank', 'frank@example.com', 45, 60.0, 1, 0, '2019-08-15'],
    ], [
        // id, user_id, title, published
        [1, 1, 'Alice Post 1', 1],
        [2, 1, 'Alice Post 2', 0],
        [3, 2, 'Bob Post 1', 1],
        [4, 3, 'Charlie Post 1', 1],
    ]);
  });

  afterAll(() => {
    db.close();
  });

  function query(rule: any): any[] {
    const { sql, params } = compiler.compile(rule);
    
    const paramCount = Object.keys(params).length;
    const paramArray = [];
    for (let i = 1; i <= paramCount; i++) {
        let val = params[`p${i}`];
        if (typeof val === 'boolean') {
            val = val ? 1 : 0;
        }
        paramArray.push(val);
    }
    
    return db.prepare(`SELECT * FROM users WHERE ${sql} ORDER BY id`).all(paramArray);
  }

  // =====================================
  // STRING OPERATORS
  // =====================================
  describe('String Operators', () => {
    it('eq - exact match', () => {
        const rows = query({ '==': [{ var: 'name' }, 'Alice'] });
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Alice');
    });

    it('ne - not equal', () => {
        const rows = query({ '!=': [{ var: 'name' }, 'Alice'] });
        expect(rows).toHaveLength(5);
    });

    it('like - pattern match', () => {
        const rows = query({ 'like': [{ var: 'name' }, '%li%'] }); // Alice, Charlie
        expect(rows).toHaveLength(2);
    });

    // SQLite LIKE is case-insensitive for ASCII by default usually, but let's test our mapping
    it('ilike - case insensitive pattern (mapped to LIKE in SQLite)', () => {
         const rows = query({ 'ilike': [{ var: 'name' }, '%ALICE%'] });
         expect(rows).toHaveLength(1);
         expect(rows[0].name).toBe('Alice');
    });

    it('contains - substring', () => {
        const rows = query({ 'contains': [{ var: 'name' }, 'li'] }); // Alice, Charlie
        expect(rows).toHaveLength(2);
    });

    it('starts_with', () => {
        const rows = query({ 'starts_with': [{ var: 'name' }, 'Da'] }); // David
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('David');
    });

    it('ends_with', () => {
        const rows = query({ 'ends_with': [{ var: 'name' }, 'ie'] }); // Charlie
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Charlie');
    });

    it('regex', () => {
        const rows = query({ 'regex': [{ var: 'email' }, '@example\\.com$'] }); // Eve, Frank
        expect(rows).toHaveLength(2);
    });
  });

  // =====================================
  // NUMBER OPERATORS
  // =====================================
  describe('Number Operators', () => {
      it('eq', () => {
          const rows = query({ '==': [{ var: 'age' }, 30] });
          expect(rows).toHaveLength(1);
          expect(rows[0].name).toBe('Bob');
      });

      it('gt - greater than', () => {
          const rows = query({ '>': [{ var: 'age' }, 30] }); // Charlie 35, David 40, Frank 45
          expect(rows).toHaveLength(3);
      });

      it('gte - greater or equal', () => {
          const rows = query({ '>=': [{ var: 'age' }, 30] }); // Bob 30 + others
          expect(rows).toHaveLength(4);
      });

      it('lt - less than', () => {
          const rows = query({ '<': [{ var: 'age' }, 25] }); // Eve 20
          expect(rows).toHaveLength(1);
      });

      it('lte - less or equal', () => {
          const rows = query({ '<=': [{ var: 'age' }, 25] }); // Alice 25, Eve 20
          expect(rows).toHaveLength(2);
      });

      it('between', () => {
          const rows = query({ 'between': [{ var: 'age' }, 25, 35] }); // Alice 25, Bob 30, Charlie 35
          expect(rows).toHaveLength(3);
      });

      it('in - list of values', () => {
          const rows = query({ 'in': [{ var: 'age' }, [20, 40]] }); // Eve, David
          expect(rows).toHaveLength(2);
      });

      it('not_in', () => {
          const rows = query({ 'not_in': [{ var: 'age' }, [20, 25, 30, 35, 40, 45]] }); 
          expect(rows).toHaveLength(0);
      });

      it('float comparison', () => {
          const rows = query({ '>': [{ var: 'score' }, 90.0] }); // Alice 98.5, Eve 95.0
          expect(rows).toHaveLength(2);
      });
  });

  // =====================================
  // BOOLEAN OPERATORS
  // =====================================
  describe('Boolean Operators', () => {
      it('eq true', () => {
          const rows = query({ '==': [{ var: 'active' }, true] }); // 1, 3, 4, 6
          expect(rows).toHaveLength(4);
      });

      it('eq false', () => {
          const rows = query({ '==': [{ var: 'active' }, false] }); // 2, 5
          expect(rows).toHaveLength(2);
      });
  });

  // =====================================
  // NULL OPERATORS
  // =====================================
  describe('Null Operators', () => {
      it('is_null', () => {
          const rows = query({ 'is_null': [{ var: 'email' }] }); // Charlie
          expect(rows).toHaveLength(1);
          expect(rows[0].name).toBe('Charlie');
      });

      it('is_not_null', () => {
          const rows = query({ 'is_not_null': [{ var: 'email' }] });
          expect(rows).toHaveLength(5);
      });
      
      it('boolean nullable check', () => {
          const rows = query({ 'is_null': [{ var: 'verified' }] }); // Charlie
          expect(rows).toHaveLength(1);
      });
  });

  // =====================================
  // DATE OPERATORS (String based)
  // =====================================
  describe('Date Operators', () => {
     it('gt date', () => {
         const rows = query({ '>': [{ var: 'joinedAt' }, '2023-01-01'] }); // Eve 2023-11-05
         expect(rows).toHaveLength(1); 
         expect(rows[0].name).toBe('Eve');
         // Note: Alice joined 2023-01-01 exactly, so not GT
     });

     it('gte date', () => {
         // Alice joined 2023-01-01
         const rows = query({ '>=': [{ var: 'joinedAt' }, '2023-01-01'] }); 
         expect(rows).toHaveLength(2); // Alice, Eve
     });

     it('lt date', () => {
         const rows = query({ '<': [{ var: 'joinedAt' }, '2020-01-01'] }); // Frank 2019
         expect(rows).toHaveLength(1);
     });
     
     it('between date', () => {
         const rows = query({ 'between': [{ var: 'joinedAt' }, '2020-01-01', '2022-12-31'] }); 
         // David 2020, Charlie 2021, Bob 2022
         expect(rows).toHaveLength(3);
     });
  });
  
  // =====================================
  // COMPLEX LOGIC
  // =====================================
  describe('Complex Logic', () => {
      it('(Active AND Age > 30) OR (Name starts with E)', () => {
          const rows = query({
              or: [
                  { and: [
                      { '==': [{ var: 'active' }, true] },
                      { '>': [{ var: 'age' }, 30] }
                  ]},
                  { 'starts_with': [{ var: 'name' }, 'E'] }
              ]
          });
          // Active & >30: Charlie (35), David (40), Frank (45)
          // Starts E: Eve (20)
          // Total: 4
          expect(rows).toHaveLength(4);
      });
  });

  // =====================================
  // JOIN MAPPING / TABLE ALIASES
  // =====================================
  describe('Join Mapping', () => {
      it('should query with JOIN using table aliases', () => {
          // 1. Define Public Schema
          const publicSchema: FilterSchema = {
            fields: {
              userName: { type: 'string', title: 'User Name', inputType: 'text', operators: ['eq'] },
              postTitle: { type: 'string', title: 'Post Title', inputType: 'text', operators: ['contains'] },
              published: { type: 'boolean', title: 'Published', inputType: 'checkbox', operators: ['eq'] }
            }
          };

          // 2. Define Mapping using utility format
          const mapping = {
              userName: { table: 'u', column: 'name' },
              postTitle: { table: 'p', column: 'title' },
              published: { table: 'p', column: 'published' }
          };

          // 3. Apply mapping (Simulating logic in src/utils/schema-mapping.ts)
          // We can't import it easily if it's not exported or if we want to avoid deep relative imports spaghetti in test if not set up
          // BUT the user asked us to use it.
          // Let's import it at top or assume we can import it.
          // It is exported in ../utils/schema-mapping
          
          const joinSchema = applyColumnMapping(publicSchema, mapping);

          const joinCompiler = new JsonLogicCompiler({ schema: joinSchema, dialect: 'sqlite' });
          
          // 4. Logic: User is Alice AND Post is Published
          const rule = {
              and: [
                  { '==': [{ var: 'userName' }, 'Alice'] },
                  { '==': [{ var: 'published' }, true] }
              ]
          };

          const { sql, params } = joinCompiler.compile(rule as any);
          
          // 3. Prepare Params
          const paramCount = Object.keys(params).length;
          const paramArray = [];
          for (let i = 1; i <= paramCount; i++) {
            let val = params[`p${i}`];
            if (typeof val === 'boolean') val = val ? 1 : 0;
            paramArray.push(val);
          }

          // 4. Construct Full SQL with JOIN
          // Generated SQL reference columns like "u.name" and "p.published"
          const fullSql = `
            SELECT p.title, u.name 
            FROM posts p 
            JOIN users u ON p.user_id = u.id 
            WHERE ${sql}
          `;

          const rows = db.prepare(fullSql).all(paramArray) as any[];
          
          // Alice has 2 posts, only 1 is published ('Alice Post 1')
          expect(rows).toHaveLength(1);
          expect(rows[0].title).toBe('Alice Post 1');
          expect(rows[0].name).toBe('Alice');
      });
  });
});
