import { JsonLogicCompiler, CompilerError, SchemaValidationError } from '../compiler';
import type { FilterSchema } from '../types';

describe('JsonLogicCompiler', () => {
  const testSchema: FilterSchema = {
    fields: {
      id: {
        type: 'uuid',
        title: 'ID',
        inputType: 'text',
        operators: ['eq', 'ne', 'in', 'not_in'],
      },
      name: {
        type: 'string',
        title: 'Name',
        inputType: 'text',
        operators: ['eq', 'ne', 'contains', 'starts_with', 'ilike', 'in'],
      },
      email: {
        type: 'string',
        title: 'Email',
        inputType: 'text',
        operators: ['eq', 'ilike'],
        transform: { input: ['lower', 'trim'] },
      },
      age: {
        type: 'integer',
        title: 'Age',
        inputType: 'number',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'],
        constraints: { min: 0, max: 150 },
      },
      status: {
        type: 'string',
        title: 'Status',
        inputType: 'select',
        operators: ['eq', 'ne', 'in'],
        options: {
          items: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      },
      isActive: {
        type: 'boolean',
        title: 'Is Active',
        inputType: 'checkbox',
        operators: ['eq', 'is_null', 'is_not_null'],
        nullable: true,
      },
      createdAt: {
        type: 'timestamp',
        title: 'Created At',
        inputType: 'datetime',
        column: 'created_at',
        operators: ['gt', 'gte', 'lt', 'lte', 'between'],
      },
      tags: {
        type: 'array',
        title: 'Tags',
        inputType: 'multiselect',
        operators: ['contains', 'overlaps'],
      },
      fullName: {
        type: 'string',
        title: 'Full Name',
        inputType: 'text',
        computed: true,
        expression: "first_name || ' ' || last_name",
        operators: ['ilike'],
      },
    },
    settings: {
      maxDepth: 5,
      maxConditions: 100,
    },
  };

  let compiler: JsonLogicCompiler;

  beforeEach(() => {
    compiler = new JsonLogicCompiler({ schema: testSchema });
  });

  describe('Comparison Operators', () => {
    it('should compile == operator', () => {
      const result = compiler.compile({
        '==': [{ var: 'status' }, 'active'],
      });

      expect(result.sql).toBe('"status" = $1');
      expect(result.params).toEqual({ 'p1': 'active' });
    });

    it('should compile != operator', () => {
      const result = compiler.compile({
        '!=': [{ var: 'status' }, 'inactive'],
      });

      expect(result.sql).toBe('"status" <> $1');
      expect(result.params).toEqual({ 'p1': 'inactive' });
    });

    it('should compile > operator', () => {
      const result = compiler.compile({
        '>': [{ var: 'age' }, 18],
      });

      expect(result.sql).toBe('"age" > $1');
      expect(result.params).toEqual({ 'p1': 18 });
    });

    it('should compile >= operator', () => {
      const result = compiler.compile({
        '>=': [{ var: 'age' }, 21],
      });

      expect(result.sql).toBe('"age" >= $1');
      expect(result.params).toEqual({ 'p1': 21 });
    });

    it('should compile < operator', () => {
      const result = compiler.compile({
        '<': [{ var: 'age' }, 65],
      });

      expect(result.sql).toBe('"age" < $1');
      expect(result.params).toEqual({ 'p1': 65 });
    });

    it('should compile <= operator', () => {
      const result = compiler.compile({
        '<=': [{ var: 'age' }, 100],
      });

      expect(result.sql).toBe('"age" <= $1');
      expect(result.params).toEqual({ 'p1': 100 });
    });
  });

  describe('Logical Operators', () => {
    it('should compile and operator', () => {
      const result = compiler.compile({
        and: [
          { '==': [{ var: 'status' }, 'active'] },
          { '>': [{ var: 'age' }, 18] },
        ],
      });

      expect(result.sql).toBe('(("status" = $1) AND ("age" > $2))');
      expect(result.params).toEqual({ 'p1': 'active', 'p2': 18 });
    });

    it('should compile or operator', () => {
      const result = compiler.compile({
        or: [
          { '==': [{ var: 'status' }, 'active'] },
          { '==': [{ var: 'status' }, 'inactive'] },
        ],
      });

      expect(result.sql).toBe('(("status" = $1) OR ("status" = $2))');
      expect(result.params).toEqual({ 'p1': 'active', 'p2': 'inactive' });
    });

    it('should compile not operator', () => {
      const result = compiler.compile({
        '!': { '==': [{ var: 'status' }, 'inactive'] },
      });

      expect(result.sql).toBe('NOT ("status" = $1)');
      expect(result.params).toEqual({ 'p1': 'inactive' });
    });

    it('should compile nested logical operators', () => {
      const result = compiler.compile({
        and: [
          { '==': [{ var: 'status' }, 'active'] },
          {
            or: [
              { '>': [{ var: 'age' }, 18] },
              { '==': [{ var: 'isActive' }, true] },
            ],
          },
        ],
      });

      expect(result.sql).toBe(
        '(("status" = $1) AND ((("age" > $2) OR ("isActive" = $3))))',
      );
      expect(result.params).toEqual({ 'p1': 'active', 'p2': 18, 'p3': true });
    });
  });

  describe('String Operators', () => {
    it('should compile contains operator', () => {
      const result = compiler.compile({
        contains: [{ var: 'name' }, 'john'],
      });

      expect(result.sql).toBe('"name" ILIKE $1');
      expect(result.params).toEqual({ 'p1': '%john%' });
    });

    it('should compile starts_with operator', () => {
      const result = compiler.compile({
        starts_with: [{ var: 'name' }, 'J'],
      });

      expect(result.sql).toBe('"name" ILIKE $1');
      expect(result.params).toEqual({ 'p1': 'J%' });
    });

    it('should compile ilike operator', () => {
      const result = compiler.compile({
        ilike: [{ var: 'name' }, '%test%'],
      });

      expect(result.sql).toBe('"name" ILIKE $1');
      expect(result.params).toEqual({ 'p1': '%test%' });
    });
  });

  describe('Array Operators', () => {
    it('should compile in operator', () => {
      const result = compiler.compile({
        in: [{ var: 'status' }, ['active', 'inactive']],
      });

      expect(result.sql).toBe('"status" IN ($1, $2)');
      expect(result.params).toEqual({ 'p1': 'active', 'p2': 'inactive' });
    });

    it('should compile in operator with empty array', () => {
      const result = compiler.compile({
        in: [{ var: 'age' }, []],
      });

      expect(result.sql).toBe('1=0'); // Always false
    });

    it('should compile not_in operator', () => {
      const result = compiler.compile({
        '!in': [{ var: 'id' }, [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        ]],
      });

      expect(result.sql).toBe('"id" NOT IN ($1, $2)');
    });
  });

  describe('Null Operators', () => {
    it('should compile is_null operator', () => {
      const result = compiler.compile({
        is_null: [{ var: 'isActive' }],
      });

      expect(result.sql).toBe('"isActive" IS NULL');
      expect(result.params).toEqual({});
    });

    it('should compile is_not_null operator', () => {
      const result = compiler.compile({
        is_not_null: [{ var: 'isActive' }],
      });

      expect(result.sql).toBe('"isActive" IS NOT NULL');
      expect(result.params).toEqual({});
    });
  });

  describe('Range Operators', () => {
    it('should compile between operator', () => {
      const result = compiler.compile({
        between: [{ var: 'age' }, 18, 65],
      });

      expect(result.sql).toBe('"age" BETWEEN $1 AND $2');
      expect(result.params).toEqual({ 'p1': 18, 'p2': 65 });
    });
  });

  describe('Transforms', () => {
    it('should apply input transforms', () => {
      const result = compiler.compile({
        '==': [{ var: 'email' }, 'Test@Example.com'],
      });

      // Transforms applied in array order: lower first, then trim
      expect(result.sql).toBe('TRIM(LOWER("email")) = $1');
    });
  });

  describe('Column Mapping', () => {
    it('should use column name when different from field', () => {
      const result = compiler.compile({
        '>': [{ var: 'createdAt' }, '2024-01-01'],
      });

      expect(result.sql).toBe('"created_at" > $1');
    });
  });

  describe('Computed Fields', () => {
    it('should use expression for computed fields', () => {
      const result = compiler.compile({
        ilike: [{ var: 'fullName' }, '%John%'],
      });

      expect(result.sql).toBe("(first_name || ' ' || last_name) ILIKE $1");
    });
  });

  describe('Validation', () => {
    it('should reject unknown fields in strict mode', () => {
      expect(() => {
        compiler.compile({
          '==': [{ var: 'unknown_field' }, 'value'],
        });
      }).toThrow(SchemaValidationError);
    });

    it('should reject disallowed operators', () => {
      expect(() => {
        compiler.compile({
          contains: [{ var: 'id' }, 'test'], // id doesn't allow contains
        });
      }).toThrow(); // Throws CompilerError for unknown operator
    });

    it('should reject values outside constraints', () => {
      expect(() => {
        compiler.compile({
          '==': [{ var: 'age' }, 200], // max is 150
        });
      }).toThrow(SchemaValidationError);
    });

    it('should reject invalid option values', () => {
      expect(() => {
        compiler.compile({
          '==': [{ var: 'status' }, 'invalid_status'],
        });
      }).toThrow(SchemaValidationError);
    });
  });

  describe('Security', () => {
    it('should reject excessive nesting depth', () => {
      const deeplyNested = {
        and: [
          {
            and: [
              {
                and: [
                  {
                    and: [
                      {
                        and: [
                          {
                            and: [{ '==': [{ var: 'status' }, 'active'] }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => {
        compiler.compile(deeplyNested);
      }).toThrow(CompilerError);
    });

    it('should sanitize prototype pollution attempts', () => {
      const malicious = {
        __proto__: { isAdmin: true },
        '==': [{ var: 'status' }, 'active'],
      };

      // Should not throw, __proto__ should be stripped
      const result = compiler.compile(malicious as any);
      expect(result.sql).toBe('"status" = $1');
    });
  });
});
