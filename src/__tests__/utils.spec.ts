import { buildPagination, buildSort } from '../utils/pagination';
import { buildSelect } from '../utils/select';
import type { FilterSchema } from '../types';

describe('Utilities', () => {
  const testSchema: FilterSchema = {
    fields: {
      id: { type: 'uuid', operators: ['eq'] },
      name: { type: 'string', operators: ['eq'] },
      email: { type: 'string', operators: ['eq'], column: 'email_address' },
      createdAt: { type: 'timestamp', column: 'created_at', operators: ['gt'] },
      password: { type: 'string', operators: ['eq'], selectable: false },
      fullName: {
        type: 'string',
        computed: true,
        expression: "first_name || ' ' || last_name",
        operators: ['ilike'],
      },
    },
  };

  describe('buildPagination', () => {
    it('should build pagination with page/pageSize', () => {
      const result = buildPagination({ page: 2, pageSize: 10 });

      expect(result.sql).toBe('LIMIT $1 OFFSET $2');
      expect(result.params).toEqual({ 'p1': 10, 'p2': 10 });
      expect(result.meta).toEqual({ page: 2, pageSize: 10, offset: 10 });
      expect(result.nextParamIndex).toBe(3);
    });

    it('should build pagination with offset/limit', () => {
      const result = buildPagination({ offset: 50, limit: 25 });

      expect(result.sql).toBe('LIMIT $1 OFFSET $2');
      expect(result.params).toEqual({ 'p1': 25, 'p2': 50 });
      expect(result.nextParamIndex).toBe(3);
    });

    it('should use defaults when no options provided', () => {
      const result = buildPagination({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(result.meta.offset).toBe(0);
      expect(result.nextParamIndex).toBe(3);
    });

    it('should enforce max page size', () => {
      const result = buildPagination({ pageSize: 500 }, 100);

      expect(result.meta.pageSize).toBe(100);
    });

    it('should use startIndex for param placeholders', () => {
      // Simulating: WHERE clause used $1-$5, pagination starts at $6
      const result = buildPagination({ page: 1, pageSize: 20 }, 100, 6);

      expect(result.sql).toBe('LIMIT $6 OFFSET $7');
      expect(result.params).toEqual({ 'p6': 20, 'p7': 0 });
      expect(result.nextParamIndex).toBe(8);
    });

    it('should continue param index chain correctly', () => {
      // First pagination result
      const result1 = buildPagination({ page: 1, pageSize: 10 });
      expect(result1.nextParamIndex).toBe(3);

      // If we needed another parameterized clause after pagination
      // it should start at nextParamIndex (3)
      const result2 = buildPagination({ page: 2, pageSize: 10 }, 100, result1.nextParamIndex);
      expect(result2.sql).toBe('LIMIT $3 OFFSET $4');
      expect(result2.nextParamIndex).toBe(5);
    });
  });

  describe('buildSort', () => {
    it('should build single sort clause', () => {
      const result = buildSort([{ field: 'name' }], testSchema);

      expect(result.sql).toBe('ORDER BY "name" ASC');
    });

    it('should build multiple sort clause', () => {
      const result = buildSort(
        [
          { field: 'createdAt', direction: 'desc' },
          { field: 'name', direction: 'asc' },
        ],
        testSchema,
      );

      expect(result.sql).toBe('ORDER BY "created_at" DESC, "name" ASC');
    });

    it('should handle computed fields', () => {
      const result = buildSort([{ field: 'fullName', direction: 'asc' }], testSchema);

      expect(result.sql).toBe("ORDER BY (first_name || ' ' || last_name) ASC");
    });

    it('should return empty string for no sorts', () => {
      const result = buildSort([], testSchema);

      expect(result.sql).toBe('');
    });
  });

  describe('buildSelect', () => {
    it('should select specific fields', () => {
      const result = buildSelect(testSchema, { fields: ['id', 'name'] });

      expect(result.sql).toBe('"id", "name"');
      expect(result.fields).toEqual(['id', 'name']);
    });

    it('should select all selectable fields by default', () => {
      const result = buildSelect(testSchema);

      expect(result.fields).toContain('id');
      expect(result.fields).toContain('name');
      expect(result.fields).not.toContain('password');
    });

    it('should handle column aliases', () => {
      const result = buildSelect(testSchema, { fields: ['email'] });

      expect(result.sql).toBe('"email_address" AS "email"');
    });

    it('should handle computed fields', () => {
      const result = buildSelect(testSchema, { fields: ['fullName'] });

      expect(result.sql).toBe("(first_name || ' ' || last_name) AS \"fullName\"");
    });

    it('should exclude specified fields', () => {
      const result = buildSelect(testSchema, { exclude: ['id', 'email'] });

      expect(result.fields).not.toContain('id');
      expect(result.fields).not.toContain('email');
      expect(result.fields).toContain('name');
    });
  });
});
