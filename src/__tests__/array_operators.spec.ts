
import { JsonLogicCompiler } from '../compiler';
import { FilterSchema } from '../types';

describe('Array Operators', () => {
    const schema: FilterSchema = {
        fields: {
            tags: {
                type: 'array',
                operators: ['in', 'not_in', 'any_of'],
                title: 'Tags',
                inputType: 'text',
                column: '_tags',
            },
            categories: {
                type: 'jsonb',
                operators: ['in', 'not_in'],
                title: 'Categories',
                inputType: 'text',
                column: 'categories',
            },
        },
    };

    const compiler = new JsonLogicCompiler({
        schema,
        dialect: 'postgresql',
    });

    describe('Validator', () => {
        it('should allow "in" operator with array value for array field (semantics: array intersects list)', () => {
            const rule = { in: [{ var: 'tags' }, ['uuid-1', 'uuid-2']] };
            // This used to throw SchemaValidationError
            expect(() => compiler.compile(rule)).not.toThrow();
        });

        it('should allow "not_in" operator with array value for array field', () => {
            const rule = { not_in: [{ var: 'tags' }, ['uuid-1', 'uuid-2']] };
            expect(() => compiler.compile(rule)).not.toThrow();
        });
    });

    describe('PostgreSQL Compiler', () => {
        it('should compile "in" to "&&" (overlaps) for array field', () => {
            const rule = { in: [{ var: 'tags' }, ['uuid-1', 'uuid-2']] };
            const result = compiler.compile(rule);

            expect(result.sql).toBe('"_tags" && $1');
            expect(result.paramsArray).toEqual([['uuid-1', 'uuid-2']]);
        });

        it('should compile "not_in" to "NOT (... && ...)" for array field', () => {
            const rule = { not_in: [{ var: 'tags' }, ['uuid-1', 'uuid-2']] };
            const result = compiler.compile(rule);

            expect(result.sql).toBe('NOT ("_tags" && $1)');
            expect(result.paramsArray).toEqual([['uuid-1', 'uuid-2']]);
        });

        it('should compile "any_of" with array value to "&&" (overlaps) for array field', () => {
            const rule = { any_of: [{ var: 'tags' }, ['uuid-1', 'uuid-2']] };
            const result = compiler.compile(rule);

            expect(result.sql).toBe('"_tags" && $1');
            expect(result.paramsArray).toEqual([['uuid-1', 'uuid-2']]);
        });

        it('should compile "in" to "EXISTS" logic for jsonb field (delegated to overlaps)', () => {
            // Logic for overlaps on JSONB
            // depends on implementation of handleOverlaps for JSONB in postgresql dialect
            const rule = { in: [{ var: 'categories' }, ['cat-1']] };
            const result = compiler.compile(rule);

            // Expected SQL pattern based on handleOverlaps implementation
            expect(result.sql).toContain('EXISTS (SELECT 1 FROM jsonb_array_elements_text("categories") AS elem WHERE elem = ANY(');
        });
    });
});
