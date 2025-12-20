import { JsonLogicCompiler } from '../compiler';
import { CompilerConfig } from '../types';

describe('Strict Contains Behavior', () => {
  const config: CompilerConfig = {
    schema: {
      fields: {
        tags: { type: 'array', title: 'Tags', inputType: 'multiselect', operators: ['contains'] },
      },
      settings: {
        defaultOperator: 'eq',
      },
    },
    dialect: 'postgresql',
  };

  const compiler = new JsonLogicCompiler(config);

  it('should throw error when contains is used with non-array value for array field', () => {
    const rule = {
      contains: [{ var: 'tags' }, 'single_value']
    };

    expect(() => compiler.compile(rule)).toThrow(
      /Expected array for field: tags/
    );
  });

  it('should throw specific error for JSONB array field with scalar value', () => {
    const configJsonb: CompilerConfig = {
      schema: {
        fields: {
          data: { type: 'jsonb', title: 'Data', inputType: 'json', operators: ['contains'] },
        },
      },
      dialect: 'postgresql',
    };
    const compilerJsonb = new JsonLogicCompiler(configJsonb);
    
    const rule = {
      contains: [{ var: 'data' }, 'scalar']
    };

    expect(() => compilerJsonb.compile(rule)).toThrow(
      "Operator 'contains' on array field 'data' requires an array value"
    );
  });

  it('should compile successfully when contains is used with array value', () => {
    const rule = {
      contains: [{ var: 'tags' }, ['value1', 'value2']]
    };

    const result = compiler.compile(rule);
    expect(result.sql).toContain('@>');
  });
});
