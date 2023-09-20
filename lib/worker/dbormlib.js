// ORM, CRUD, and migration utilities for the database (library-level; excludes domain-specific code)
// We've chosen to standardize tables to an RDF quad approach: Subject, Object, NamedGraph (provenance) [with Predicate as part of the table metadata]
// A Timestamp column also aids with sync. And deleted records can be retained (to allow sync of deletions also) by modifying the 
// Timestamp from e.g. '2023-03-26 14:04:40.000' to '-2023-03-26 14:04:40.000'.
// And we use a TEXT data type for timestamps (partly to allow for this trick, but under the hood it'd get stored as TEXT anyway)
// These tricks around Predicate and Timestamp allow us to get by with a minimum of indexes and a maximum standardization (code reuse).
// Tables use the ROWID approach with REPLACE INTO instead of fussing with auto-increment primary keys (sqlite.org/autoinc.html)

// db
var _sqlite3;

var _dbBusyReads = 0;
var _dbBusyWrites = 0;

// importSync
var _importSyncQueue = new Queue();
var _processingImportSync = false;

var DBORM = {
  
  getDb: function(withStartupLogging) {
    const capi = _sqlite3.capi; /*C-style API*/
    const oo = _sqlite3.oo1; /*high-level OO API*/
    // DBORM.LOGGING.log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
    
    let db;
    let opfsOk;
    if (_sqlite3.opfs) {
      db = new _sqlite3.oo1.OpfsDb('/mydb.sqlite3');
      DBORM.dbExec(db, `PRAGMA 'journal_mode=WAL';`, false);
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

  // sqlite.org/datatype3.html
  getSqliteDataType: function(dataType) {
    switch(dataType) {
      case DATATYPES.FLOAT:
        return 'REAL';
      case DATATYPES.INTEGER:
      case DATATYPES.BOOLEAN:
        return 'INTEGER';
      default:
        return 'TEXT';
    }
  },
  
  // see comments at top of file
  getNowTime: function(negated = false) {
    let sql = `datetime('now')`;
    
    if (negated) {
      // prepend a negation symbol (by convention)
      sql = `'-' || ${sql}`;
    }
    
    return sql;
  },
  
  dbExec: function(db, args, writing) {
    
    // we're not really using a lock; this is mostly for diganostics

    let reads = _dbBusyReads;
    let writes = _dbBusyWrites;

    if (writing) {
      writes++;
    }
    else {
      reads++;
    }

    let msg = `(${reads} reads / ${writes} writes)`;

    if (writing && _dbBusyWrites > 0) {
      console.warn(`DB write contention! ${msg}`);
    }
    else if (writing && _dbBusyReads > 0) {
      console.log(`DB write request while currently reading! ${msg}`);
    }
    else if (!writing && _dbBusyWrites > 0) {
      console.log(`DB read request while already writing! ${msg}`);
    }
    else if (!writing && _dbBusyReads > 0) {
      console.log(`Concurrent DB read requests ${msg}`);
    }
    
    if (writing) {
      _dbBusyWrites++;
    }
    else {
      _dbBusyReads++;
    }

    try {
      db.exec(args);
    }
    finally {
      if (writing) {
        
        if (_dbBusyWrites > 0) {
          _dbBusyWrites--;
        }
      }
      else if (_dbBusyReads > 0) {
        _dbBusyReads--;
      }
    }
  },

  start: function(scripts) {
    let db = DBORM.getDb(true);
    
    try {
      DBORM.MIGRATION.migrateDbAsNeeded(db, scripts);
      // on startup is a good chance to ensure that import tables haven't gotten huge
      // (and we know we made the import tables, since we have a numbered script for them)
      DBORM.SAVING.truncateBulkImport(db, true);
      DBORM.SAVING.truncateBulkImport(db, false);
    } 
    finally {
      db.close();
    }
  },
  
  MIGRATION: {
    
    // just to centralize
    newScript(sql, number) {
      return {sql: sql, number: number};
    },
    
    // pass in ordered scripts
    // each script is {number: #, sql: '..sql...'}
    migrateDbAsNeeded: function(db, scripts) {
      
      DBORM.MIGRATION.ensureMigrationPrereqs(db, APPNAME);
      
      // do migration
      let dbVersion = 0;
      
      if (scripts && scripts.length > 0) {
        let codeVersion = DBORM.MIGRATION.getMaxScriptNumber(scripts);
        for (let i = 0; i < codeVersion; i++) {
          dbVersion = DBORM.MIGRATION.getDbScriptVersion(db, APPNAME);
          if (dbVersion < codeVersion) {
            // find the next script
            let script = scripts.find(function(s) { return s.number === dbVersion + 1; });
            DBORM.dbExec(db, script.sql, true);
          }
        }
      }

      // report status
      dbVersion = DBORM.MIGRATION.getDbScriptVersion(db, APPNAME);
      postMessage({ type: MSGTYPE.FROMDB.LOG.DB_SCRIPT_VERSION, payload: {version: dbVersion} });

      // diagnostics: fyi, this is a good place to run arbitrary sql while debugging to understand the DB
      //const debugRows = DBORM.QUERYING.fetch(`SELECT name FROM sqlite_schema WHERE type = 'table' and name not like 'sqlite_%';`, []);
      // const debugRows = DBORM.QUERYING.fetch(`SELECT * FROM Migration;`, []);
      
      // let debugRows = DBORM.QUERYING.fetch(`SELECT * FROM SocialPostThreadUrlKey WHERE oValue LIKE '%/history%';`, []);
      // console.log(debugRows);
      // let debugRows = DBORM.QUERYING.fetch(`SELECT * FROM SocialPostRegImgBinary;`, []);
      // console.log(debugRows);
    },
    
    getMaxScriptNumber: function(scripts) {
      return Math.max(...Array.from(scripts.map(function(script) { return script.number; })));
    },
    
    getDbScriptVersion: function(db, appName = APPNAME) {
      const sql = `SELECT * FROM Migration WHERE AppName = '${appName}';`;
      let version = 0;
      
      DBORM.dbExec(db, {
        sql: sql,
        rowMode: 'object',
        callback: function (row) { version = row.Version; }
      }, false);
      
      return version;
    },
    
    // table 'Migration' holds last-run migration script number
    ensureMigrationPrereqs: function(db, appName = APPNAME) {
      let initSql = `CREATE TABLE IF NOT EXISTS Migration(AppName TEXT NOT NULL, Version int, UNIQUE(AppName));
        INSERT INTO Migration(AppName, Version) SELECT '${appName}', 0 WHERE NOT EXISTS ( SELECT ROWID FROM Migration );
        UPDATE Migration SET Version = 1 WHERE AppName = '${appName}' AND Version = 0;
        `;
      
      DBORM.dbExec(db, initSql, true);
    },
    
    writeUpdateMigrationVersionSql: function(scriptNumber, appName = APPNAME) {
      return `UPDATE Migration SET Version = ${scriptNumber} WHERE AppName = '${appName}';`;
    },
    
    // RdfImport1to1 and RdfImport1ton
    // includes update of Migration.Version
    writeEnsureImportTablesScript: function(scriptNumber, appName = APPNAME, dropFirst) {
      const versionSql = DBORM.MIGRATION.writeUpdateMigrationVersionSql(scriptNumber, appName);
      
      let dropFirstSql = '';
      if (dropFirst === true) {
        dropFirstSql = `
        DROP TABLE RdfImport1to1;
        DROP TABLE RdfImport1ton;
        `;
      }

      const sql = `
        ${dropFirstSql}

        /* An import table for Rdf data that can be cleared out based on old ImportTime and processed by batch Guid */
        /* A 1-to-1 import table has one object per subject (example: display name)); note the uniqueness */
        CREATE TABLE IF NOT EXISTS RdfImport1to1(
        BatchUid uniqueidentifier,
        ImportTime TEXT COLLATE NOCASE,
        RdfSubject TEXT NOT NULL COLLATE NOCASE,
        RdfObject TEXT COLLATE NOCASE,
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} TEXT NOT NULL COLLATE NOCASE,
        UNIQUE(BatchUid, RdfSubject, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}));
        
        CREATE INDEX IF NOT EXISTS IX_RdfImport1to1_BatchUid ON RdfImport1to1(BatchUid);
        CREATE INDEX IF NOT EXISTS IX_RdfImport1to1_ImportTime ON RdfImport1to1(ImportTime);


        /* A 1-to-n import table has 'n' objects per subject (example: followers); note the uniqueness */
        CREATE TABLE IF NOT EXISTS RdfImport1ton(
        BatchUid uniqueidentifier,
        ImportTime TEXT COLLATE NOCASE,
        RdfSubject TEXT NOT NULL COLLATE NOCASE,
        RdfObject TEXT COLLATE NOCASE,
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} TEXT NOT NULL COLLATE NOCASE,
        UNIQUE(BatchUid, RdfSubject, RdfObject, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}));
        
        CREATE INDEX IF NOT EXISTS IX_RdfImport1ton_BatchUid ON RdfImport1ton(BatchUid);
        CREATE INDEX IF NOT EXISTS IX_RdfImport1ton_ImportTime ON RdfImport1ton(ImportTime);     
      
      
      ${versionSql}
      `;
      
      return DBORM.MIGRATION.newScript(sql, scriptNumber);
    },
    
    // entity is an object from APPSCHEMA
    writeEnsureEntityTableSql: function(entity) {
      
      const oDataType = DBORM.getSqliteDataType(entity.ObjectType);
      // if OneToOne (really one or none), then it's nullable
      const oNullability = entity.OneToOne === true ? '' : 'NOT NULL';
      const oColType = STR.appendSpaced(oDataType, oNullability);
      let oCollation = (oDataType.toUpperCase() == 'TEXT') ? ' COLLATE NOCASE' : '';
      
      let ux = '';
      if (entity.OneToOne === true) {
        // one or none uniqueness needs to be via subject only (with graph)
        ux = `UNIQUE(${entity.SubjectCol}, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph})`;
      }
      else {
        // one-to-many uniqueness requires the object value
        ux = `UNIQUE(${entity.SubjectCol}, ${entity.ObjectCol}, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph})`;
      }
      
      const osgIndex = DBORM.MIGRATION.writeOsgIndex(entity);

      return `
        CREATE TABLE IF NOT EXISTS ${entity.Name}(
        ${entity.SubjectCol} TEXT NOT NULL COLLATE NOCASE,
        ${entity.ObjectCol} ${oColType}${oCollation},
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} TEXT NOT NULL COLLATE NOCASE,
        ${SCHEMA_CONSTANTS.COLUMNS.Timestamp} TEXT COLLATE NOCASE,
        ${ux});
        
        ${osgIndex}
        CREATE INDEX IF NOT EXISTS IX_${entity.Name}_${SCHEMA_CONSTANTS.COLUMNS.Timestamp} ON ${entity.Name}(${SCHEMA_CONSTANTS.COLUMNS.Timestamp});
      `;
    },
    
    writeOsgIndex: function(entity) {
      switch (entity.dataType) {
        case DATATYPES.IMG_BINARY:
        case DATATYPES.IMG_SOURCE_URL:
          // no good reason to index the object
          return '';
        default:
          return `CREATE INDEX IF NOT EXISTS IX_${entity.Name}_osg ON ${entity.Name}(${entity.ObjectCol}, ${entity.SubjectCol}, ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph});`;
      }
    },

    // an easy approach for "regular" numbered scripts that simply insert entities
    // (as opposed to one-off scripts needed to address specific issues)
    // includes update of Migration.Version
    writeEnsureEntityTablesStep: function(entities, scriptNumber, appName = APPNAME) {
      let sql = '';
      
      for (let i = 0; i < entities.length; i++) {
        let scriptSql = DBORM.MIGRATION.writeEnsureEntityTableSql(entities[i], appName);
        sql = `${sql}\n\n\n${scriptSql}`;
      }
      
      const versionSql = DBORM.MIGRATION.writeUpdateMigrationVersionSql(scriptNumber, appName);
      sql = `${sql}\n\n\n${versionSql}`;
      
      return DBORM.MIGRATION.newScript(sql, scriptNumber);
    }
    
  },
  
  QUERYING: {
    
    isDeleted: function(prefix) {
      return `${prefix}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} LIKE '-%'`;
    },
    
    // see comment at top of file (2023-03-29 instead of -2023-03-29)
    existsAndNotDeleted: function(prefix) {
      return `${prefix}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} LIKE '202%'`;
    },

    fetch: function(sql, bound) {
      
      const db = DBORM.getDb();
      const rows = [];

      try {
        DBORM.dbExec(db, {
          sql: sql, 
          bind: bound,
          rowMode: 'object', 
          callback: function (row) {
              rows.push(row);
            }
          }, false);
      }
      finally {
        db.close();
      }

      return rows;
    },

    // from array of key/value pairs to a single object
    // needed for the named-argument approach 
    // (which we wanted b/c of multiple usages of a particular nth parameter in search)
    // sqlite.org/wasm/doc/trunk/api-oo1.md#stmt-bind
    bindConsol: function(bind) {
      const obj = {};
      for (let i = 0; i < bind.length; i++) {
        let parm = bind[i];
        obj[parm.key] = parm.value;
      }
      
      return obj;
    },

    // conjunction is WHERE or AND
    // returns { sql: sql, parms: bindThese }
    writeSearchClause: function(textCols, searchText, conjunction, parmCounter) {
      if (!searchText || searchText.length === 0 || searchText === '*') {
        return null;
      }
      
      const terms = searchText.split(' ');
      if (terms.length === 0) {
        return null;
      }
      
      const parms = [];
      // we'll check for a match of each keyword, appearing in at least one col
      let sql = '';
      let didOne = false;
      parmCounter = parmCounter || 0;
      for (let i = 0; i < terms.length; i++) {
        let term = terms[i];
        let plus = (didOne === true) ? ' +' : '';
        
        sql = `${sql}${plus} 
        CASE `;
        
        parmCounter++;
        let parm = {key: '$srch' + parmCounter, value: `%${term}%`};
        parms.push(parm);
        
        for (let c = 0; c < textCols.length; c++) {
          let col = textCols[c];
          
          sql = `${sql}
          WHEN ${col} LIKE ${parm.key} THEN 1`;
        }
        
        sql = `${sql}
          ELSE 0 
        END`;
        
        didOne = true;
      }
      
      // wrap in an outer case statement
      sql = `${conjunction} CASE 
      WHEN 
        ${sql} = ${terms.length} THEN 1
      ELSE 0
      END = 1`;
      
      const result = { sql: sql, parms: parms };
      return result;
    }
    
  },
  
  SAVING: {
    
    getImportTable: function(oneToOne) {
      return oneToOne === true ? 'RdfImport1to1' : 'RdfImport1ton';
    },
    
    truncateBulkImport: function(db, oneToOne) {
      const importTable = DBORM.SAVING.getImportTable(oneToOne);
      const sql = `DELETE FROM ${importTable};`;
      DBORM.dbExec(db, sql, true);
    },
    
    clearBulkImport: function(db, arr, oneToOne, uid) {
      if (!arr || arr.length === 0) { return; } // no work to do
      const importTable = DBORM.SAVING.getImportTable(oneToOne);
      
      const sql = `
      DELETE 
      FROM ${importTable}
      WHERE BatchUid LIKE '${uid}%';
      `;
      
      DBORM.dbExec(db, sql, true);
    },

    // in a sync scenario, "t" (timestamp) is also evident
    // and we want to respect it where available
    writeImportTime: function(sog) {
      // re stripPrefix, see comments at top of file for negation
      if (sog.t && STR.isValidIsoDate(STR.stripPrefix(sog.t, '-'))) {
        return `'${sog.t}'`;
      }
      else {
        return `datetime('now')`;
      }
    },

    // applies an actual deletion (not merely setting timestamp negative)
    execDeletion: function(db, entityDefn, sogs) {
      if (!sogs || sogs.length == 0) {
        // nothing to do
        return;
      }

      for (let i = 0; i < sogs.length; i++) {
        let sog = sogs[i];
        let bind = [];

        let sql = `
        DELETE FROM ${entityDefn.Name}
        WHERE ${entityDefn.SubjectCol} = ?
          AND ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = ?`;

        bind.push(sog.s);
        bind.push(sog.g);

        if (entityDefn.OneToOne == false) {
          sql = `${sql}
            AND ${entityDefn.ObjectCol} = ?`;

          bind.push(sog.o);
        }

        sql = `${sql};`;

        DBORM.dbExec(db, {sql: sql, bind: bind}, true);
      }
    },

    // we want a parameterized query with the speed of the "VALUES (...), (...), (...)" syntax
    // sqlite allows hard limit of 999 parms
    execBulkImport: function(db, oneToOne, uid, s, o, g, sogs) {
      if (!sogs || sogs.length == 0) {
        // nothing to do
        return;
      }
      
      // see how many ? parms per insert
      let qPer = 0;
      let bindS = false;
      let bindO = false;
      let bindG = false;
      if (s === '?') { 
        qPer++;
        bindS = true;
      }
      if (o === '?') { 
        qPer++;
        bindO = true;
      }
      if (g === '?') { 
        qPer++;
        bindG = true;
      }
      
      const maxParm = 999;
      const maxInsertsPerStep = 2000;  // bulk import of tons of values at once not worth it
      // suppose 1000 items with 2 parms... 3 batches
      // see how many batches we'll require
      const numBatches = qPer === 0 ? Math.ceil(sogs.length / maxInsertsPerStep) : Math.ceil((sogs.length * qPer) / maxParm);
      const perBatch = qPer === 0 ? maxInsertsPerStep : Math.floor(sogs.length / numBatches);
      let skip = 0;
      
      const importTable = DBORM.SAVING.getImportTable(oneToOne);
      
      const baseSql = `
      INSERT INTO ${importTable} ( BatchUid, ImportTime, RdfSubject, RdfObject, NamedGraph )
      VALUES `;
      
      for (let i = 0; i < numBatches; i++) {
        // let's process the next batch
        let batchSogs = sogs.slice(skip, skip + perBatch);
        let sql = baseSql;
        let bind = [];
        let didOne = false;
        
        for (let j = 0; j < batchSogs.length; j++) {
          let sog = batchSogs[j];
          let comma = didOne === true ? ', ' : '';
          let time = DBORM.SAVING.writeImportTime(sog);
          // we avoid worrying about already-exists (while batching) by appending the iteration number to the guid
          sql = `${sql}${comma}( '${uid}-${i}-${j}', ${time}, ${s}, ${o}, ${g} )`;
          
          // build up the bound parms
          if (bindS === true) {
            bind.push(sog.s);
          }
          if (bindO === true) {
            bind.push(sog.o);
          }
          if (bindG === true) {
            bind.push(sog.g);
          }
          
          didOne = true;
        }
        
        sql = `${sql};`
        // execute the batch
        DBORM.dbExec(db, {sql: sql, bind: bind}, true);
        
        // skip to the next page
        skip += perBatch;
      }
    },

    execUpsert: function(db, savableSet, subset, tbl, oneToOne, subjectCol, objectCol) {
      const arr = subset.sogs;
      const uid = subset.uid;
      const isComplete = subset[SUBSET_IS_COMPLETE];
      
      if (!arr || arr.length === 0) { return; } // no work to do
      const importTable = DBORM.SAVING.getImportTable(oneToOne);
      
      const timeCol = SCHEMA_CONSTANTS.COLUMNS.Timestamp;
      const graphCol = SCHEMA_CONSTANTS.COLUMNS.NamedGraph;

      let leftJoin = '';
      let timeCondition = '';
      
      if (savableSet.onlyIfNewer === true) {
        leftJoin = `LEFT JOIN ${tbl} ex ON`;
        // as in a sync context
        if (oneToOne === true) {
          leftJoin = `${leftJoin} i.RdfSubject = ex.${subjectCol} AND i.NamedGraph = ex.${graphCol}`;
        }
        else {
          leftJoin = `${leftJoin} i.RdfSubject = ex.${subjectCol} AND i.RdfObject = ex.${objectCol} AND i.NamedGraph = ex.${graphCol}`;
        }

        timeCondition = `AND 
        CASE 
          -- per comments at top of file, need to support negations (-2023-04-01...)
          WHEN ex.${timeCol} IS NULL THEN 1
          WHEN trim(ex.${timeCol},'-') < trim(i.ImportTime,'-') THEN 1
          ELSE 0
        END = 1
        `;
      }

      let clearStalesSql = '';
      if (isComplete == true && oneToOne == false) {
        // clear out stale children first
        clearStalesSql = `
        DELETE FROM ${tbl} 
        WHERE ROWID IN (
          SELECT ex.ROWID
          FROM ${tbl} ex
          JOIN ${importTable} i ON i.RdfSubject = ex.${subjectCol} 
            AND i.NamedGraph = ex.${graphCol}
            AND i.BatchUid LIKE '${uid}%'
        );
        
        `;
      }

      const sql = `${clearStalesSql}
      REPLACE INTO ${tbl} ( ${subjectCol}, ${objectCol}, ${graphCol}, ${timeCol} )
      SELECT i.RdfSubject, i.RdfObject, i.NamedGraph, i.ImportTime
      FROM ${importTable} i
      ${leftJoin}
      WHERE i.BatchUid LIKE '${uid}%' 
      ${timeCondition};
      `;
      
      DBORM.dbExec(db, sql, true);
    },
    
    executeSaveAndDelete: function(request) {
      const db = DBORM.getDb();
      
      if (request.savableSet) {
        DBORM.SAVING.saveSet(db, request.savableSet);
      }
      
      if (request.deletableSet) {
        DBORM.SAVING.deleteSet(db, request.deletableSet);
      }

      postMessage({ type: MSGTYPE.FROMDB.SAVE_AND_DELETE_DONE, payload: request });
    },

    // this doesn't merely apply a negative timestamp; it's an actual delete
    deleteSet: function(db, savableSet) {
      for (let i = 0; i < savableSet.subsets.length; i++) {
        let subset = savableSet.subsets[i];
        if (subset.sogs.length > 0) {
          DBORM.SAVING.execDeletion(db, subset.entityDefn, subset.sogs);
        }
      }
    },

    saveSet: function(db, savableSet) {
      
      const qMark = `?`;
      
      // bulk import
      for (let i = 0; i < savableSet.subsets.length; i++) {
        let subset = savableSet.subsets[i];
        if (subset.sogs.length > 0) {
          let entityDefn = subset.entityDefn;
          DBORM.SAVING.execBulkImport(db, entityDefn.OneToOne, subset.uid, qMark, qMark, qMark, subset.sogs);
        }
      }
      
      // process temp table into destination tables
      for (let i = 0; i < savableSet.subsets.length; i++) {
        let subset = savableSet.subsets[i];
        if (subset.sogs.length > 0) {
          let entityDefn = subset.entityDefn;
          let tableName = entityDefn.Name;
          DBORM.SAVING.execUpsert(db, savableSet, subset, tableName, entityDefn.OneToOne, entityDefn.SubjectCol, entityDefn.ObjectCol);
        }
      }
      // note: we can wait for next on-startup to batch-clear (truncate) import tables; faster
    },

    // returns records count
    saveRecords: function(data) {
      const pageType = data.pageType;

      const records = data.records;
      const graph = APPGRAPHS.getGraphByPageType(pageType);
      const mapper = SAVEMAPPERFACTORY.getSaveMapper(pageType);

      const savableSet = mapper.mapSavableSet(records, pageType, graph);

      if (records.length > 0) {
        let db = DBORM.getDb();
        try {
          DBORM.SAVING.saveSet(db, savableSet);
        } 
        finally {
          db.close();
        }
      }
      
      return records.length;
    },

    // per index.js ensureCopiedToDb, data.key is the storage key of the data we're transferring, and
    // within each batch, val is the request originally cached by background.js (made in content.js)
    xferCacheToDb: function(data) {
      // we were passed 
      var items = [];
      var keys = [];  // we'll send a message indicating that these keys can be cleared from localStorage
      
      for (let i = 0; i < data.batches.length; i++) {
        let batch = data.batches[i];
        keys.push(batch.key);
        items.push(...batch.val); // batch.val was the list of follows which is _savableFollows from content.js (via background.js)
      }
      
      // we could have been handed a mixed bag of records, so we group them first
      const groups = ES6.groupBy(items, SETTINGS.PAGE_CONTEXT.PAGE_TYPE);
      
      for (let i = 0; i < groups.length; i++) {
        let records = groups[i];
        let pageType = records[0].pageType;
        DBORM.SAVING.saveRecords({ pageType, records });
      }
      
      // tell caller it can clear those cache keys and send over the next ones
      postMessage({ type: MSGTYPE.FROMDB.COPIED_TODB, cacheKeys: keys });
    },

    // request: {list: 'list', member: '@scafaria', pageType: pageType, removal: false}
    setListMember(request) {
      const graph = APPGRAPHS.getGraphByPageType(request.pageType);
      const listMemberEntDefn = PAGETYPE.getListMemberEntDefn(request.pageType);
      
      const nowTime = DBORM.getNowTime(request.removal);   // will be semantically negated if removal is true
      
      // tbc, $s $o $g are sqlite parameter names
      const sql = `
      REPLACE INTO ${listMemberEntDefn.Name} ( 
        ${listMemberEntDefn.SubjectCol}, 
        ${listMemberEntDefn.ObjectCol}, 
        ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}, 
        ${SCHEMA_CONSTANTS.COLUMNS.Timestamp} 
      )
      VALUES ( $s, $o, $g, ${nowTime} );
      `;
      
      const bound = {$s: request.list, $o: request.member, $g: graph};
      
      const db = DBORM.getDb();
      try {
        DBORM.dbExec(db, {
          sql: sql, 
          bind: bound
        }, true);
      }
      finally {
        db.close();
      }
    }
    
  },
  
  LOGGING: {

    // legacy logging (also used for logging catastrophic sqlite errors; ugly)
    logHtml: function(cssClass, ...args) {
      postMessage({ type: MSGTYPE.FROMDB.LOG.LEGACY, payload: { cssClass, args } });
    },
    log: function(...args) {
      DBORM.LOGGING.logHtml('', ...args);
    },
    warn: function(...args) {
      DBORM.LOGGING.logHtml('warning', ...args);
    },
    error: function(...args) {
      DBORM.LOGGING.logHtml('error', ...args);
    },
    
    // specific logging
    reportAppVersion: function(versionInfo) {
      postMessage({ type: MSGTYPE.FROMDB.LOG.SQLITE_VERSION, payload: versionInfo });
    }
  },

  EXPORT: {
    
    getEntityFilterOrDefault: function(request, entity) {
      if (!request.filterSet || !request.filterSet.entitiesFilter) {
        return undefined;
      }
      else {
        return request.filterSet.entitiesFilter.find(function(f) { 
          return STR.sameText(f.entityName, entity.Name); 
        });
      }
    },

    shouldSkip: function(request, entity) {
      const filter = DBORM.EXPORT.getEntityFilterOrDefault(request, entity);

      if (!filter) { 
        return true;
      }
      else {
        return filter.skip;
      }
    },

    writeExportQueryBody: function(request, entity) {
      const x = EXPORT_ROOT_ALIAS;
      let body = `FROM ${entity.Name} ${x}`;
      if (!request.filterSet) { return body; }
      
      let conjunction = 'WHERE';
      const entityFilter = DBORM.EXPORT.getEntityFilterOrDefault(request, entity);
      
      if (entityFilter) {
        if (entityFilter.joiner) {
          body = `${body}
          ${entityFilter.joiner}`;
        }

        if (entityFilter.condition) {
          body = `${body}
          ${conjunction} ${entityFilter.condition}`;
          conjunction = 'AND';
        }
      }

      if (request.filterSet.hoursAgoFilter) {
        body = `${body}
        ${conjunction} ${request.filterSet.hoursAgoFilter}`;
        conjunction = 'AND';
      }

      if (request.filterSet.siteFilter) {
        body = `${body}
        ${conjunction} ${request.filterSet.siteFilter}`;
        conjunction = 'AND';
      }

      return body;
    },

    exportBackup: function(request, allEntities) {
      if (!allEntities || allEntities.length === 0) { return; }
      const skip = request.nextSkip || 0;
      const take = request.nextTake || 1000;
      const exportTimeMs = request.exportTimeMs || Date.now();

      // see which entity (name) was requested
      const entity = (request.nextEntity) 
        ? allEntities.find(function(e) { return STR.sameText(e.Name, request.nextEntity); }) 
        : allEntities.find(function(e) { return !DBORM.EXPORT.shouldSkip(request, e); });
      
      const x = EXPORT_ROOT_ALIAS;
      const body = DBORM.EXPORT.writeExportQueryBody(request, entity);

      const sql = `
      SELECT DISTINCT ${x}.${entity.SubjectCol} AS ${RDFCOL.s}, 
              ${x}.${entity.ObjectCol} AS ${RDFCOL.o}, 
              ${x}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} AS ${RDFCOL.g}, 
              ${x}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} AS ${RDFCOL.t}
      ${body}
      LIMIT ${take} OFFSET ${skip};
      `;

      const bound = [];
      const rows = DBORM.QUERYING.fetch(sql, bound);

      // prepare response (with next request's parameters)
      const thisEntityHasMore = !(rows.length < take);
      let nextEntityName = '';
      let nextSkip = 0;
      let nextTake = take;

      if (thisEntityHasMore) {
        nextEntityName = entity.Name;
        nextSkip = skip + take;
      }
      else {
        let hitIt = false;
        for (let i = 0; i < allEntities.length; i++) {
          let candidate = allEntities[i];
          if (STR.sameText(candidate.Name, entity.Name)) {
            hitIt = true;
          }
          else if (hitIt && !DBORM.EXPORT.shouldSkip(request, candidate)) {
            nextEntityName = candidate.Name;
            break;
          }
        }
      }

      const result = {
        entity: entity.Name,
        skip: skip,
        take: take,
        hasMore: thisEntityHasMore,
        exportTimeMs: exportTimeMs,
        rows: rows
      };

      const resultMsg = {
        result: result,
        filterSet: request.filterSet,
        nextEntity: nextEntityName,
        nextSkip: nextSkip,
        nextTake: nextTake,
        done: nextEntityName.length === 0
      };

      postMessage({ type: MSGTYPE.FROMDB.EXPORT.RETURN_EXPORTED_RESULTS, payload: resultMsg });
    }
  },

  IMPORT: {
    
    receiveSyncableImport: function(request, allEntities) {
      _importSyncQueue.enqueue(request);
      DBORM.IMPORT.processSyncableImports(allEntities);
    },

    processSyncableImports: function(allEntities, bypassLock) {
      
      if (!bypassLock && _processingImportSync === true) {
        // already processing and this isn't just a callback from the single thread...
        // ignore this new inbound request from the worker; we'll get to its request soon enough
        return;
      }

      if (_importSyncQueue.isEmpty) {
        _processingImportSync = false;
        return;
      }

      _processingImportSync = true;
      const activeRequest = _importSyncQueue.dequeue();
      DBORM.IMPORT.processSyncableImport(allEntities, activeRequest.json);

      if (!_importSyncQueue.isEmpty) {
        // process the next one
        processSyncableImports(allEntities, true);
      }
      else {
        // done for now; wait for a new inbound from the worker
        _processingImportSync = false;
      }
    },

    processSyncableImport: function(allEntities, json) {
      const importSet = JSON.parse(json);
      // see result structure in DBORM.EXPORT.exportBackup
      const entityName = importSet.entity;
      const entity = allEntities.find(function(e) { return e.Name === entityName; });
      const entDefns = [entity];
      // pass onlyIfNewer true so that timestamps are preserved and used to decide which to update
      const savableSet = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
      APPSCHEMA.SAVING.getSubset(savableSet, entity.Name).sogs = importSet.rows;

      let db = DBORM.getDb();
      try {
        DBORM.SAVING.saveSet(db, savableSet);
      } 
      finally {
        db.close();
      }

      // tell the ui we processed it
      postMessage({ type: MSGTYPE.FROMDB.IMPORT.PROCESSED_SYNC_IMPORT_BATCH });
    }
  }
};
