import { pickSchemaFields, omitSchemaFields, get, pick, omit, getPublicSchema, DEFAULT_INTERNAL_FIELDS } from '../schema-filter';
import type { FilterSchema } from '../../types';

describe('Schema Filter Utils', () => {
    const mockSchema: FilterSchema = {
        fields: {
            id: { type: 'string', operators: ['eq'], title: 'ID', inputType: 'text' },
            name: { type: 'string', operators: ['eq', 'like'], title: 'Name', inputType: 'text' },
            secret: { type: 'string', operators: ['eq'], title: 'Secret', inputType: 'password' },
            role: { type: 'string', operators: ['in'], title: 'Role', inputType: 'select' },
            createdAt: { type: 'datetime', operators: ['between'], title: 'Created At', inputType: 'date' },
        },
        settings: {
            maxDepth: 5,
        },
    };

    describe('get', () => {
        const obj = {
            a: {
                b: {
                    c: 1,
                    d: null,
                    e: undefined,
                },
            },
        };

        it('should retrieve nested value using dot notation', () => {
            expect(get(obj, 'a.b.c')).toBe(1);
        });

        it('should retrieve nested value using array path', () => {
            expect(get(obj, ['a', 'b', 'c'])).toBe(1);
        });

        it('should return default value if path does not exist', () => {
            expect(get(obj, 'a.b.x', 'defaultValue')).toBe('defaultValue');
        });

        it('should return undefined if path does not exist and no default value', () => {
            expect(get(obj, 'a.b.x')).toBeUndefined();
        });

        it('should handle null values in path gracefully', () => {
            expect(get(obj, 'a.b.d.x', 'default')).toBe('default');
        });

        it('should return actual value if it is null', () => {
            expect(get(obj, 'a.b.d')).toBeNull();
        });

        it('should return default value if resolved value is undefined', () => {
            expect(get(obj, 'a.b.e', 'default')).toBe('default');
        });
    });

    describe('pick', () => {
        it('should pick specified keys', () => {
            const obj = { a: 1, b: 2, c: 3 };
            expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
        });

        it('should ignore non-existent keys', () => {
            const obj = { a: 1, b: 2 };
            // @ts-expect-error - Testing runtime behavior for non-existent keys
            expect(pick(obj, ['a', 'x'])).toEqual({ a: 1 });
        });
    });

    describe('omit', () => {
        it('should omit specified keys', () => {
            const obj = { a: 1, b: 2, c: 3 };
            expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
        });

        it('should handle non-existent keys gracefully', () => {
            const obj = { a: 1, b: 2 };
            // @ts-expect-error - Testing runtime behavior for non-existent keys
            expect(omit(obj, ['b', 'x'])).toEqual({ a: 1 });
        });
    });

    describe('pickSchemaFields', () => {
        it('should return a schema with only picked fields', () => {
            const result = pickSchemaFields(mockSchema, ['id', 'name']);

            expect(Object.keys(result.fields)).toHaveLength(2);
            expect(result.fields).toHaveProperty('id');
            expect(result.fields).toHaveProperty('name');
            expect(result.fields).not.toHaveProperty('secret');
            expect(result.fields).not.toHaveProperty('role');
            expect(result.fields).not.toHaveProperty('createdAt');
        });

        it('should preserve schema settings', () => {
            const result = pickSchemaFields(mockSchema, ['id']);
            expect(result.settings).toEqual(mockSchema.settings);
        });

        it('should handle picking non-existent fields gracefully (ignore them)', () => {
            const result = pickSchemaFields(mockSchema, ['id', 'nonExistent']);

            expect(Object.keys(result.fields)).toHaveLength(1);
            expect(result.fields).toHaveProperty('id');
            expect(result.fields).not.toHaveProperty('nonExistent');
        });

        it('should return empty fields if nothing matches', () => {
            const result = pickSchemaFields(mockSchema, ['nonExistent']);
            expect(Object.keys(result.fields)).toHaveLength(0);
        });
    });

    describe('omitSchemaFields', () => {
        it('should return a schema without omitted fields', () => {
            const result = omitSchemaFields(mockSchema, ['secret', 'role']);

            expect(Object.keys(result.fields)).toHaveLength(3);
            expect(result.fields).toHaveProperty('id');
            expect(result.fields).toHaveProperty('name');
            expect(result.fields).toHaveProperty('createdAt');
            expect(result.fields).not.toHaveProperty('secret');
            expect(result.fields).not.toHaveProperty('role');
        });

        it('should preserve schema settings', () => {
            const result = omitSchemaFields(mockSchema, ['secret']);
            expect(result.settings).toEqual(mockSchema.settings);
        });

        it('should handle omitting non-existent fields gracefully', () => {
            const result = omitSchemaFields(mockSchema, ['id', 'nonExistent']);

            expect(Object.keys(result.fields)).toHaveLength(4);
            expect(result.fields).not.toHaveProperty('id');
            expect(result.fields).toHaveProperty('name');
        });

        it('should return original fields if nothing to omit', () => {
            const result = omitSchemaFields(mockSchema, []);
            expect(Object.keys(result.fields)).toHaveLength(5);
            expect(result.fields).toEqual(mockSchema.fields);
        });
    });

    describe('getPublicSchema', () => {
        it('should remove default internal fields', () => {
            const complexSchema = {
                fields: {
                    user_id: {
                        type: 'string',
                        operators: ['eq'],
                        column: 'users.id', // Internal
                        jsonPath: 'data->id', // Internal
                        title: 'User ID',
                        inputType: 'text',
                        internal: { secret_flag: true }, // Internal (renamed from meta)
                    },
                    computed_name: {
                        type: 'string',
                        operators: ['like'],
                        computed: true, // Internal
                        expression: "first_name || ' ' || last_name", // Internal
                        title: 'Full Name',
                        inputType: 'text',
                    },
                },
            } as any;

            const result = getPublicSchema(complexSchema);

            expect(result.fields.user_id).not.toHaveProperty('column');
            expect(result.fields.user_id).not.toHaveProperty('jsonPath');
            expect(result.fields.user_id).not.toHaveProperty('internal');
            expect(result.fields.user_id).toHaveProperty('title', 'User ID');

            expect(result.fields.computed_name).not.toHaveProperty('computed');
            expect(result.fields.computed_name).not.toHaveProperty('expression');
            expect(result.fields.computed_name).toHaveProperty('title', 'Full Name');
        });

        it('should preserve config field', () => {
            const schema = {
                fields: {
                    status: {
                        type: 'string',
                        operators: ['eq'],
                        title: 'Status',
                        config: { // Public config
                            placeholder: 'Select status',
                            options: ['active', 'inactive'],
                        },
                        internal: { // Internal config
                            db_index: true,
                        },
                    },
                },
            } as any;

            const result = getPublicSchema(schema);

            expect(result.fields.status).toHaveProperty('config');
            expect((result.fields.status as any).config).toEqual({
                placeholder: 'Select status',
                options: ['active', 'inactive'],
            });
            expect(result.fields.status).not.toHaveProperty('internal');
        });

        it('should remove additional fields if specified (extending defaults)', () => {
            const schema = {
                fields: {
                    secret: {
                        type: 'string',
                        operators: ['eq'],
                        internal_code: '123',
                        column: 'secrets.val'
                    },
                },
            } as any;

            // To extend, we spread the default list
            const result = getPublicSchema(schema, [...DEFAULT_INTERNAL_FIELDS, 'internal_code']);

            expect(result.fields.secret).not.toHaveProperty('column');
            expect(result.fields.secret).not.toHaveProperty('internal_code');
        });

        it('should allow overriding defaults', () => {
            const schema = {
                fields: {
                    user_id: {
                        type: 'string',
                        operators: ['eq'],
                        column: 'users.id', // Listed in defaults
                        other_internal: 'secret',
                    },
                },
            } as any;

            // Override: only omit 'other_internal', keep 'column'
            const result = getPublicSchema(schema, ['other_internal']);

            expect(result.fields.user_id).toHaveProperty('column'); // Should be kept now
            expect(result.fields.user_id).not.toHaveProperty('other_internal');
        });
    });
});
