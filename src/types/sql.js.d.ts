declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export type SqlValue = string | number | Uint8Array | null;

  export interface ParamsObject {
    [key: string]: SqlValue;
  }

  export interface ParamsCallback {
    (obj: ParamsObject): void;
  }

  export class Statement {
    bind(params?: SqlValue[] | ParamsObject): boolean;
    step(): boolean;
    getColumnNames(): string[];
    get(params?: SqlValue[] | ParamsObject): SqlValue[];
    getAsObject(params?: SqlValue[] | ParamsObject): ParamsObject;
    run(params?: SqlValue[] | ParamsObject): void;
    reset(): void;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: SqlValue[] | ParamsObject): Database;
    exec(sql: string, params?: SqlValue[] | ParamsObject): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
