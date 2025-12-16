import { Dialect } from './type';
import { PostgresDialect } from './postgresql';
import { MysqlDialect } from './mysql';
import { MssqlDialect } from './mssql';
import { SqliteDialect } from './sqlite';

export function createDialect(name?: string): Dialect {
  switch (name) {
    case 'mysql':
      return new MysqlDialect();
    case 'mssql':
      return new MssqlDialect();
    case 'sqlite':
      return new SqliteDialect();
    case 'postgresql':
    default:
      return new PostgresDialect();
  }
}
