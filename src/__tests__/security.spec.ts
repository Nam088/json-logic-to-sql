import { sanitizeInput, escapeIdentifier, escapeJsonPath, validateParameterValue } from '../security/sanitizer';

describe('Security Utilities', () => {
  describe('sanitizeInput', () => {
    it('should return null/undefined as-is', () => {
      expect(sanitizeInput(null)).toBeNull();
      expect(sanitizeInput(undefined)).toBeUndefined();
    });

    it('should return primitives as-is', () => {
      expect(sanitizeInput('hello')).toBe('hello');
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(true)).toBe(true);
    });

    it('should sanitize arrays', () => {
      const input = ['a', 'b', 'c'];
      expect(sanitizeInput(input)).toEqual(['a', 'b', 'c']);
    });

    it('should remove __proto__ key from objects', () => {
      const input = { name: 'test' };
      // Manually add __proto__ as a key
      Object.defineProperty(input, '__proto__', {
        value: { malicious: true },
        enumerable: true,
      });
      const result = sanitizeInput(input) as Record<string, unknown>;

      expect(result.name).toBe('test');
      expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    });

    it('should remove constructor key from objects', () => {
      const input: Record<string, unknown> = {
        value: 1,
      };
      // Manually add constructor as a key
      Object.defineProperty(input, 'constructor', {
        value: 'malicious',
        enumerable: true,
      });
      const result = sanitizeInput(input) as Record<string, unknown>;

      expect(result.value).toBe(1);
      expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
    });

    it('should remove prototype from objects', () => {
      const input: Record<string, unknown> = {
        data: 'safe',
      };
      // Manually add prototype as a key
      Object.defineProperty(input, 'prototype', {
        value: { dangerous: true },
        enumerable: true,
      });
      const result = sanitizeInput(input) as Record<string, unknown>;

      expect(result.data).toBe('safe');
      expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
    });

    it('should recursively sanitize nested objects', () => {
      const nested: Record<string, unknown> = { value: 'nested' };
      Object.defineProperty(nested, '__proto__', {
        value: { hack: true },
        enumerable: true,
      });
      const input = { level1: { level2: nested } };
      const result = sanitizeInput(input) as any;

      expect(result.level1.level2.value).toBe('nested');
      expect(Object.prototype.hasOwnProperty.call(result.level1.level2, '__proto__')).toBe(false);
    });
  });

  describe('escapeIdentifier', () => {
    it('should escape valid identifiers', () => {
      expect(escapeIdentifier('name')).toBe('"name"');
      expect(escapeIdentifier('user_id')).toBe('"user_id"');
      expect(escapeIdentifier('Column1')).toBe('"Column1"');
    });

    it('should allow underscores', () => {
      expect(escapeIdentifier('created_at')).toBe('"created_at"');
      expect(escapeIdentifier('_private')).toBe('"_private"');
    });

    it('should reject invalid identifiers', () => {
      expect(() => escapeIdentifier('123abc')).toThrow('Invalid identifier');
      expect(() => escapeIdentifier('name;DROP')).toThrow('Invalid identifier');
      expect(() => escapeIdentifier('col--comment')).toThrow('Invalid identifier');
      expect(() => escapeIdentifier('')).toThrow('Invalid identifier');
    });

    it('should reject SQL injection attempts', () => {
      expect(() => escapeIdentifier('name"; DELETE FROM users; --')).toThrow();
      expect(() => escapeIdentifier("name'; DROP TABLE--")).toThrow();
    });
  });

  describe('validateParameterValue', () => {
    it('should accept valid values', () => {
      expect(() => validateParameterValue('hello')).not.toThrow();
      expect(() => validateParameterValue(123)).not.toThrow();
      expect(() => validateParameterValue(null)).not.toThrow();
    });

    it('should reject strings with null bytes', () => {
      expect(() => validateParameterValue('hello\0world')).toThrow('null byte');
    });
  });
});
