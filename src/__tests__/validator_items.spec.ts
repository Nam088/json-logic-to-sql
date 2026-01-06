
import { SchemaValidator, SchemaValidationError } from '../schema/validator';
import type { FilterSchema } from '../types';

describe('SchemaValidator - Items Type Validation', () => {
    const testSchema: FilterSchema = {
        fields: {
            tags: {
                type: 'array',
                items: { type: 'string' },
                title: 'Tags',
                inputType: 'text',
                operators: ['contains', 'any_of', 'any_ilike'],
            },
            ids: {
                type: 'array',
                items: { type: 'uuid' },
                title: 'IDs',
                inputType: 'text',
                operators: ['contains', 'any_of'],
            },
            numbers: {
                type: 'array',
                items: { type: 'number' },
                title: 'Numbers',
                inputType: 'number',
                operators: ['contains', 'any_of'],
            },
        },
        settings: { strict: true },
    };

    let validator: SchemaValidator;

    beforeEach(() => {
        validator = new SchemaValidator(testSchema);
    });

    describe('Array Item Validation', () => {
        it('should validate array items type correctly against items.type', () => {
            // Valid string array
            expect(() => validator.validateValue('tags', 'contains', ['tag1', 'tag2'])).not.toThrow();

            // Invalid: contains number in string array
            expect(() => validator.validateValue('tags', 'contains', ['tag1', 123])).toThrow('Expected string');
        });

        it('should validate any_of scalar value against items.type', () => {
            // Valid scalar string
            expect(() => validator.validateValue('tags', 'any_of', 'tag1')).not.toThrow();

            // Invalid scalar number
            expect(() => validator.validateValue('tags', 'any_of', 123)).toThrow('Expected string');
        });

        it('should validate any_of array value against items.type', () => {
            // Valid string array
            expect(() => validator.validateValue('tags', 'any_of', ['tag1', 'tag2'])).not.toThrow();

            // Invalid: number in string array
            expect(() => validator.validateValue('tags', 'any_of', ['tag1', 123])).toThrow('Expected string');
        });

        it('should validate any_ilike scalar value against items.type', () => {
            // Valid scalar string
            expect(() => validator.validateValue('tags', 'any_ilike', 'pattern')).not.toThrow();

            // Invalid scalar number
            expect(() => validator.validateValue('tags', 'any_ilike', 123)).toThrow('Expected string');
        });
    });

    describe('UUID Item Validation', () => {
        const validUuid = '550e8400-e29b-41d4-a716-446655440000';

        it('should validate uuid items', () => {
            expect(() => validator.validateValue('ids', 'contains', [validUuid])).not.toThrow();

            // Invalid uuid
            expect(() => validator.validateValue('ids', 'contains', ['invalid-uuid'])).toThrow('Expected UUID');
        });
    });

    describe('Number Item Validation', () => {
        it('should validate number items', () => {
            expect(() => validator.validateValue('numbers', 'contains', [1, 2, 3])).not.toThrow();

            // Invalid string in number array
            expect(() => validator.validateValue('numbers', 'contains', [1, '2'])).toThrow('Expected number');
        });
    });
});
