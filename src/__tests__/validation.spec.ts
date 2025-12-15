import { JsonLogicCompiler } from '../compiler';
import { FilterSchema } from '../types';

describe('Dialect Validation', () => {
  const schema: FilterSchema = {
    fields: {
      tags: { type: 'array', operators: ['contains', 'overlaps', 'contained_by', 'in'] },
      meta: { type: 'jsonb', operators: ['json_contains', 'json_has_key'] },
      name: { type: 'string', operators: ['regex'] },
    },
  };

  describe('SQLite Limitations', () => {
    const compiler = new JsonLogicCompiler({ schema, dialect: 'sqlite' });

    it('should throw for array contains', () => {
      expect(() => {
        compiler.compile({ 'contains': [{ var: 'tags' }, ['a']] });
      }).toThrow("Array operator 'contains' is not supported in SQLite dialect");
    });

    it('should throw for array overlaps', () => {
      expect(() => {
        compiler.compile({ 'overlaps': [{ var: 'tags' }, ['a']] });
      }).toThrow("Array operator 'overlaps' is not supported in SQLite dialect");
    });
    
    it('should throw for json_contains', () => {
        expect(() => {
            compiler.compile({ 'json_contains': [{ var: 'meta' }, { a: 1 }] });
        }).toThrow("JSON operator 'json_contains' is not supported in SQLite dialect");
    });
  });

  describe('MSSQL Limitations', () => {
    const compiler = new JsonLogicCompiler({ schema, dialect: 'mssql' });

    it('should throw for regex', () => {
      expect(() => {
        compiler.compile({ 'regex': [{ var: 'name' }, '^A'] });
      }).toThrow('Regex not supported in MSSQL');
    });

    it('should throw for array contains', () => {
      expect(() => {
        compiler.compile({ 'contains': [{ var: 'tags' }, ['a']] });
      }).toThrow("Array operator 'contains' is not supported in MSSQL dialect");
    });
    
    it('should throw for json operators', () => {
         expect(() => {
            compiler.compile({ 'json_has_key': [{ var: 'meta' }, 'key'] });
        }).toThrow("JSON operator 'json_has_key' is not supported in MSSQL dialect");
    });
  });
  
  describe('MySQL Limitations', () => {
      const compiler = new JsonLogicCompiler({ schema, dialect: 'mysql' });
      
      it('should throw for overlaps', () => {
          expect(() => {
            compiler.compile({ 'overlaps': [{ var: 'tags' }, ['a']] });
          }).toThrow("Operator 'overlaps' is not supported in MySQL dialect");
      });
  });
});
