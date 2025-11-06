// Minimal mock for mssql used in tests when actual mssql is not installed.
// Exports an object that satisfies common import usage in the codebase.
export default {
  ConnectionPool: class {
    constructor() {}
    connect() {
      return Promise.resolve(this);
    }
    close() {
      return Promise.resolve();
    }
  },
  Request: class {
    constructor() {}
    query() {
      return Promise.resolve({ recordset: [] });
    }
  },
};
