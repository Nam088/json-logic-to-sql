import { JsonLogicCompiler } from '../compiler';
import { CompilerConfig } from '../types';
import { SchemaValidationError, CompilerError } from '../compiler';

describe('Edge Cases', () => {
  const config: CompilerConfig = {
    schema: {
      fields: {
        strField: { type: 'string', operators: ['eq', 'ne', 'like', 'in'], nullable: true },
        numField: { type: 'number', operators: ['eq', 'gt', 'lt'] },
        arrField: { type: 'array', operators: ['contains', 'overlaps'] },
        dateField: { type: 'date', operators: ['eq'] },
      },
      settings: {
        maxDepth: 3,
        maxConditions: 5,
        strict: true
      },
    },
    dialect: 'postgresql',
  };

  const compiler = new JsonLogicCompiler(config);

  describe('Logical Operators', () => {
    it('should handle empty AND as 1=1 (identity for AND)', () => {
      const result = compiler.compile({ and: [] });
      expect(result.sql).toBe('1=1');
    });

    it('should handle empty OR as 1=0 (identity for OR)', () => {
      const result = compiler.compile({ or: [] });
      expect(result.sql).toBe('1=0');
    });
  });

  describe('Limits and Security', () => {
    it('should throw when max depth is exceeded', () => {
      // Depth: 0 (root) -> 1 (and) -> 2 (and) -> 3 (and) -> 4 (too deep)
      const deepRule = {
        and: [{
          and: [{
            and: [{
              and: [{ '==': [{ var: 'strField' }, 'val'] }]
            }]
          }]
        }]
      };
      
      expect(() => compiler.compile(deepRule)).toThrow(/Maximum nesting depth exceeded/);
    });

    it('should throw when max conditions is exceeded', () => {
      const manyConditions = {
        and: [
          { '==': [{ var: 'strField' }, '1'] },
          { '==': [{ var: 'strField' }, '2'] },
          { '==': [{ var: 'strField' }, '3'] },
          { '==': [{ var: 'strField' }, '4'] },
          { '==': [{ var: 'strField' }, '5'] },
          { '==': [{ var: 'strField' }, '6'] }, // 6th condition
        ]
      };
      // Note: "and" itself counts as logic, but conditionCount increments on scalar conditions
      expect(() => compiler.compile(manyConditions)).toThrow(/Maximum condition count exceeded/);
    });

    it('should properly escape special characters in field identifiers', () => {
       // Assuming we can map a weird column name via schema
       const weirdSchemaConfig: CompilerConfig = {
         schema: {
           fields: {
             weirdField: { 
               type: 'string', 
               operators: ['eq'],
               column: 'weird"column' // malicious column name attempt
             }
           }
         },
         dialect: 'postgresql'
       };
       const weirdCompiler = new JsonLogicCompiler(weirdSchemaConfig);
       const result = weirdCompiler.compile({ '==': [{ var: 'weirdField' }, 'val'] });
       expect(result.sql).toContain('"weird""column"'); // Postgres escape for double quote is ""
    });
  });

  describe('Type Strictness', () => {
    it('should throw on type mismatch (number for string field)', () => {
      expect(() => compiler.compile({
        '==': [{ var: 'strField' }, 123]
      })).toThrow(SchemaValidationError);
    });

    it('should throw on type mismatch (string for number field)', () => {
      expect(() => compiler.compile({
        '==': [{ var: 'numField' }, "123"]
      })).toThrow(SchemaValidationError);
    });

    it('should validate all items in IN array', () => {
       expect(() => compiler.compile({
         'in': [{ var: 'strField' }, ['a', 'b', 123]] // 123 is invalid
       })).toThrow(SchemaValidationError);
    });
  });

  describe('Null Handling', () => {
    it('should rewrite == null to IS NULL', () => {
      const result = compiler.compile({ '==': [{ var: 'strField' }, null] });
      expect(result.sql).toBe('"strField" IS NULL');
    });

    it('should rewrite != null to IS NOT NULL', () => {
      // JSON Logic != mapping to 'ne'
      const result = compiler.compile({ '!=': [{ var: 'strField' }, null] });
      expect(result.sql).toBe('"strField" IS NOT NULL');
    });
  });

  describe('Sanitization', () => {
    it('should strip dangerous keys from input rule', () => {
       const dangerousRule = {
         and: [
           { '==': [{ var: 'strField' }, 'val'] },
           { '__proto__': { 'polluted': true } }
         ]
       };
       // Compiler should ignore/strip the bad key
       // Actually compiler expects specific structure, so pure stripping might leave empty object which throws 'Invalid rule'
       // But sanitizeInput recursive stripping should act before validation
       
       // The compiler iterates over keys. If __proto__ key is removed, the object is empty.
       // So we expect "Invalid rule: empty object" inside the logical AND array
       // which wraps the error.
       expect(() => compiler.compile(dangerousRule as any)).toThrow(CompilerError);
    });
  });

  describe('Date Validation', () => {
     it('should throw SchemaValidationError for invalid date string', () => {
        expect(() => compiler.compile({
          '==': [{ var: 'dateField' }, 'invalid-date-string']
        })).toThrow(SchemaValidationError);
     });
  });

  describe('Security & Injection', () => {
    it('should parameterize values preventing SQL Injection', () => {
       const malicious = "' OR 1=1 --";
       const result = compiler.compile({ '==': [{ var: 'strField' }, malicious] });
       // Should be literally $1, not inline
       expect(result.sql).toBe('"strField" = $1');
       expect(result.params['p1']).toBe(malicious);
    });

    it('should throw on Null Byte in string value', () => {
       const malicious = "bad\u0000str";
       expect(() => compiler.compile({ '==': [{ var: 'strField' }, malicious] }))
         .toThrow('Parameter value contains null byte');
    });

    it('should quote reserved keywords used as field names', () => {
       // Need a schema with reserved word
       const reservedConfig: CompilerConfig = {
         schema: {
            fields: {
               "select": { type: 'string', operators: ['eq'] }
            }
         },
         dialect: 'postgresql'
       };
       const reservedCompiler = new JsonLogicCompiler(reservedConfig);
       const result = reservedCompiler.compile({ '==': [{ var: 'select' }, 'val'] });
       expect(result.sql).toBe('"select" = $1');
    });
  });
});
