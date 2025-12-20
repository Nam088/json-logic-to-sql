# Examples

This folder contains example projects demonstrating how to use `@nam088/json-logic-to-sql`.

## Prerequisites

Make sure the package is published to npm:

```bash
npm publish --access public
```

## Available Examples

### 1. Basic Usage (JavaScript/ESM)

Location: `examples/basic-usage/`

Simple JavaScript examples covering:
- Simple equality queries
- AND/OR conditions
- Complex nested queries
- String operations (LIKE, ILIKE)
- BETWEEN operator
- Multi-dialect support
- Validation errors
- Full query examples

**Run:**

```bash
cd examples/basic-usage
npm install
npm start
```

### 2. Advanced TypeScript

Location: `examples/advanced-typescript/`

Advanced TypeScript examples covering:
- Computed fields
- Field transformations
- Complete query builder (SELECT, WHERE, ORDER BY, LIMIT/OFFSET)
- Schema mapping (public/internal separation)
- Multi-dialect comparison
- Type-safe error handling
- Complex real-world queries

**Run:**

```bash
cd examples/advanced-typescript
npm install
npm start
```

## Testing Locally (Before Publishing)

If you want to test the examples before publishing to npm, you can use `npm link`:

```bash
# In the root of json-logic-to-sql
npm run build
npm link

# In each example folder
cd examples/basic-usage
npm link @nam088/json-logic-to-sql
npm start

cd ../advanced-typescript
npm link @nam088/json-logic-to-sql
npm start
```

## Expected Output

Both examples will output:
- Compiled SQL queries
- Parameter values
- Validation errors (where applicable)
- Full query examples

The output is formatted with separators for easy reading.

## Learn More

- [Main README](../README.md)
- [npm package](https://www.npmjs.com/package/@nam088/json-logic-to-sql)
- [JSON Logic Documentation](http://jsonlogic.com/)


