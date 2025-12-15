import {
  applyColumnMapping,
  applyJsonPathMapping,
  applyFieldMappings,
  toPublicSchema,
} from '../utils/schema-mapping';
import type { FilterSchema } from '../types';

describe('Schema Mapping Utilities', () => {
  const baseSchema: FilterSchema = {
    fields: {
      tags: { type: 'array', operators: ['contains'] },
      priority: { type: 'string', operators: ['eq'] },
      fullName: { type: 'string', operators: ['ilike'] },
      simple: { type: 'integer', operators: ['eq'] },
    },
  };

  describe('applyColumnMapping', () => {
    it('should add column mapping to fields', () => {
      const mapping = {
        tags: '_tags',
      };

      const result = applyColumnMapping(baseSchema, mapping);

      expect((result.fields.tags as any).column).toBe('_tags');
      expect((result.fields.priority as any).column).toBeUndefined();
    });

    it('should support table alias in mapping', () => {
      const mapping = {
        tags: { table: 'users', column: 'tags' },
        priority: { table: 'meta', column: 'priority' },
      };

      const result = applyColumnMapping(baseSchema, mapping);

      expect((result.fields.tags as any).column).toBe('users.tags');
      expect((result.fields.priority as any).column).toBe('meta.priority');
    });

    it('should ignore mapping for unknown fields', () => {
      const mapping = {
        unknown: 'col',
      };

      const result = applyColumnMapping(baseSchema, mapping);
      expect(result.fields.unknown).toBeUndefined();
    });
  });

  describe('applyJsonPathMapping', () => {
    it('should add jsonPath to fields', () => {
      const mapping = {
        priority: "metadata->>'priority'",
      };

      const result = applyJsonPathMapping(baseSchema, mapping);

      expect((result.fields.priority as any).jsonPath).toBe("metadata->>'priority'");
      expect((result.fields.tags as any).jsonPath).toBeUndefined();
    });
  });

  describe('applyFieldMappings', () => {
    it('should apply all mappings correctly', () => {
      const result = applyFieldMappings(baseSchema, {
        columns: { tags: '_tags' },
        jsonPaths: { priority: "meta->>'prio'" },
        expressions: { fullName: "first || ' ' || last" },
      });

      // Check column mapping
      expect((result.fields.tags as any).column).toBe('_tags');
      
      // Check JSON path
      expect((result.fields.priority as any).jsonPath).toBe("meta->>'prio'");
      
      // Check computed expression
      const fullName = result.fields.fullName as any;
      expect(fullName.computed).toBe(true);
      expect(fullName.expression).toBe("first || ' ' || last");
      
      // Check untouched field
      expect((result.fields.simple as any).column).toBeUndefined();
    });
  });

  describe('toPublicSchema', () => {
    it('should strip internal fields', () => {
      const internalSchema: FilterSchema = {
        fields: {
          tags: { 
            type: 'array', 
            operators: ['contains'],
            column: '_tags' 
          },
          priority: { 
            type: 'string', 
            operators: ['eq'],
            jsonPath: "meta->>'prio'"
          },
          fullName: {
            type: 'string',
            operators: ['ilike'],
            computed: true,
            expression: "concat(a, b)"
          }
        } as any
      };

      const publicSchema = toPublicSchema(internalSchema);

      // Check stripped fields
      expect((publicSchema.fields.tags as any).column).toBeUndefined();
      expect((publicSchema.fields.priority as any).jsonPath).toBeUndefined();
      
      // Check computed field stripped
      const fullName = publicSchema.fields.fullName as any;
      expect(fullName.computed).toBeUndefined();
      expect(fullName.expression).toBeUndefined();
      
      // Check preserved fields
      expect(publicSchema.fields.tags.type).toBe('array');
      expect(publicSchema.fields.tags.operators).toEqual(['contains']);
    });
  });
});
