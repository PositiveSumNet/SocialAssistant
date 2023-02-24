// sqlite.org/wasm/doc/tip/api-oo1.md#stmt
// sql.js.org/documentation/Statement.html
// sql.js.org/#/?id=sqlite-compiled-to-javascript
// sqlite.org/lang_expr.html#varparam
// willschenk.com/articles/2021/sq_lite_in_the_browser/

console.log('Running demo from Worker thread.');

var _sqlite3;
const _codeVersion = 4;
const _meGraph = 'me';  // special constant for NamedGraph when it's 'me' (as opposed to sourced from a 3rd party)

// LOGGING *****************************************

// legacy logging
const logHtml = function (cssClass, ...args) {
  postMessage({ type: 'log', payload: { cssClass, args } });
};

const log = (...args) => logHtml('', ...args);
const warn = (...args) => logHtml('warning', ...args);
const error = (...args) => logHtml('error', ...args);

// specific logging
const reportAppVersion = function(versionInfo) {
  postMessage({ type: 'logSqliteVersion', payload: versionInfo });
}

const reportDbScriptVersion = function(db) {
  db.exec({
    sql: "SELECT * FROM Migration WHERE AppName = 'SocialAssistant';",
    rowMode: 'object',
    callback: function (row) {
      postMessage({ type: 'logDbScriptVersion', payload: {version: row.Version} });
    }
  });
}

// INITIALIZATION *****************************************

// migration
const migrateDbAsNeeded = function(db) {
  let dbVersion = 0;
  
  // migration prereqs
  // sqlite.org/autoinc.html
  let initSql = `CREATE TABLE IF NOT EXISTS Migration(AppName TEXT NOT NULL, Version int, UNIQUE(AppName));
    INSERT INTO Migration(AppName, Version) SELECT 'SocialAssistant', 0 WHERE NOT EXISTS ( SELECT ROWID FROM Migration );
    UPDATE Migration SET Version = 1 WHERE AppName = 'SocialAssistant' AND Version = 0;
    `;
  
  db.exec(initSql);
  
  // do migration
  for (let i = 0; i < _codeVersion; i++) {
    db.exec({
      sql: "SELECT * FROM Migration WHERE AppName = 'SocialAssistant';",
      rowMode: 'object',
      callback: function (row) {
        dbVersion = row.Version;
        
        if (dbVersion && dbVersion > 0 && dbVersion < _codeVersion) {
          migrateDb(db, dbVersion);
        }
      }
    });
  }
  
  // report status
  reportDbScriptVersion(db);
}

// pass in current dbVersion
const migrateDb = function(db, dbVersion) {
  switch(dbVersion) {
    case 1:
      // 1 => 2
      // RDF schema: graph | subject | predicate | object (where predicate and entity type are implied)
      let sql2 = `
        /* s has follower o on Twitter per source "g" */ 
        CREATE TABLE IF NOT EXISTS FollowerOnTwitter(
        sHandle TEXT NOT NULL,
        oFollowerHandle TEXT NOT NULL,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IX_FollowerOnTwitter_os ON FollowerOnTwitter(oFollowerHandle, sHandle);
        
        
        /* s is following o on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS FollowingOnTwitter(
        sHandle TEXT NOT NULL,
        oFollowingHandle TEXT NOT NULL,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IX_FollowingOnTwitter_os ON FollowingOnTwitter(oFollowingHandle, sHandle);
        
        
        /* migration version */
        UPDATE Migration SET Version = 2 WHERE AppName = 'SocialAssistant';
        `;
        
      db.exec(sql2);
      break;
    case 2:
      // 2 => 3
      let sql3 = `
        CREATE TABLE IF NOT EXISTS TwitterDisplayName(
        sHandle TEXT NOT NULL,
        oDisplayName TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IX_TwitterDisplayName_os ON TwitterDisplayName(oDisplayName, sHandle);
        
        
        /* migration version */
        UPDATE Migration SET Version = 3 WHERE AppName = 'SocialAssistant';
        `;

      db.exec(sql3);
      break;
    case 3:
      // 3 => 4
      let sql4 = `
        /* An import table for Rdf data that can be cleared out based on old ImportTime and processed by batch Guid */
        CREATE TABLE IF NOT EXISTS RdfImport(
        BatchUid uniqueidentifier,
        ImportTime datetime,
        RdfSubject TEXT NOT NULL,
        RdfObject TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(BatchUid, RdfSubject, NamedGraph));
        
        CREATE INDEX IX_RdfImport_BatchUid ON RdfImport(BatchUid);
        CREATE INDEX IX_RdfImport_ImportTime ON RdfImport(ImportTime);
        
        
        /* migration version */
        UPDATE Migration SET Version = 4 WHERE AppName = 'SocialAssistant';
        `;
      
      db.exec(sql4);
      break;
    default:
      break;
  }
}

const getDb = function(withStartupLogging) {
  const capi = _sqlite3.capi; /*C-style API*/
  const oo = _sqlite3.oo1; /*high-level OO API*/
  // log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
  
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
    reportAppVersion( {libVersion: capi.sqlite3_libversion(), sourceId: capi.sqlite3_sourceid(), opfsOk: opfsOk } );
  }
  
  return db;
}

// initialization
const start = function() {
  
  let db = getDb(true);
  
  try {
    // can uncomment while debugging to reset the db
    //db.exec("drop table if exists Migration;");
    //db.exec("drop table if exists RdfImport;");
    //db.exec("drop table if exists TwitterDisplayName;");
    //db.exec("drop table if exists FollowingOnTwitter;");
    //db.exec("drop table if exists FollowerOnTwitter;");
    
    migrateDbAsNeeded(db);
    // we could also clear out stale abandoned import table data on startup (by ImportTime), 
    // but realistically that's probably not much of a concern so not bothering for now.
  } 
  finally {
    db.close();
  }
};

// on startup
log('Loading and initializing sqlite3 module...');

let sqlite3Js = 'sqlite3.js';
const urlParams = new URL(self.location.href).searchParams;
if (urlParams.has('sqlite3.dir')) {
  sqlite3Js = urlParams.get('sqlite3.dir') + '/' + sqlite3Js;
}
importScripts(sqlite3Js);

self
  .sqlite3InitModule({
    print: log,
    printErr: error,
  })
  .then(function (sqlite3) {
    log('Done initializing. Running demo...');
    try {
      _sqlite3 = sqlite3;
      start();
      // tell index.js that worker is ready to receive on-startup data
      postMessage({ type: 'workerReady' });
    } catch (e) {
      error('Exception:', e.message);
    }
  });

// RECEIVE MESSAGES *****************************************

// receive message from index.js
onmessage = (evt) => {
  if (evt.data && evt.data.val) {
    switch(evt.data.val.actionType) {
      case 'save':
        xferCacheToDb(evt.data);
        break;
      default:
        break;
    }
  }
};

// per index.js ensureCopiedToDb, data.key is the storage key of the data we're transferring, and
// data.val is the request originally cached by background.js (made by setSaveTimer in content.js)
const xferCacheToDb = function(data) {
  let tblFollow = '';
  let tblDisplay = '';
  let oColName = '';
  let action = '';
  
  switch (data.val.pageType) {
    case 'followingOnTwitter':
      tblFollow = 'FollowingOnTwitter';
      tblDisplay = 'TwitterDisplayName';
      oColName = 'oFollowingHandle';
      action = 'saveFollows';
      break;
    case 'followersOnTwitter':
      tblFollow = 'FollowerOnTwitter';
      tblDisplay = 'TwitterDisplayName';
      oColName = 'oFollowerHandle';
      action = 'saveFollows';
      break;
    default:
      return;
  }
  
  
  let db = getDb();
  
  try {
    if (action == 'saveFollows') {
      saveFollows(db, data, tblFollow, tblDisplay, oColName, _meGraph);
    }
  } 
  finally {
    db.close();
  }
}

const saveFollows = function(db, data, tblFollow, tblDisplay, oColName, graph) {
  // guids for this batch
  const followUid = crypto.randomUUID();
  const handleDisplayUid = crypto.randomUUID();
  
  // dump values into import table
  // note: use of import table streamlines upsert scenarios and de-duping
  const followImportSql = `
  INSERT INTO RdfImport ( BatchUid, ImportTime, RdfSubject, RdfObject, NamedGraph )
  VALUES ( '${followUid}', datetime('now'), '${data.val.owner}', ?, '${_meGraph}' );
  `;
  
  const handleDisplayImportSql = `
  INSERT INTO RdfImport ( BatchUid, ImportTime, RdfSubject, RdfObject, NamedGraph )
  VALUES ( '${handleDisplayUid}', datetime('now'), ?, ?, '${_meGraph}' );
  `;
  
  // bind: sql.js.org/documentation/Statement.html#%255B%2522free%2522%255D
  // sqlite.org/wasm/doc/tip/api-oo1.md       <== especially relevant
  const followImportStep = db.prepare(followImportSql);
  const handleDisplayImportStep = db.prepare(handleDisplayImportSql);
  
  try {
    for (let i = 0; i < data.val.payload.length; i++) {
      let follow = data.val.payload[i];
      followImportStep.bind([follow.h]);
      followImportStep.step();
      followImportStep.reset();
      
      if (follow.d) {
        handleDisplayImportStep.bind([follow.h, follow.d]);
        handleDisplayImportStep.step();
        handleDisplayImportStep.reset();
      }
    }
  }
  finally {
    // free memory
    // sql.js.org/#/?id=api-documentation
    followImportStep.finalize();
    handleDisplayImportStep.finalize();
  }
  
  // process temp into final
  // (import table is already distinct, so distinct keyword isn't needed)
  const upsertFollowSql = `
  REPLACE INTO ${tblFollow} ( sHandle, ${oColName}, NamedGraph )
  SELECT RdfSubject, RdfObject, NamedGraph
  FROM RdfImport
  WHERE BatchUid = ${followUid};
  `;
  
  // now upsert the display names
  const upsertDisplaySql = `
  REPLACE INTO ${tblDisplay} ( sHandle, oDisplayName, NamedGraph )
  SELECT RdfSubject, RdfObject, NamedGraph
  FROM RdfImport
  WHERE BatchUid = ${handleDisplayUid};
  `;
  
  //db.exec(upsertFollowSql);
  //db.exec(upsertDisplaySql);
  
  // tell caller it can clear these
  // using data.key
  
//  INSERT INTO ${tblName} ( sHandle, ${oColName}, NamedGraph )
//  VALUES ( ${data.owner}, ?, ${_meGraph} );

  //log(sql);
  
  // upsert from import to rdf tables (and clear out import records)
  
}