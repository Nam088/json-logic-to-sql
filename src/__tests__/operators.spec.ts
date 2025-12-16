import { handleAnd, handleOr, handleNot } from '../operators/logical';
import { PostgresDialect } from '../dialects/postgresql';
import type { CompilerContext } from '../types';

describe('Operators', () => {
  const createContext = (): CompilerContext => ({
    depth: 0,
    conditionCount: 0,
    paramIndex: 1,
    params: {},
  });

  const dialect = new PostgresDialect();

  describe('Logical Operators', () => {
    describe('handleAnd', () => {
      it('should return 1=1 for empty array', () => {
        const result = handleAnd([], createContext());
        expect(result.sql).toBe('1=1');
      });

      it('should join conditions with AND', () => {
        const conditions = [
          { sql: '"a" = $1', params: { '$1': 1 } },
          { sql: '"b" = $2', params: { '$2': 2 } },
        ];
        const result = handleAnd(conditions, createContext());
        expect(result.sql).toBe('(("a" = $1) AND ("b" = $2))');
        expect(result.params).toEqual({ '$1': 1, '$2': 2 });
      });

      it('should handle single condition', () => {
        const conditions = [{ sql: '"x" = $1', params: { '$1': 'test' } }];
        const result = handleAnd(conditions, createContext());
        expect(result.sql).toBe('(("x" = $1))');
      });
    });

    describe('handleOr', () => {
      it('should return 1=0 for empty array', () => {
        const result = handleOr([], createContext());
        expect(result.sql).toBe('1=0');
      });

      it('should join conditions with OR', () => {
        const conditions = [
          { sql: '"a" = $1', params: { '$1': 1 } },
          { sql: '"b" = $2', params: { '$2': 2 } },
        ];
        const result = handleOr(conditions, createContext());
        expect(result.sql).toBe('(("a" = $1) OR ("b" = $2))');
      });
    });

    describe('handleNot', () => {
      it('should wrap condition with NOT', () => {
        const condition = { sql: '"x" = $1', params: { '$1': 'test' } };
        const result = handleNot(condition);
        expect(result.sql).toBe('NOT ("x" = $1)');
      });
    });
  });

  describe('Comparison Operators', () => {
    describe('handleComparison', () => {
      it('should handle eq operator', () => {
        const ctx = createContext();
        const result = dialect.handleComparison('eq', '"name"', 'John', ctx);
        expect(result.sql).toBe('"name" = $1');
        expect(result.params).toEqual({ '$1': 'John' });
        expect(ctx.paramIndex).toBe(2);
      });

      it('should handle ne operator', () => {
        const ctx = createContext();
        const result = dialect.handleComparison('ne', '"status"', 'deleted', ctx);
        expect(result.sql).toBe('"status" <> $1');
      });

      it('should handle gt operator', () => {
        const ctx = createContext();
        const result = dialect.handleComparison('gt', '"age"', 18, ctx);
        expect(result.sql).toBe('"age" > $1');
      });

      it('should handle gte operator', () => {
        const ctx = createContext();
        const result = dialect.handleComparison('gte', '"age"', 21, ctx);
        expect(result.sql).toBe('"age" >= $1');
      });

      it('should handle lt operator', () => {
        const ctx = createContext();
        const result = dialect.handleComparison('lt', '"age"', 65, ctx);
        expect(result.sql).toBe('"age" < $1');
      });

      it('should handle lte operator', () => {
        const ctx = createContext();
        const result = dialect.handleComparison('lte', '"price"', 100, ctx);
        expect(result.sql).toBe('"price" <= $1');
      });
    });

    describe('handleBetween', () => {
      it('should handle between operator', () => {
        const ctx = createContext();
        const result = dialect.handleBetween('between', '"age"', [18, 65], ctx);
        expect(result.sql).toBe('"age" BETWEEN $1 AND $2');
        expect(result.params).toEqual({ '$1': 18, '$2': 65 });
      });

      it('should handle not_between operator', () => {
        const ctx = createContext();
        const result = dialect.handleBetween('not_between', '"price"', [0, 10], ctx);
        expect(result.sql).toBe('"price" NOT BETWEEN $1 AND $2');
      });
    });

    describe('handleNullCheck', () => {
      it('should handle is_null operator', () => {
        const result = dialect.handleNullCheck('is_null', '"deleted_at"');
        expect(result.sql).toBe('"deleted_at" IS NULL');
        expect(result.params).toEqual({});
      });

      it('should handle is_not_null operator', () => {
        const result = dialect.handleNullCheck('is_not_null', '"verified_at"');
        expect(result.sql).toBe('"verified_at" IS NOT NULL');
      });
    });
  });

  describe('String Operators', () => {
    describe('handleString', () => {
      it('should handle contains (case insensitive)', () => {
        const ctx = createContext();
        const result = dialect.handleString('contains', '"name"', 'john', ctx, false);
        expect(result.sql).toBe('"name" ILIKE $1');
        expect(result.params).toEqual({ '$1': '%john%' });
      });

      it('should handle contains (case sensitive)', () => {
        const ctx = createContext();
        const result = dialect.handleString('contains', '"name"', 'John', ctx, true);
        expect(result.sql).toBe('"name" LIKE $1');
        expect(result.params).toEqual({ '$1': '%John%' });
      });

      it('should handle starts_with', () => {
        const ctx = createContext();
        const result = dialect.handleString('starts_with', '"code"', 'ABC', ctx, false);
        expect(result.sql).toBe('"code" ILIKE $1');
        expect(result.params).toEqual({ '$1': 'ABC%' });
      });

      it('should handle ends_with', () => {
        const ctx = createContext();
        const result = dialect.handleString('ends_with', '"email"', '@gmail.com', ctx, false);
        expect(result.sql).toBe('"email" ILIKE $1');
        expect(result.params).toEqual({ '$1': '%@gmail.com' });
      });

      it('should handle like operator', () => {
        const ctx = createContext();
        const result = dialect.handleString('like', '"name"', '%test%', ctx, false);
        expect(result.sql).toBe('"name" LIKE $1');
      });

      it('should handle ilike operator', () => {
        const ctx = createContext();
        const result = dialect.handleString('ilike', '"name"', '%test%', ctx, false);
        expect(result.sql).toBe('"name" ILIKE $1');
      });

      it('should handle regex (case insensitive)', () => {
        const ctx = createContext();
        const result = dialect.handleString('regex', '"code"', '^[A-Z]+$', ctx, false);
        expect(result.sql).toBe('"code" ~* $1');
      });

      it('should handle regex (case sensitive)', () => {
        const ctx = createContext();
        const result = dialect.handleString('regex', '"code"', '^[A-Z]+$', ctx, true);
        expect(result.sql).toBe('"code" ~ $1');
      });

      it('should escape LIKE special characters in contains', () => {
        const ctx = createContext();
        const result = dialect.handleString('contains', '"name"', '50%_off', ctx, false);
        expect(result.params).toEqual({ '$1': '%50\\%\\_off%' });
      });
    });
  });

  describe('Array Operators', () => {
    describe('handleArray - IN', () => {
      it('should handle in operator', () => {
        const ctx = createContext();
        const result = dialect.handleArray('in', '"status"', ['a', 'b', 'c'], ctx);
        expect(result.sql).toBe('"status" IN ($1, $2, $3)');
        expect(result.params).toEqual({ '$1': 'a', '$2': 'b', '$3': 'c' });
      });

      it('should return 1=0 for empty in array', () => {
        const ctx = createContext();
        const result = dialect.handleArray('in', '"status"', [], ctx);
        expect(result.sql).toBe('1=0');
      });

      it('should handle not_in operator', () => {
        const ctx = createContext();
        const result = dialect.handleArray('not_in', '"id"', [1, 2], ctx);
        expect(result.sql).toBe('"id" NOT IN ($1, $2)');
      });

      it('should return 1=1 for empty not_in array', () => {
        const ctx = createContext();
        const result = dialect.handleArray('not_in', '"id"', [], ctx);
        expect(result.sql).toBe('1=1');
      });
    });

    describe('handleArray - PostgreSQL Arrays', () => {
      it('should handle contains (@>)', () => {
        const ctx = createContext();
        const result = dialect.handleArray('contains', '"tags"', ['a', 'b'], ctx);
        expect(result.sql).toBe('"tags" @> $1');
        expect(result.params).toEqual({ '$1': ['a', 'b'] });
      });

      it('should handle contained_by (<@)', () => {
        const ctx = createContext();
        const result = dialect.handleArray('contained_by', '"tags"', ['a', 'b', 'c'], ctx);
        expect(result.sql).toBe('"tags" <@ $1');
      });

      it('should handle overlaps (&&)', () => {
        const ctx = createContext();
        const result = dialect.handleArray('overlaps', '"tags"', ['x', 'y'], ctx);
        expect(result.sql).toBe('"tags" && $1');
      });
    });
  });
});
