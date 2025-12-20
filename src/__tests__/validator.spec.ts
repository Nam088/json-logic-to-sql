import { SchemaValidator, SchemaValidationError } from '../schema/validator';
import type { FilterSchema } from '../types';

describe('SchemaValidator', () => {
  const testSchema: FilterSchema = {
    fields: {
      id: { type: 'uuid', title: 'ID', inputType: 'text', operators: ['eq', 'in'] },
      name: { type: 'string', title: 'Name', inputType: 'text', operators: ['eq', 'ilike'], constraints: { minLength: 2, maxLength: 50 } },
      age: { type: 'integer', title: 'Age', inputType: 'number', operators: ['eq', 'gt', 'lt'], constraints: { min: 0, max: 150 } },
      email: { type: 'string', title: 'Email', inputType: 'text', operators: ['eq'], nullable: true },
      status: {
        type: 'string',
        title: 'Status',
        inputType: 'select',
        operators: ['eq', 'in'],
        options: { items: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
      },
      secretField: { type: 'string', title: 'Secret', inputType: 'text', operators: ['eq'], filterable: false },
      birthDate: {
        type: 'date',
        title: 'Birth Date',
        inputType: 'date',
        operators: ['eq', 'gt'],
        constraints: {
          dateFormat: 'YYYY-MM-DD',
          minDate: '1900-01-01',
          maxDate: '2024-12-31',
        },
      },
      createdAt: { type: 'timestamp', title: 'Created At', inputType: 'datetime', operators: ['gt', 'lt'] },
      isActive: { type: 'boolean', title: 'Is Active', inputType: 'checkbox', operators: ['eq'] },
      score: { type: 'decimal', title: 'Score', inputType: 'number', operators: ['eq', 'gt'] },
      tags: { type: 'array', title: 'Tags', inputType: 'multiselect', operators: ['contains'], constraints: { minItems: 1, maxItems: 10 } },
      meta: { type: 'jsonb', title: 'Meta', inputType: 'json', operators: ['json_contains'] },
    },
    settings: { strict: true },
  };

  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator(testSchema);
  });

  describe('getFieldSchema', () => {
    it('should return field schema for valid field', () => {
      const schema = validator.getFieldSchema('name');
      expect(schema.type).toBe('string');
    });

    it('should throw for unknown field in strict mode', () => {
      expect(() => validator.getFieldSchema('unknown')).toThrow(SchemaValidationError);
    });

    it('should throw for non-filterable field', () => {
      expect(() => validator.getFieldSchema('secretField')).toThrow('not filterable');
    });
  });

  describe('validateOperator', () => {
    it('should accept allowed operators', () => {
      expect(() => validator.validateOperator('name', 'eq')).not.toThrow();
      expect(() => validator.validateOperator('name', 'ilike')).not.toThrow();
    });

    it('should reject disallowed operators', () => {
      expect(() => validator.validateOperator('name', 'gt')).toThrow(SchemaValidationError);
    });
  });

  describe('validateValue - Type Validation', () => {
    it('should validate string type', () => {
      expect(() => validator.validateValue('name', 'eq', 'John')).not.toThrow();
      expect(() => validator.validateValue('name', 'eq', 123)).toThrow('Expected string');
    });

    it('should validate integer type', () => {
      expect(() => validator.validateValue('age', 'eq', 25)).not.toThrow();
      expect(() => validator.validateValue('age', 'eq', 25.5)).toThrow('Expected integer');
      expect(() => validator.validateValue('age', 'eq', 'twenty')).toThrow('Expected number');
    });

    it('should validate boolean type', () => {
      expect(() => validator.validateValue('isActive', 'eq', true)).not.toThrow();
      expect(() => validator.validateValue('isActive', 'eq', 'true')).toThrow('Expected boolean');
    });

    it('should validate uuid type', () => {
      expect(() => validator.validateValue('id', 'eq', '550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
      expect(() => validator.validateValue('id', 'eq', 'invalid-uuid')).toThrow('Expected UUID');
    });

    it('should validate decimal type', () => {
      expect(() => validator.validateValue('score', 'eq', 99.5)).not.toThrow();
      expect(() => validator.validateValue('score', 'eq', 100)).not.toThrow();
    });

    it('should validate date type', () => {
      expect(() => validator.validateValue('createdAt', 'gt', '2024-01-01T00:00:00Z')).not.toThrow();
      expect(() => validator.validateValue('createdAt', 'gt', 'invalid-date')).toThrow('Invalid date');
    });

    it('should validate array type', () => {
      expect(() => validator.validateValue('tags', 'contains', ['tag1', 'tag2'])).not.toThrow();
      expect(() => validator.validateValue('tags', 'contains', 'not-array')).toThrow('Expected array');
    });

    it('should validate jsonb type', () => {
      expect(() => validator.validateValue('meta', 'json_contains', { key: 'value' })).not.toThrow();
    });
  });

  describe('validateValue - Nullable', () => {
    it('should accept null for nullable fields', () => {
      expect(() => validator.validateValue('email', 'eq', null)).not.toThrow();
    });

    it('should reject null for non-nullable fields', () => {
      expect(() => validator.validateValue('name', 'eq', null)).toThrow('Null value not allowed');
    });
  });

  describe('validateValue - String Constraints', () => {
    it('should validate minLength', () => {
      expect(() => validator.validateValue('name', 'eq', 'A')).toThrow('too short');
      expect(() => validator.validateValue('name', 'eq', 'AB')).not.toThrow();
    });

    it('should validate maxLength', () => {
      expect(() => validator.validateValue('name', 'eq', 'A'.repeat(51))).toThrow('too long');
      expect(() => validator.validateValue('name', 'eq', 'A'.repeat(50))).not.toThrow();
    });
  });

  describe('validateValue - Number Constraints', () => {
    it('should validate min', () => {
      expect(() => validator.validateValue('age', 'eq', -1)).toThrow('too small');
      expect(() => validator.validateValue('age', 'eq', 0)).not.toThrow();
    });

    it('should validate max', () => {
      expect(() => validator.validateValue('age', 'eq', 151)).toThrow('too large');
      expect(() => validator.validateValue('age', 'eq', 150)).not.toThrow();
    });
  });

  describe('validateValue - Array Constraints', () => {
    it('should validate minItems', () => {
      expect(() => validator.validateValue('tags', 'contains', [])).toThrow('too short');
    });

    it('should validate maxItems', () => {
      expect(() => validator.validateValue('tags', 'contains', Array(11).fill('tag'))).toThrow('too long');
    });
  });

  describe('validateValue - Options', () => {
    it('should accept valid option values', () => {
      expect(() => validator.validateValue('status', 'eq', 'active')).not.toThrow();
      expect(() => validator.validateValue('status', 'eq', 'inactive')).not.toThrow();
    });

    it('should reject invalid option values', () => {
      expect(() => validator.validateValue('status', 'eq', 'pending')).toThrow('Invalid option value');
    });

    it('should validate array of option values', () => {
      expect(() => validator.validateValue('status', 'in', ['active', 'inactive'])).not.toThrow();
      expect(() => validator.validateValue('status', 'in', ['active', 'invalid'])).toThrow('Invalid option value');
    });
  });

  describe('validateValue - Date Constraints', () => {
    it('should validate date format', () => {
      expect(() => validator.validateValue('birthDate', 'eq', '2000-12-15')).not.toThrow();
      expect(() => validator.validateValue('birthDate', 'eq', '12-15-2000')).toThrow('Invalid date format');
    });

    it('should validate minDate', () => {
      expect(() => validator.validateValue('birthDate', 'eq', '1899-12-31')).toThrow('too early');
    });

    it('should validate maxDate', () => {
      expect(() => validator.validateValue('birthDate', 'eq', '2025-01-01')).toThrow('too late');
    });
  });
});
