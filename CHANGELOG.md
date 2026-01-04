# [1.11.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.10.0...v1.11.0) (2026-01-04)


### Features

* Implement and test compilation of array operators like `in`, `not_in`, and `any_of` for PostgreSQL array and jsonb field types. ([c11deb4](https://github.com/Nam088/json-logic-to-sql/commit/c11deb44fefc6aeb239e16a7d598ea4b43bff34d))

# [1.10.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.9.0...v1.10.0) (2025-12-27)


### Features

* add schema filtering utilities and distinguish public from internal field schema properties ([9e19ab1](https://github.com/Nam088/json-logic-to-sql/commit/9e19ab1d57f40230f524a0797aec41c098151843))

# [1.9.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.8.0...v1.9.0) (2025-12-20)


### Features

* Add `not_any_ilike` operator and update `any_ilike` handling to support its negation. ([ca5abfe](https://github.com/Nam088/json-logic-to-sql/commit/ca5abfe0ad805cf4728272942280ae564d37c83e))

# [1.8.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.7.0...v1.8.0) (2025-12-20)


### Features

* Add `title` and `inputType` to schema fields and introduce `any_ilike` operator. ([019ae74](https://github.com/Nam088/json-logic-to-sql/commit/019ae74cd3d1462d0f306fe8de8c82dc650b1f7e))

# [1.7.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.6.0...v1.7.0) (2025-12-17)


### Features

* add support for range operators in SchemaValidator and enhance JsonLogicCompiler for array handling ([bc07d3f](https://github.com/Nam088/json-logic-to-sql/commit/bc07d3f4429d1ff6445ca43f868866a0bca27068))

# [1.6.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.5.0...v1.6.0) (2025-12-17)


### Features

* enhance JsonLogicCompiler and PostgresDialect with improved transform handling and dialect-specific support ([7e86d76](https://github.com/Nam088/json-logic-to-sql/commit/7e86d762d2659fe015b7a018cb1b40ed7039b1f2))

# [1.5.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.4.0...v1.5.0) (2025-12-17)


### Features

* enhance JsonLogicCompiler and PostgresDialect for conditional JSONB casting and parameter handling ([5775e9d](https://github.com/Nam088/json-logic-to-sql/commit/5775e9d60fdf7b71bf4605746787434e7867ef0a))

# [1.4.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.3.0...v1.4.0) (2025-12-17)


### Features

* implement unique parameter keys for SQL dialects to enhance parameter handling ([8ebdabf](https://github.com/Nam088/json-logic-to-sql/commit/8ebdabfc8c6b1f988e41c5ce72d8241f562bb239))

# [1.3.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.2.0...v1.3.0) (2025-12-17)


### Features

* add support for customizable SQL parameter placeholder styles in pagination utility ([7cff33b](https://github.com/Nam088/json-logic-to-sql/commit/7cff33bea122c14ff7f8c916f3e9094d9e06ca42))

# [1.2.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.1.0...v1.2.0) (2025-12-17)


### Features

* enhance JsonLogicCompiler with parameter placeholder style support and add paramsToArray utility for ordered parameter handling ([9d7fa15](https://github.com/Nam088/json-logic-to-sql/commit/9d7fa15e755d84cb10e331652d5c3fa24f81ebec))

# [1.1.0](https://github.com/Nam088/json-logic-to-sql/compare/v1.0.2...v1.1.0) (2025-12-16)


### Features

* Re-architect operator handling into dialects, enhance security, and improve null and array operator behavior. ([7303f51](https://github.com/Nam088/json-logic-to-sql/commit/7303f51586f090e76a8abbb9b1431b6f3c30ed95))

## [1.0.2](https://github.com/Nam088/json-logic-to-sql/compare/v1.0.1...v1.0.2) (2025-12-16)


### Bug Fixes

* update repository url to match provenance ([205d4b6](https://github.com/Nam088/json-logic-to-sql/commit/205d4b6bad245bdb949d91d8fcfbc87cd167cd19))

## [1.0.1](https://github.com/nam088/json-logic-to-sql/compare/v1.0.0...v1.0.1) (2025-12-16)


### Bug Fixes

* remove broken lint script ([d490060](https://github.com/nam088/json-logic-to-sql/commit/d4900600c6e51e9043b41e6f9e3c60f784975328))
