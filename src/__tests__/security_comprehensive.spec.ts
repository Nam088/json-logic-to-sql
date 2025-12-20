import { JsonLogicCompiler } from '../compiler';
import { CompilerConfig } from '../types';
import { SchemaValidationError, CompilerError } from '../compiler';

describe('Comprehensive Security Suite', () => {
  const config: CompilerConfig = {
    schema: {
      fields: {
        strField: { type: 'string', title: 'String Field', inputType: 'text', operators: ['eq', 'like', 'in'], nullable: true },
        numField: { type: 'number', title: 'Number Field', inputType: 'number', operators: ['eq', 'gt', 'lt'] },
        tags: { type: 'array', title: 'Tags', inputType: 'multiselect', operators: ['contains'] },
        meta: { type: 'jsonb', title: 'Meta', inputType: 'json', operators: ['eq'] }
      },
      settings: {
        maxDepth: 5,
        maxConditions: 100,
      },
    },
    dialect: 'postgresql',
  };

  const compiler = new JsonLogicCompiler(config);

  describe('Injection Attacks', () => {
    it('should reject operator injection attempts', () => {
      const maliciousRule = {
        "'; DROP TABLE users; --": [{ var: "strField" }, "val"]
      };
      expect(() => compiler.compile(maliciousRule as any)).toThrow(/Unknown operator|Invalid rule/);
    });

    it('should reject SQL-like strings in values (Parameterization Check)', () => {
       const malicious = "' OR 1=1; DROP TABLE users; --";
       const result = compiler.compile({ 'eq': [{ var: 'strField' }, malicious] });
       expect(result.sql).toBe('"strField" = $1');
       expect(result.params['p1']).toBe(malicious);
    });

    it('should reject identifiers containing SQL comments/commands', () => {
      const maliciousConfig: CompilerConfig = {
        schema: {
           fields: {
             badCol: {
               type: 'string',
               title: 'Bad Column',
               inputType: 'text',
               operators: ['eq'],
               column: 'user_data; DROP TABLE users; --'
             }
           }
        },
        dialect: 'postgresql'
      };
      const badCompiler = new JsonLogicCompiler(maliciousConfig);
      const result = badCompiler.compile({ 'eq': [{ var: 'badCol' }, 'val'] });
      expect(result.sql).toContain('"user_data; DROP TABLE users; --"');
    });
  });

  describe('Prototype Pollution & Object Integrity', () => {
    it('should strip __proto__ keys', () => {
       const payload = JSON.parse('{"and": [{"eq": [{"var": "strField"}, "v"]}, {"__proto__": {"x": 1}}]}');
       expect(() => compiler.compile(payload)).toThrow(/Invalid rule: empty object/);
    });
  });

  describe('Denial of Service (DoS) Vectors', () => {
     it('should handle large array inputs within limits', () => {
        const largeArray = Array.from({ length: 1000 }, (_, i) => `val${i}`);
        const start = performance.now();
        const result = compiler.compile({ 'in': [{ var: 'strField' }, largeArray] });
        const end = performance.now();
        
        expect(result.sql).toContain('IN ($1, $2,');
        expect(Object.keys(result.params).length).toBe(1000);
        expect(end - start).toBeLessThan(100); 
     });

     it('should enforce max conditions limit to prevent query complexity DoS', () => {
        const manyConditions = {
           and: Array.from({ length: 150 }, () => ({ 'eq': [{ var: 'strField' }, 'v'] }))
        };
        expect(() => compiler.compile(manyConditions as any)).toThrow(/Maximum condition count exceeded/);
     });
  });

  describe('Type Confusion & Bypass', () => {
     it('should strictly validate types in array arrays (Mixed Types)', () => {
        const rule = { 'in': [{ var: 'numField' }, [1, 2, "3", 4]] };
        expect(() => compiler.compile(rule)).toThrow(SchemaValidationError);
     });

     it('should not allow array masquerading as string', () => {
        const rule = { 'eq': [{ var: 'strField' }, ['a']] };
        expect(() => compiler.compile(rule as any)).toThrow(SchemaValidationError);
     });
  });

  describe('Infinite Loop / Circular Reference', () => {
    it('should detect and reject circular references', () => {
       const circular: any = { 'and': [] };
       circular.and.push(circular); // Circular reference
       expect(() => compiler.compile(circular)).toThrow(/Circular reference detected/);
    });

    it('should allow shared references (DAG) that are NOT circular', () => {
       const sharedCondition = { 'eq': [{ var: 'strField' }, 'shared'] };
       const dag = {
         'and': [
           sharedCondition,
           sharedCondition 
         ]
       };
       expect(() => compiler.compile(dag)).not.toThrow();
    });
  });

  describe('False Positives (Aggressive Sanitization)', () => {
    it('should NOT strip "constructor" key from valid data values', () => {
       const validRule = { 
         'eq': [
           { var: 'meta' }, 
           JSON.parse('{"constructor": "Lego"}')
         ] 
       };
       const result = compiler.compile(validRule as any);
       expect(result.params['p1']).toEqual({ 'constructor': 'Lego' });
    });
    it('should NOT allow modifications to Global Object Prototype via constructor', () => {
       // ATTACK VECTOR: Try to modify Object.prototype using constructor key
       const maliciousPayload = JSON.parse('{"constructor": {"prototype": {"POLLUTED": true}}}');
       
       // Run the compiler (which calls sanitizer)
       // This is valid data structure, so it might compile or fail schema validation depending on usage,
       // but strictly speaking we just want to ensure global state is safe.
       try {
         compiler.compile({ 'eq': [{ var: 'meta' }, maliciousPayload] });
       } catch (e) {
         // It might fail validation, that's fine.
       }
       
       // VERIFICATION: Check if the global Object prototype was polluted
       const testObject: any = {};
       expect(testObject['POLLUTED']).toBeUndefined();
       expect((Object.prototype as any)['POLLUTED']).toBeUndefined();
    });
  });
});

