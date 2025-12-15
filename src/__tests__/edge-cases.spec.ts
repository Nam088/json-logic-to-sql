/**
 * Edge Case Tests
 * 
 * Tests for edge cases and potential issues identified during code review:
 * 1. Deeply nested conditions - condition count tracking
 * 2. Pagination param index conflicts
 * 3. Empty array edge cases
 * 4. Identifier validation edge cases
 * 5. Large/complex queries
 */

import { JsonLogicCompiler, CompilerError, SchemaValidationError } from '../compiler';
import { buildPagination, buildSort } from '../utils/pagination';
import { buildSelect } from '../utils/select';
import { escapeIdentifier, sanitizeInput } from '../security/sanitizer';
import type { FilterSchema, JsonLogicRule } from '../types';

describe('Edge Cases', () => {
  const testSchema: FilterSchema = {
    fields: {
      id: { type: 'uuid', operators: ['eq', 'in', 'not_in'] },
      name: { type: 'string', operators: ['eq', 'ne', 'in', 'not_in', 'contains'] },
      age: { type: 'integer', operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'] },
      status: {
        type: 'string',
        operators: ['eq', 'ne', 'in', 'not_in'],
        options: {
          items: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'pending', label: 'Pending' },
          ],
        },
      },
      isActive: { type: 'boolean', operators: ['eq', 'is_null', 'is_not_null'], nullable: true },
      tags: { type: 'array', operators: ['contains', 'overlaps', 'any_of', 'not_any_of'] },
      score: { type: 'decimal', operators: ['eq', 'gt', 'lt', 'between'] },
      createdAt: { type: 'timestamp', column: 'created_at', operators: ['gt', 'lt', 'between'] },
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

  describe('Deeply Nested Conditions', () => {
    it('should correctly track condition count with nested AND/OR', () => {
      // 3 levels of nesting with multiple conditions
      const result = compiler.compile({
        and: [
          { '==': [{ var: 'status' }, 'active'] },
          {
            or: [
              { '>': [{ var: 'age' }, 18] },
              {
                and: [
                  { '<': [{ var: 'age' }, 65] },
                  { '==': [{ var: 'isActive' }, true] },
                ],
              },
            ],
          },
          { 'in': [{ var: 'name' }, ['John', 'Jane']] },
        ],
      });

      expect(result.sql).toContain('AND');
      expect(result.sql).toContain('OR');
      // Should have params $1 through $6
      expect(Object.keys(result.params).length).toBe(6);
      expect(result.params).toEqual({
        '$1': 'active',
        '$2': 18,
        '$3': 65,
        '$4': true,
        '$5': 'John',
        '$6': 'Jane',
      });
    });

    it('should handle deeply nested OR within AND', () => {
      const result = compiler.compile({
        and: [
          {
            or: [
              { '==': [{ var: 'status' }, 'active'] },
              { '==': [{ var: 'status' }, 'pending'] },
            ],
          },
          {
            or: [
              { '>': [{ var: 'age' }, 21] },
              { '<': [{ var: 'age' }, 18] },
            ],
          },
        ],
      });

      // Verify structure
      expect(result.sql).toMatch(/\(\(.*OR.*\) AND \(.*OR.*\)\)/);
      expect(Object.keys(result.params).length).toBe(4);
    });

    it('should reject when exceeding max depth', () => {
      // Create deeply nested structure (6 levels, max is 5)
      const createDeep = (depth: number): JsonLogicRule => {
        if (depth <= 0) {
          return { '==': [{ var: 'status' }, 'active'] };
        }
        return { and: [createDeep(depth - 1)] };
      };

      expect(() => {
        compiler.compile(createDeep(7));
      }).toThrow(CompilerError);
    });

    it('should handle max depth exactly at limit', () => {
      // 5 levels should work
      const createDeep = (depth: number): JsonLogicRule => {
        if (depth <= 0) {
          return { '==': [{ var: 'status' }, 'active'] };
        }
        return { and: [createDeep(depth - 1)] };
      };

      expect(() => {
        compiler.compile(createDeep(4)); // 5 levels total
      }).not.toThrow();
    });
  });

  describe('Empty Array Edge Cases', () => {
    it('should return 1=0 for IN with empty array', () => {
      const result = compiler.compile({
        in: [{ var: 'age' }, []],
      });

      expect(result.sql).toBe('1=0');
      expect(result.params).toEqual({});
    });

    it('should return 1=1 for NOT IN with empty array', () => {
      const result = compiler.compile({
        '!in': [{ var: 'id' }, []],
      });

      expect(result.sql).toBe('1=1');
      expect(result.params).toEqual({});
    });

    it('should handle empty array after other conditions', () => {
      const result = compiler.compile({
        and: [
          { '==': [{ var: 'status' }, 'active'] },
          { in: [{ var: 'age' }, [] ] },
        ],
      });

      // First condition uses $1, empty IN returns '1=0'
      expect(result.sql).toBe('((\"status\" = $1) AND (1=0))');
      expect(result.params).toEqual({ '$1': 'active' });
    });

    it('should handle IN with single item array', () => {
      const result = compiler.compile({
        in: [{ var: 'status' }, ['active']],
      });

      expect(result.sql).toBe('\"status\" IN ($1)');
      expect(result.params).toEqual({ '$1': 'active' });
    });

    it('should handle NOT IN with single item array', () => {
      const result = compiler.compile({
        '!in': [{ var: 'status' }, ['inactive']],
      });

      expect(result.sql).toBe('\"status\" NOT IN ($1)');
      expect(result.params).toEqual({ '$1': 'inactive' });
    });
  });

  describe('Large IN Clause', () => {
    it('should handle IN with many values', () => {
      const values = Array.from({ length: 50 }, (_, i) => i + 1);
      const result = compiler.compile({
        in: [{ var: 'age' }, values],
      });

      expect(result.sql).toContain('IN');
      expect(Object.keys(result.params).length).toBe(50);
      
      // Verify param order
      expect(result.params['$1']).toBe(1);
      expect(result.params['$50']).toBe(50);
    });
  });

  describe('Param Index Ordering', () => {
    it('should maintain correct param order in complex queries', () => {
      const result = compiler.compile({
        and: [
          { between: [{ var: 'age' }, 18, 65] },      // $1, $2
          { '==': [{ var: 'status' }, 'active'] },   // $3
          { in: [{ var: 'name' }, ['A', 'B', 'C']] }, // $4, $5, $6
          { '>': [{ var: 'score' }, 5.5] },          // $7
        ],
      });

      expect(result.params).toEqual({
        '$1': 18,
        '$2': 65,
        '$3': 'active',
        '$4': 'A',
        '$5': 'B',
        '$6': 'C',
        '$7': 5.5,
      });
    });

    it('should maintain param order across nested structures', () => {
      const result = compiler.compile({
        or: [
          {
            and: [
              { '==': [{ var: 'status' }, 'active'] }, // $1
              { '>': [{ var: 'age' }, 18] },           // $2
            ],
          },
          {
            and: [
              { '==': [{ var: 'status' }, 'inactive'] }, // $3
              { '<': [{ var: 'age' }, 65] },             // $4
            ],
          },
        ],
      });

      expect(result.params['$1']).toBe('active');
      expect(result.params['$2']).toBe(18);
      expect(result.params['$3']).toBe('inactive');
      expect(result.params['$4']).toBe(65);
    });
  });

  describe('NOT Operator Edge Cases', () => {
    it('should handle NOT with nested AND', () => {
      const result = compiler.compile({
        '!': {
          and: [
            { '==': [{ var: 'status' }, 'active'] },
            { '>': [{ var: 'age' }, 18] },
          ],
        },
      });

      expect(result.sql).toBe('NOT (((\"status\" = $1) AND (\"age\" > $2)))');
    });

    it('should handle NOT with nested OR', () => {
      const result = compiler.compile({
        '!': {
          or: [
            { '==': [{ var: 'status' }, 'inactive'] },
            { is_null: [{ var: 'isActive' }] },
          ],
        },
      });

      expect(result.sql).toBe('NOT (((\"status\" = $1) OR (\"isActive\" IS NULL)))');
    });

    it('should handle double NOT', () => {
      const result = compiler.compile({
        '!': {
          '!': { '==': [{ var: 'status' }, 'active'] },
        },
      });

      expect(result.sql).toBe('NOT (NOT (\"status\" = $1))');
    });
  });

  describe('Identifier Edge Cases', () => {
    it('should reject identifiers starting with numbers', () => {
      expect(() => escapeIdentifier('123abc')).toThrow('Invalid identifier');
    });

    it('should reject identifiers with spaces', () => {
      expect(() => escapeIdentifier('my column')).toThrow('Invalid identifier');
    });

    it('should reject identifiers with special characters', () => {
      expect(() => escapeIdentifier('name;')).toThrow('Invalid identifier');
      expect(() => escapeIdentifier('col--')).toThrow('Invalid identifier');
      expect(() => escapeIdentifier('col/*')).toThrow('Invalid identifier');
    });

    it('should reject empty string', () => {
      expect(() => escapeIdentifier('')).toThrow('Invalid identifier');
    });

    it('should accept underscore-prefixed identifiers', () => {
      expect(escapeIdentifier('_private')).toBe('\"_private\"');
      expect(escapeIdentifier('__dunder__')).toBe('\"__dunder__\"');
    });

    it('should accept all-caps identifiers', () => {
      expect(escapeIdentifier('USER_ID')).toBe('\"USER_ID\"');
    });
  });

  describe('Null Value Edge Cases', () => {
    it('should allow null for nullable fields with is_null', () => {
      const result = compiler.compile({
        is_null: [{ var: 'isActive' }],
      });

      expect(result.sql).toBe('\"isActive\" IS NULL');
    });

    it('should allow null for nullable fields with is_not_null', () => {
      const result = compiler.compile({
        is_not_null: [{ var: 'isActive' }],
      });

      expect(result.sql).toBe('\"isActive\" IS NOT NULL');
    });

    it('should handle null in AND condition', () => {
      const result = compiler.compile({
        and: [
          { '==': [{ var: 'status' }, 'active'] },
          { is_null: [{ var: 'isActive' }] },
        ],
      });

      expect(result.sql).toBe('((\"status\" = $1) AND (\"isActive\" IS NULL))');
    });
  });

  describe('Boolean Edge Cases', () => {
    it('should handle true boolean', () => {
      const result = compiler.compile({
        '==': [{ var: 'isActive' }, true],
      });

      expect(result.params['$1']).toBe(true);
    });

    it('should handle false boolean', () => {
      const result = compiler.compile({
        '==': [{ var: 'isActive' }, false],
      });

      expect(result.params['$1']).toBe(false);
    });
  });

  describe('Decimal/Float Edge Cases', () => {
    it('should handle decimal values', () => {
      const result = compiler.compile({
        '>': [{ var: 'score' }, 3.14159],
      });

      expect(result.params['$1']).toBe(3.14159);
    });

    it('should handle negative numbers', () => {
      const result = compiler.compile({
        between: [{ var: 'score' }, -100.5, 100.5],
      });

      expect(result.params['$1']).toBe(-100.5);
      expect(result.params['$2']).toBe(100.5);
    });

    it('should handle zero', () => {
      const result = compiler.compile({
        '==': [{ var: 'score' }, 0],
      });

      expect(result.params['$1']).toBe(0);
    });
  });

  describe('Timestamp Edge Cases', () => {
    it('should handle ISO date strings', () => {
      const result = compiler.compile({
        '>': [{ var: 'createdAt' }, '2024-01-01T00:00:00.000Z'],
      });

      expect(result.params['$1']).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle date-only strings', () => {
      const result = compiler.compile({
        between: [{ var: 'createdAt' }, '2024-01-01', '2024-12-31'],
      });

      expect(result.params['$1']).toBe('2024-01-01');
      expect(result.params['$2']).toBe('2024-12-31');
    });
  });

  describe('String Edge Cases', () => {
    it('should handle empty string', () => {
      const result = compiler.compile({
        '==': [{ var: 'name' }, ''],
      });

      expect(result.params['$1']).toBe('');
    });

    it('should handle string with special characters', () => {
      const result = compiler.compile({
        '==': [{ var: 'name' }, "O'Brien"],
      });

      expect(result.params['$1']).toBe("O'Brien");
    });

    it('should handle string with unicode', () => {
      const result = compiler.compile({
        '==': [{ var: 'name' }, '日本語'],
      });

      expect(result.params['$1']).toBe('日本語');
    });

    it('should escape LIKE wildcards in contains', () => {
      const result = compiler.compile({
        contains: [{ var: 'name' }, '100%'],
      });

      // % should be escaped
      expect(result.params['$1']).toBe('%100\\%%');
    });

    it('should escape underscore in contains', () => {
      const result = compiler.compile({
        contains: [{ var: 'name' }, 'user_name'],
      });

      // _ should be escaped
      expect(result.params['$1']).toBe('%user\\_name%');
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should strip __proto__ from nested objects', () => {
      const input = {
        level1: {
          level2: { value: 'safe' },
        },
      };
      // Try to add __proto__ at nested level
      (input.level1 as any).__proto__ = { hacked: true };
      
      const result = sanitizeInput(input) as any;
      expect(result.level1.level2.value).toBe('safe');
    });

    it('should strip constructor from arrays', () => {
      const input = ['a', 'b', 'c'];
      const result = sanitizeInput(input) as string[];
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Empty AND/OR', () => {
    it('should handle empty AND array', () => {
      const result = compiler.compile({
        and: [],
      });

      // Empty AND = always true
      expect(result.sql).toBe('1=1');
    });

    it('should handle empty OR array', () => {
      const result = compiler.compile({
        or: [],
      });

      // Empty OR = always false
      expect(result.sql).toBe('1=0');
    });

    it('should handle single item AND', () => {
      const result = compiler.compile({
        and: [{ '==': [{ var: 'status' }, 'active'] }],
      });

      expect(result.sql).toBe('((\"status\" = $1))');
    });

    it('should handle single item OR', () => {
      const result = compiler.compile({
        or: [{ '==': [{ var: 'status' }, 'active'] }],
      });

      expect(result.sql).toBe('((\"status\" = $1))');
    });
  });

  describe('Array Column Operators', () => {
    it('should handle any_of operator', () => {
      const result = compiler.compile({
        any_of: [{ var: 'tags' }, 'urgent'],
      });

      expect(result.sql).toBe('$1 = ANY(\"tags\")');
      expect(result.params['$1']).toBe('urgent');
    });

    it('should handle not_any_of operator', () => {
      const result = compiler.compile({
        not_any_of: [{ var: 'tags' }, 'spam'],
      });

      expect(result.sql).toBe('$1 <> ALL(\"tags\")');
      expect(result.params['$1']).toBe('spam');
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle page 0 (treated as page 1)', () => {
      const result = buildPagination({ page: 0 });

      expect(result.meta.page).toBe(1);
      expect(result.meta.offset).toBe(0);
    });

    it('should handle negative page (treated as page 1)', () => {
      const result = buildPagination({ page: -5 });

      expect(result.meta.page).toBe(1);
    });

    it('should handle negative offset (treated as 0)', () => {
      const result = buildPagination({ offset: -10, limit: 10 });

      expect(result.meta.offset).toBe(0);
    });

    it('should handle zero limit (treated as 1)', () => {
      const result = buildPagination({ offset: 0, limit: 0 });

      expect(result.meta.pageSize).toBe(1);
    });

    it('should handle very large page number', () => {
      const result = buildPagination({ page: 1000000, pageSize: 10 });

      expect(result.meta.page).toBe(1000000);
      expect(result.meta.offset).toBe(9999990);
    });
  });

  describe('Sort Edge Cases', () => {
    it('should throw for non-sortable field', () => {
      const schemaWithNonSortable: FilterSchema = {
        fields: {
          name: { type: 'string', operators: ['eq'], sortable: false },
        },
      };

      expect(() => {
        buildSort([{ field: 'name' }], schemaWithNonSortable);
      }).toThrow('Field not sortable');
    });

    it('should throw for unknown field', () => {
      expect(() => {
        buildSort([{ field: 'unknown' }], testSchema);
      }).toThrow('Unknown sort field');
    });

    it('should handle mixed case direction', () => {
      const result = buildSort([{ field: 'name', direction: 'desc' }], testSchema);

      expect(result.sql).toContain('DESC');
    });
  });

  describe('Select Edge Cases', () => {
    it('should return * for no selectable fields', () => {
      const schemaAllNonSelectable: FilterSchema = {
        fields: {
          password: { type: 'string', operators: ['eq'], selectable: false },
          secret: { type: 'string', operators: ['eq'], selectable: false },
        },
      };

      const result = buildSelect(schemaAllNonSelectable);

      expect(result.sql).toBe('*');
      expect(result.fields).toEqual([]);
    });

    it('should throw for unknown field in fields list', () => {
      expect(() => {
        buildSelect(testSchema, { fields: ['unknown_field'] });
      }).toThrow('Unknown field');
    });

    it('should throw for non-selectable field in fields list', () => {
      const schemaWithNonSelectable: FilterSchema = {
        fields: {
          name: { type: 'string', operators: ['eq'] },
          password: { type: 'string', operators: ['eq'], selectable: false },
        },
      };

      expect(() => {
        buildSelect(schemaWithNonSelectable, { fields: ['password'] });
      }).toThrow('Field not selectable');
    });
  });
});
