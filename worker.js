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
    // can set to true while debugging to reset the db
    const startOver = false;
    if (startOver === true) {
      db.exec("drop table if exists Migration;");
      db.exec("drop table if exists RdfImport1to1;");
      db.exec("drop table if exists RdfImport1ton;");
      db.exec("drop table if exists TwitterDisplayName;");
      db.exec("drop table if exists FollowingOnTwitter;");
      db.exec("drop table if exists FollowerOnTwitter;");
      db.exec("drop table if exists TwitterImgCdnUrl;");
      db.exec("drop table if exists TwitterImg64Url;");
    }
    
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
    case 'suggestOwner':
      suggestOwner(evt.data);
      break;
    case 'inputFollowOwner':
      inputFollowOwner(evt.data);
      break;
    case 'networkSearch':
      networkSearch(evt.data);
      break;
    default:
      break;
  }
};

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

// IDENTITY TABLES *****************************************

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

const getImgCdnUrlTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterImgCdnUrl';
    default:
      return null;
  }
}

const getImg64UrlTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterImg64Url';
    default:
      return null;
  }
}
const getSaveMetadata = function(pageType) {
  const tblFollow = getFollowTable(pageType);
  let tblDisplayName = getDisplayNameTable(pageType);
  let tblImgCdnUrl = getImgCdnUrlTable(pageType);
  let tblImg64Url = getImg64UrlTable(pageType);
  
  let action = '';
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      action = 'saveFollows';
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

// SAVING TO DB *****************************************

const clearBulkImport = function(db, oneToOne, uid) {
  const importTable = getImportTable(oneToOne);
  
  const sql = `
  DELETE 
  FROM ${importTable}
  WHERE BatchUid LIKE '${uid}%';
  `;
  
  db.exec(sql);
}

// we want a parameterized query with the speed of the "VALUES (...), (...), (...)" syntax
// sqlite allows hard limit of 999 parms
const execBulkImport = function(db, oneToOne, uid, s, o, g, sogs) {
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
  const numBatches = qPer === 0 ? Math.ceil(sogs.length / maxInserts) : Math.ceil((sogs.length * qPer) / maxParm);
  const perBatch = qPer === 0 ? maxInsertsPerStep : Math.floor(sogs.length / numBatches);
  let skip = 0;
  
  const importTable = getImportTable(oneToOne);
  
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
      
      // we avoid worrying about already-exists (while batching) by appending the iteration number to the guid
      sql = `${sql}${comma}( '${uid}-${i}-${j}', datetime('now'), ${s}, ${o}, ${g} )`;
      
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
    db.exec({sql: sql, bind: bind});
  }
}

const getImportTable = function(oneToOne) {
  return oneToOne === true ? 'RdfImport1to1' : 'RdfImport1ton';
}

const execUpsert = function(db, uid, tbl, oneToOne, s = 'sHandle', o = 'oValue') {
  const importTable = getImportTable(oneToOne);
  
  const sql = `
  REPLACE INTO ${tbl} ( ${s}, ${o}, NamedGraph )
  SELECT RdfSubject, RdfObject, NamedGraph
  FROM ${importTable}
  WHERE BatchUid LIKE '${uid}%';
  `;
  
  db.exec(sql);
}

const saveFollows = function(db, data, meta, graph) {
  // guids for this batch
  const followUid = crypto.randomUUID();
  const handleDisplayUid = crypto.randomUUID();
  const imgCdnUid = crypto.randomUUID();
  const img64Uid = crypto.randomUUID();
  
  // dump values into import table
  // note: use of import table streamlines upsert scenarios and de-duping
  const qMark = `?`;
  const gParm = `'${graph}'`;
  
  // only need to specify the aspects of the sog that are per-item variables
  const followSogs = data.val.payload.map(function(x) {
    return {o: x.h};
  });
  
  const handleDisplaySogs = data.val.payload.map(function(x) {
    return {s: x.h, o: x.d};
  });

  const imgCdnSogs = data.val.payload.map(function(x) {
    return {s: x.h, o: x.imgCdnUrl};
  });

  const img64Sogs = data.val.payload.map(function(x) {
    return {s: x.h, o: x.img64Url};
  });
  
  // bulk import
  execBulkImport(db, false, followUid, `'${data.val.owner}'`, qMark, gParm, followSogs);
  execBulkImport(db, true, handleDisplayUid, qMark, qMark, gParm, handleDisplaySogs);
  execBulkImport(db, true, imgCdnUid, qMark, qMark, gParm, imgCdnSogs);
  execBulkImport(db, true, img64Uid, qMark, qMark, gParm, img64Sogs);
  
  // process temp into final
  execUpsert(db, followUid, meta.tblFollow, false);
  execUpsert(db, handleDisplayUid, meta.tblDisplayName, true);
  execUpsert(db, imgCdnUid, meta.tblImgCdnUrl, true);
  execUpsert(db, img64Uid, meta.tblImg64Url, true);
  
  // clear out import tables
  clearBulkImport(db, followUid, meta.tblFollow, false);
  clearBulkImport(db, handleDisplayUid, meta.tblDisplayName, true);
  clearBulkImport(db, imgCdnUid, meta.tblImgCdnUrl, true);
  clearBulkImport(db, img64Uid, meta.tblImg64Url, true);
  
  // tell caller it can clear that cache key and send over the next one
  postMessage({ type: 'copiedToDb', cacheKey: data.key });
}

// suggesting a single owner on init
const suggestOwner = function(data) {
  let rows = searchOwners(data);
  
  if (rows.length === 1) {
    postMessage({ 
      type: 'renderSuggestedOwner',
      payload: { 
        owner: rows[0]
      }
    });
  }
}

// find owners matching the search
const inputFollowOwner = function(data) {
  let rows = searchOwners(data);
  
  if (rows.length > 0) {
    postMessage({ 
      type: 'renderMatchedOwners',
      payload: { 
        rows: rows
      }
    });
  }
}

const searchOwners = function(data) {
  const pageType = data.pageType;
  const limit = data.limit || 1;
  const searchText = data.searchText || '';
  
  const tblFollow = getFollowTable(pageType);
  const tblDisplay = getDisplayNameTable(pageType);
  const tblImgCdnUrl = getImgCdnUrlTable(pageType);
  const tblImg64Url = getImg64UrlTable(pageType);
  
  const bind = [];
  const conjunction = 'WHERE';
  const searchCols = ['f.sHandle', 'd.oValue'];
  const searchClause = writeSearchClause(searchCols, searchText, conjunction, bind.length);
  let searchClauseSql = '';
  
  if (searchClause && searchClause.sql.length > 0) {
    searchClauseSql = searchClause.sql;
    bind.push(...searchClause.parms);
  }
  
  const sql = `
  SELECT x.*
  FROM (
    SELECT  f.sHandle AS Handle, 
            d.oValue AS DisplayName, imgcdn.oValue AS ImgCdnUrl, img64.oValue AS Img64Url,
            COUNT(f.sHandle) AS Cnt
    FROM ${tblFollow} f
    LEFT JOIN ${tblDisplay} d ON d.sHandle = f.sHandle AND d.NamedGraph = f.NamedGraph
    LEFT JOIN ${tblImgCdnUrl} imgcdn ON imgcdn.sHandle = f.sHandle AND imgcdn.NamedGraph = f.NamedGraph
    LEFT JOIN ${tblImg64Url} img64 ON img64.sHandle = f.sHandle AND img64.NamedGraph = f.NamedGraph
    ${searchClauseSql}
    GROUP BY f.sHandle, d.oValue, imgcdn.oValue, img64.oValue
  ) x
  ORDER BY x.Cnt DESC
  LIMIT ${limit};
  `;
  
  const db = getDb();
  const rows = [];
  
  const bound = bindConsol(bind);
  
  try {
    db.exec({
      sql: sql, 
      bind: bound,
      rowMode: 'object', 
      callback: function (row) {
          rows.push(row);
        }
      });
  }
  finally {
    db.close();
  }

  return rows;
}

const networkSearch = function(request) {
  // could add a NamedGraph filter
  const pageType = request.pageType;
  const tblFollow = getFollowTable(pageType);
  const tblDisplay = getDisplayNameTable(pageType);
  const tblImgCdnUrl = getImgCdnUrlTable(pageType);
  const tblImg64Url = getImg64UrlTable(pageType);
  
  const skip = request.skip || 0;
  const take = request.take || 50;
  
  const orderBy = (request.orderBy && request.orderBy === 'DisplayName') ? 'd.oValue' : 'f.oValue';
  
  const bind = [];
  let conjunction = 'WHERE';
  let ownerCondition = '';
  if (request.networkOwner && request.networkOwner != '*') {
    let parm = {key: '$owner', value: request.networkOwner};
    ownerCondition = `${conjunction} f.sHandle = ${parm.key}`;
    bind.push(parm);
    conjunction = 'AND';
  }
  
  const searchCols = ['f.oValue', 'd.oValue'];
  const searchClause = writeSearchClause(searchCols, request.searchText, conjunction, bind.length);
  let searchClauseSql = '';
  
  if (searchClause) {
    searchClauseSql = searchClause.sql;
    bind.push(...searchClause.parms);
  }
  
  // possible that multiple graphs (sources) provided a display name, so need an aggregate
  const sql = `
  SELECT DISTINCT f.oValue AS Handle, d.oValue AS DisplayName, imgcdn.oValue AS ImgCdnUrl, img64.oValue AS Img64Url,
      COUNT() OVER() AS TotalCount
  FROM ${tblFollow} f
  LEFT JOIN ${tblDisplay} d ON d.sHandle = f.oValue AND d.NamedGraph = f.NamedGraph
  LEFT JOIN ${tblImgCdnUrl} imgcdn ON imgcdn.sHandle = f.oValue AND imgcdn.NamedGraph = f.NamedGraph
  LEFT JOIN ${tblImg64Url} img64 ON img64.sHandle = f.oValue AND img64.NamedGraph = f.NamedGraph
  ${ownerCondition}
  ${searchClauseSql}
  ORDER BY ${orderBy}
  LIMIT ${take} OFFSET ${skip};
  `
  
  const bound = bindConsol(bind);
  
  const db = getDb();
  const rows = [];
  try {
    db.exec({
      sql: sql, 
      bind: bound,
      rowMode: 'object', 
      callback: function (row) {
          rows.push(row);
        }
      });
  } 
  finally {
    db.close();
  }

  // tell the ui to render these rows
  postMessage({ 
    type: 'renderFollows',
    payload: { 
      request: request, 
      rows: rows
    }
  });
}

// conjunction is WHERE or AND
// returns { sql: sql, parms: bindThese }
const writeSearchClause = function(textCols, searchText, conjunction, parmCounter) {
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

// from array of key/value pairs to a single object
// needed for the named-argument approach 
// (which we wanted b/c of multiple usages of a particular nth parameter in search)
// sqlite.org/wasm/doc/trunk/api-oo1.md#stmt-bind
const bindConsol = function(bind) {
  const obj = {};
  for (let i = 0; i < bind.length; i++) {
    let parm = bind[i];
    obj[parm.key] = parm.value;
  }
  
  return obj;
}
