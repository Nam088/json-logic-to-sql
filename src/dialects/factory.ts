import { Dialect, PlaceholderStyle } from './type';
import { PostgresDialect } from './postgresql';
import { MysqlDialect } from './mysql';
import { MssqlDialect } from './mssql';
import { SqliteDialect } from './sqlite';

export interface CreateDialectOptions {
  name?: string;
  placeholderStyle?: PlaceholderStyle;
}

export function createDialect(nameOrOptions?: string | CreateDialectOptions): Dialect {
  const options: CreateDialectOptions = typeof nameOrOptions === 'string' 
    ? { name: nameOrOptions } 
    : nameOrOptions ?? {};

  let dialect: Dialect;

  switch (options.name) {
    case 'mysql':
      dialect = new MysqlDialect();
      break;
    case 'mssql':
      dialect = new MssqlDialect();
      break;
    case 'sqlite':
      dialect = new SqliteDialect();
      break;
    case 'postgresql':
    default:
      dialect = new PostgresDialect();
      break;
  }

  // Only override placeholder style if explicitly provided
  if (options.placeholderStyle) {
    dialect.setPlaceholderStyle(options.placeholderStyle);
  }

  return dialect;
}
