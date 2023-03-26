// ORM, CRUD, and migration utilities for the database (library-level; excludes domain-specific code)
// We've chosen to standardize tables to an RDF quad approach: Subject, Object, NamedGraph (provenance) [with Predicate as part of the table metadata]
// A Timestamp column also aids with sync. And deleted records can be retained (to allow sync of deletions also) by modifying the 
// Timestamp from e.g. '2023-03-26 14:04:40.000' to '-2023-03-26 14:04:40.000'.
// And we use a TEXT data type for timestamps (partly to allow for this trick, but under the hood it'd get stored as TEXT anyway)
// These tricks around Predicate and Timestamp allow us to get by with a minimum of indexes and a maximum standardization (code reuse).
// Tables use the ROWID approach with REPLACE INTO instead of fussing with auto-increment primary keys (sqlite.org/autoinc.html)

var DBORM = {
  
  // sqlite.org/datatype3.html
  getSqliteDataType: function(dataType) {
    switch(dataType) {
      case DATATYPES.FLOAT:
        return 'REAL';
      case DATATYPES.INTEGER:
      case DATATYPES.BOOLEAN:
        return 'INTEGER';
      deault:
        return 'TEXT';
    }
  },
  
  getDb: function(withStartupLogging) {
    const capi = _sqlite3.capi; /*C-style API*/
    const oo = _sqlite3.oo1; /*high-level OO API*/
    // DBORM.LOGGING.log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
    
    let db;
    let opfsOk;
    if (_sqlite3.opfs) {
      db = new _sqlite3.opfs.OpfsDb('/mydb.sqlite3');
      db.exec(`PRAGMA 'journal_mode=WAL';`);
      opfsOk = true;
    } else {
      db = new oo.DB('/mydb.sqlite3', 'ct');
      opfsOk = false;
    }
    
    if (withStartupLogging === true) {
      DBORM.LOGGING.reportAppVersion( {libVersion: capi.sqlite3_libversion(), sourceId: capi.sqlite3_sourceid(), opfsOk: opfsOk } );
    }
    
    return db;
  },
  
  MIGRATION: {
    
    getDbScriptVersion: function(db) {
      const sql = `SELECT * FROM Migration WHERE AppName = '${APPNAME}';`;
      let version = 0;
      
      db.exec({
        sql: sql,
        rowMode: 'object',
        callback: function (row) { version = row.Version; }
      });
      
      return version;
    },
    
    // table 'Migration' holds last-run migration script number
    ensureMigrationPrereqs: function(db) {
      let initSql = `CREATE TABLE IF NOT EXISTS Migration(AppName TEXT NOT NULL, Version int, UNIQUE(AppName));
        INSERT INTO Migration(AppName, Version) SELECT '${APPNAME}', 0 WHERE NOT EXISTS ( SELECT ROWID FROM Migration );
        UPDATE Migration SET Version = 1 WHERE AppName = '${APPNAME}' AND Version = 0;
        `;
      
      db.exec(initSql);
    },
    
    writeUpdateMigrationVersionSql: function(scriptNumber) {
      return `UPDATE Migration SET Version = ${scriptNumber} WHERE AppName = '${APPNAME}'`;
    },
    
    // RdfImport1to1 and RdfImport1ton
    ensureImportTables: function(db, scriptNumber) {
      const versionSql = DBORM.MIGRATION.writeUpdateMigrationVersionSql(scriptNumber);
      
      const sql = `
        /* An import table for Rdf data that can be cleared out based on old ImportTime and processed by batch Guid */
        /* A 1-to-1 import table has one object per subject (example: display name)); note the uniqueness */
        CREATE TABLE IF NOT EXISTS RdfImport1to1(
        BatchUid uniqueidentifier,
        ImportTime TEXT,
        RdfSubject TEXT NOT NULL,
        RdfObject TEXT,
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} TEXT NOT NULL,
        UNIQUE(BatchUid, RdfSubject, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}));
        
        CREATE INDEX IF NOT EXISTS IX_RdfImport1to1_BatchUid ON RdfImport1to1(BatchUid);
        CREATE INDEX IF NOT EXISTS IX_RdfImport1to1_ImportTime ON RdfImport1to1(ImportTime);


        /* A 1-to-n import table has 'n' objects per subject (example: followers); note the uniqueness */
        CREATE TABLE IF NOT EXISTS RdfImport1ton(
        BatchUid uniqueidentifier,
        ImportTime TEXT,
        RdfSubject TEXT NOT NULL,
        RdfObject TEXT,
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} TEXT NOT NULL,
        UNIQUE(BatchUid, RdfSubject, RdfObject, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}));
        
        CREATE INDEX IF NOT EXISTS IX_RdfImport1ton_BatchUid ON RdfImport1ton(BatchUid);
        CREATE INDEX IF NOT EXISTS IX_RdfImport1ton_ImportTime ON RdfImport1ton(ImportTime);     
      
      
      ${versionSql}
      `;
      
      db.exec(sql);
    },
    
    // entity is an object from APPSCHEMA
    writeEnsureEntityTableSql: function(entity) {
      
      const oDataType = DBORM.getSqliteDataType(entity.ObjectType);
      // if OneToOne (really one or none), then it's nullable
      const oNullability = entity.OneToOne === true ? '' : 'NOT NULL';
      const oColType = STR.appendSpaced(oDataType, oNullability);
      
      let ux = '';
      if (entity.OneToOne === true) {
        // one or none uniqueness needs to be via subject only (with graph)
        ux = `UNIQUE(${entity.SubjectCol}, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph})`;
      }
      else {
        // one-to-many uniqueness requires the object value
        ux = `UNIQUE(${entity.SubjectCol}, ${entity.ObjectCol}, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph})`;
      }
      
      return `
        CREATE TABLE IF NOT EXISTS ${entity.Name}(
        ${entity.SubjectCol} TEXT NOT NULL,
        ${entity.ObjectCol} ${oColType},
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} TEXT NOT NULL,
        ${SCHEMA_CONSTANTS.COLUMNS.Timestamp} TEXT,
        ${ux});
        
        CREATE INDEX IF NOT EXISTS IX_${entity.Name}_osg ON ${entity.Name}(${entity.ObjectCol}, ${entity.SubjectCol}, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph});
        CREATE INDEX IF NOT EXISTS IX_${entity.Name}_${SCHEMA_CONSTANTS.COLUMNS.Timestamp} ON ${entity.Name}(${SCHEMA_CONSTANTS.COLUMNS.Timestamp});
      `;
    },
    
    // an easy approach for "regular" numbered scripts that simply insert entities
    // (as opposed to one-off scripts needed to address specific issues)
    ensureEntityTables: function(db, entities, scriptNumber) {
      let sql = '';
      
      for (let i = 0; i < entities.length; i++) {
        let scriptSql = DBORM.MIGRATION.writeEnsureEntityTableSql(entities[i]);
        sql = `${sql}\n\n\n${scriptSql}`;
      }
      
      const versionSql = DBORM.MIGRATION.writeUpdateMigrationVersionSql(scriptNumber);
      sql = `${sql}\n\n\n${versionSql}`;
      
      db.exec(sql);
    }
    
  },
  
  LOGGING: {

    // legacy logging (also used for logging catastrophic sqlite errors; ugly)
    logHtml: function(cssClass, ...args) {
      postMessage({ type: MSGTYPE.FROMDB.LOG.LEGACY, payload: { cssClass, args } });
    },
    log: function(...args) {
      logHtml('', ...args);
    },
    warn: function(...args) {
      logHtml('warning', ...args);
    },
    error: function(...args) {
      logHtml('error', ...args);
    },
    
    // specific logging
    reportAppVersion: function(versionInfo) {
      postMessage({ type: MSGTYPE.FROMDB.LOG.SQLITE_VERSION, payload: versionInfo });
    }
  }
};
