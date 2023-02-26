// sqlite.org/wasm/doc/tip/api-oo1.md#stmt
// sql.js.org/documentation/Statement.html
// sql.js.org/#/?id=sqlite-compiled-to-javascript
// sqlite.org/lang_expr.html#varparam
// willschenk.com/articles/2021/sq_lite_in_the_browser/

var _sqlite3;
const _codeVersion = 3;
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
        /* An import table for Rdf data that can be cleared out based on old ImportTime and processed by batch Guid */
        /* A 1-to-1 import table has one object per subject (example: display name)); note the uniqueness */
        CREATE TABLE IF NOT EXISTS RdfImport1to1(
        BatchUid uniqueidentifier,
        ImportTime datetime,
        RdfSubject TEXT NOT NULL,
        RdfObject TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(BatchUid, RdfSubject, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_RdfImport1to1_BatchUid ON RdfImport1to1(BatchUid);
        CREATE INDEX IF NOT EXISTS IX_RdfImport1to1_ImportTime ON RdfImport1to1(ImportTime);


        /* A 1-to-n import table has 'n' objects per subject (example: followers); note the uniqueness */
        CREATE TABLE IF NOT EXISTS RdfImport1ton(
        BatchUid uniqueidentifier,
        ImportTime datetime,
        RdfSubject TEXT NOT NULL,
        RdfObject TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(BatchUid, RdfSubject, RdfObject, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_RdfImport1ton_BatchUid ON RdfImport1ton(BatchUid);
        CREATE INDEX IF NOT EXISTS IX_RdfImport1ton_ImportTime ON RdfImport1ton(ImportTime);


        /* s has follower o on Twitter per source "g" */ 
        CREATE TABLE IF NOT EXISTS FollowerOnTwitter(
        sHandle TEXT NOT NULL,
        oValue TEXT NOT NULL,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_FollowerOnTwitter_os ON FollowerOnTwitter(oValue, sHandle);
        
        
        /* s is following o on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS FollowingOnTwitter(
        sHandle TEXT NOT NULL,
        oValue TEXT NOT NULL,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IX_FollowingOnTwitter_os ON FollowingOnTwitter(oValue, sHandle);
        
        
        /* s has o as its display name on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS TwitterDisplayName(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterDisplayName_os ON TwitterDisplayName(oValue, sHandle);
        

        /* migration version */
        UPDATE Migration SET Version = 2 WHERE AppName = 'SocialAssistant';
        `;
        
      db.exec(sql2);
      break;
    case 2:
      // 2 => 3
      let sql3 = `
        /* s has cdn image url o on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS TwitterImgCdnUrl(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterImgCdnUrl_os ON TwitterImgCdnUrl(oValue, sHandle);
        

        /* s has image data url (*stored here as base 64*) o on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS TwitterImg64Url(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterImg64Url_os ON TwitterImg64Url(oValue, sHandle);
        

        /* migration version */
        UPDATE Migration SET Version = 3 WHERE AppName = 'SocialAssistant';
      `;
      
      db.exec(sql3);
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
    // db.exec("drop table if exists Migration;");
    // db.exec("drop table if exists RdfImport1to1;");
    // db.exec("drop table if exists RdfImport1ton;");
    // db.exec("drop table if exists TwitterDisplayName;");
    // db.exec("drop table if exists FollowingOnTwitter;");
    // db.exec("drop table if exists FollowerOnTwitter;");
    // db.exec("drop table if exists TwitterImgCdnUrl;");
    // db.exec("drop table if exists TwitterImg64Url;");
    
    migrateDbAsNeeded(db);
    // we could also clear out stale abandoned import table data on startup (by ImportTime), 
    // but realistically that's probably not much of a concern so not bothering for now.
  } 
  finally {
    db.close();
  }
};

// on startup
// log('Loading and initializing sqlite3 module...');

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
    // log('Done initializing. Running demo...');
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
  let actionType = getActionType(evt);
  switch(actionType) {
    case 'save':
      xferCacheToDb(evt.data);
      break;
    case 'networkSearch':
      networkSearch(evt.data);
      break;
    default:
      break;
  }
};

const networkSearch = function(search) {
  // could add a NamedGraph filter
  let tblFollow = getFollowTable(search.pageType);
  let tblDisplay = getDisplayNameTable(search.pageType);
  
  // TODO: apply filters, limits, order by, search terms
  
  // possible that multiple graphs (sources) provided a display name, so need an aggregate
  const sql = `
  SELECT DISTINCT f.oValue AS Handle, MAX(d.oValue) AS DisplayName
  FROM ${tblFollow} f
  LEFT JOIN ${tblDisplay} d ON d.sHandle = f.oValue AND d.NamedGraph = f.NamedGraph
  GROUP BY f.oValue
  `
  
  let db = getDb();
  try {
    db.exec({
      sql: sql, 
      rowMode: 'object', 
      callback: function (row) {
          log(row.Handle + ' | ' + row.DisplayName);
        }
      });
  } 
  finally {
    db.close();
  }
}

const getActionType = function(evt) {
  if (evt.data && evt.data.actionType) {
    return evt.data.actionType;
  }
  else if (evt.data && evt.data.val && evt.data.val.actionType) {
    return evt.data.val.actionType;
  }
  else {
    return undefined;
  }
}

// per index.js ensureCopiedToDb, data.key is the storage key of the data we're transferring, and
// data.val is the request originally cached by background.js (made by setSaveTimer in content.js)
const xferCacheToDb = function(data) {
  let meta = getSaveMetadata(data.val.pageType);
  let db = getDb();
  try {
    if (meta.action == 'saveFollows') {
      saveFollows(db, data, meta, _meGraph);
    }
  } 
  finally {
    db.close();
  }
}

const getFollowTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
      return 'FollowingOnTwitter';
    case 'followersOnTwitter':
      return 'FollowerOnTwitter';
    default:
      return null;
  }
}

const getDisplayNameTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterDisplayName';
    default:
      return null;
  }
}

const getSaveMetadata = function(pageType) {
  let action = '';
  let tblImgCdnUrl = '';
  let tblImg64Url = '';
  const tblFollow = getFollowTable(pageType);
  let tblDisplayName = getDisplayNameTable(pageType);
  
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      action = 'saveFollows';
      tblImgCdnUrl = 'TwitterImgCdnUrl';
      tblImg64Url = 'TwitterImg64Url';
      break;
    default:
      return null;
  }
  
  return {
    action: action,
    tblFollow: tblFollow,
    tblDisplayName: tblDisplayName,
    tblImgCdnUrl: tblImgCdnUrl,
    tblImg64Url: tblImg64Url
  };
}

const writeImportSql = function(uid, s, o, g) {
  return `
  INSERT INTO RdfImport1ton ( BatchUid, ImportTime, RdfSubject, RdfObject, NamedGraph )
  VALUES ( '${uid}', datetime('now'), ${s}, ${o}, ${g} );
  `;
}

const writeUpsertSql = function(uid, tbl, oneToOne, s = 'sHandle', o = 'oValue') {
  const importTable = oneToOne === true ? 'RdfImport1to1' : 'RdfImport1ton';
  
  return `
  REPLACE INTO ${tbl} ( ${s}, ${o}, NamedGraph )
  SELECT RdfSubject, RdfObject, NamedGraph
  FROM ${importTable}
  WHERE BatchUid = '${uid}';
  `;
}

const saveFollows = function(db, data, meta, graph) {
  // guids for this batch
  const followUid = crypto.randomUUID();
  const handleDisplayUid = crypto.randomUUID();
  const imgCdnUid = crypto.randomUUID();
  const img64Uid = crypto.randomUUID();
  
  // dump values into import table
  // note: use of import table streamlines upsert scenarios and de-duping
  
  // By holding to the convention oValue for the object value column
  // and sHandle for the subject column, we get by specifying less metadata

  // follower/following
  const gParm = `'${graph}'`;
  const followImportSql = writeImportSql(followUid, `'${data.val.owner}'`, `?`, gParm);
  const handleDisplayImportSql = writeImportSql(handleDisplayUid, `?`, `?`, gParm);
  const imgCdnImportSql = writeImportSql(imgCdnUid, `?`, `?`, gParm);
  const img64ImportSql = writeImportSql(img64Uid, `?`, `?`, gParm);
  
  // bind: sql.js.org/documentation/Statement.html#%255B%2522free%2522%255D
  // sqlite.org/wasm/doc/tip/api-oo1.md       <== especially relevant
  
  const followImportStep = db.prepare(followImportSql);
  const handleDisplayImportStep = db.prepare(handleDisplayImportSql);
  const imgCdnImportStep = db.prepare(imgCdnImportSql);
  const img64ImportStep = db.prepare(img64ImportSql);
  
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
      
      if (follow.imgCdnUrl) {
        imgCdnImportStep.bind([follow.h, follow.imgCdnUrl]);
        imgCdnImportStep.step();
        imgCdnImportStep.reset();
      }
      
      if (follow.img64Url) {
        img64ImportStep.bind([follow.h, follow.img64Url]);
        img64ImportStep.step();
        img64ImportStep.reset();
      }
    }
  }
  finally {
    // free memory
    // sql.js.org/#/?id=api-documentation
    followImportStep.finalize();
    handleDisplayImportStep.finalize();
    imgCdnImportStep.finalize();
    img64ImportStep.finalize();
  }
  
  // process temp into final
  const upsertFollowSql = writeUpsertSql(followUid, meta.tblFollow, false,);
  const upsertDisplaySql = writeUpsertSql(handleDisplayUid, meta.tblDisplayName, true);
  const upsertImgCdnSql = writeUpsertSql(imgCdnUid, meta.tblImgCdnUrl, true);
  const upsertImg64Sql = writeUpsertSql(img64Uid, meta.tblImg64Url, true);
  
  // now upsert the imgCdnUrls
  db.exec(upsertFollowSql);
  db.exec(upsertDisplaySql);
  db.exec(upsertImgCdnSql);
  db.exec(upsertImg64Sql);
  
  // tell caller it can clear that cache key and send over the next one
  postMessage({ type: 'copiedToDb', cacheKey: data.key });
}