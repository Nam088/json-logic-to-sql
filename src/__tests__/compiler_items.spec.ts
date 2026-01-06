
import { JsonLogicCompiler } from '../compiler';
import { FilterSchema } from '../types';

describe('Compiler - Items & Array Operators', () => {
    const schema: FilterSchema = {
        fields: {
            tags: {
                type: 'array',
                items: { type: 'string' },
                title: 'Tags',
                inputType: 'text',
                // Note: any_ilike is now supported
                operators: ['any_ilike', 'any_of', 'contains', 'not_any_ilike'],
                column: '_tags',
            },
        },
        settings: {
            paramStyle: 'positional', // Use $1, $2
        }
    };

    const compiler = new JsonLogicCompiler({
        schema,
        dialect: 'postgresql',
    });

    it('should compile "any_ilike" correctly (Case Insensitive Search)', () => {
        // This is the main fix for the user's issue
        const rule = { any_ilike: [{ var: 'tags' }, 'Fake'] };
        const result = compiler.compile(rule);

        // Expect unnest + ILIKE pattern
        expect(result.sql).toBe('EXISTS (SELECT 1 FROM unnest("_tags") AS x WHERE x ILIKE $1)');
        expect(result.params).toEqual({ p1: '%Fake%' });
    });

    it('should compile "any_of" with scalar value (Case Sensitive Check)', () => {
        const rule = { any_of: [{ var: 'tags' }, 'ExactValue'] };
        const result = compiler.compile(rule);

        // Expect strict equality check against array
        expect(result.sql).toBe('$1 = ANY("_tags")');
        expect(result.params).toEqual({ p1: 'ExactValue' });
    });

    it('should compile "any_of" with array value (Overlaps)', () => {
        const rule = { any_of: [{ var: 'tags' }, ['Val1', 'Val2']] };
        const result = compiler.compile(rule);

        // Expect overlaps operator &&
        expect(result.sql).toBe('"_tags" && $1');
        expect(result.params).toEqual({ p1: ['Val1', 'Val2'] });
    });

    it('should compile "not_any_ilike" correctly (Negated Case Insensitive Search)', () => {
        const rule = { not_any_ilike: [{ var: 'tags' }, 'Excluder'] };
        const result = compiler.compile(rule);

        expect(result.sql).toBe('NOT EXISTS (SELECT 1 FROM unnest("_tags") AS x WHERE x ILIKE $1)');
        expect(result.params).toEqual({ p1: '%Excluder%' });
    });
});
