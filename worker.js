// sqlite.org/wasm/doc/tip/api-oo1.md#stmt
// sql.js.org/documentation/Statement.html
// sql.js.org/#/?id=sqlite-compiled-to-javascript
// sqlite.org/lang_expr.html#varparam
// willschenk.com/articles/2021/sq_lite_in_the_browser/

var _sqlite3;
const _codeVersion = 6;
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
        Timestamp datetime,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_FollowerOnTwitter_os ON FollowerOnTwitter(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_FollowerOnTwitter_Timestamp ON FollowerOnTwitter(Timestamp);
        
        
        /* s is following o on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS FollowingOnTwitter(
        sHandle TEXT NOT NULL,
        oValue TEXT NOT NULL,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IX_FollowingOnTwitter_os ON FollowingOnTwitter(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_FollowingOnTwitter_Timestamp ON FollowingOnTwitter(Timestamp);
        
        
        /* s has o as its display name on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS TwitterDisplayName(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterDisplayName_os ON TwitterDisplayName(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterDisplayName_Timestamp ON TwitterDisplayName(Timestamp);
        
        
        /* s has o as its profile description on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS TwitterProfileDescription(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileDescription_os ON TwitterProfileDescription(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileDescription_Timestamp ON TwitterProfileDescription(Timestamp);
        

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
        Timestamp datetime,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterImgCdnUrl_os ON TwitterImgCdnUrl(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterImgCdnUrl_Timestamp ON TwitterImgCdnUrl(Timestamp);
        

        /* s has image data url (*stored here as base 64*) o on Twitter per source "g" */
        CREATE TABLE IF NOT EXISTS TwitterImg64Url(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterImg64Url_os ON TwitterImg64Url(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterImg64Url_Timestamp ON TwitterImg64Url(Timestamp);
        

        /* migration version */
        UPDATE Migration SET Version = 3 WHERE AppName = 'SocialAssistant';
      `;
      
      db.exec(sql3);
      break;
    case 3:
      // 3 => 4
      let sql4 = `
        /* with format @scafaria@toad.social */
        CREATE TABLE IF NOT EXISTS TwitterProfileMastodonAccount(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileMastodonAccount_os ON TwitterProfileMastodonAccount(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileMastodonAccount_Timestamp ON TwitterProfileMastodonAccount(Timestamp);
        

        CREATE TABLE IF NOT EXISTS TwitterProfileExternalUrl(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileExternalUrl_os ON TwitterProfileExternalUrl(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileExternalUrl_Timestamp ON TwitterProfileExternalUrl(Timestamp);
        

        CREATE TABLE IF NOT EXISTS TwitterProfileEmail(
        sHandle TEXT NOT NULL,
        oValue TEXT,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, oValue, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileEmail_os ON TwitterProfileEmail(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterProfileEmail_Timestamp ON TwitterProfileEmail(Timestamp);
        

        /* migration version */
        UPDATE Migration SET Version = 4 WHERE AppName = 'SocialAssistant';
      `;
      
      db.exec(sql4);
      break;

    case 4:
      // 4 => 5
      
      // TODO: consider eliminating these
      
      let sql5 = `
      CREATE INDEX IF NOT EXISTS IX_FollowerOnTwitter_o ON FollowerOnTwitter(oValue);
      CREATE INDEX IF NOT EXISTS IX_FollowingOnTwitter_o ON FollowingOnTwitter(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterDisplayName_o ON TwitterDisplayName(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterProfileDescription_o ON TwitterProfileDescription(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterImgCdnUrl_o ON TwitterImgCdnUrl(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterImg64Url_o ON TwitterImg64Url(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterProfileMastodonAccount_o ON TwitterProfileMastodonAccount(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterProfileExternalUrl_o ON TwitterProfileExternalUrl(oValue);
      CREATE INDEX IF NOT EXISTS IX_TwitterProfileEmail_o ON TwitterProfileEmail(oValue);
        

        /* migration version */
        UPDATE Migration SET Version = 5 WHERE AppName = 'SocialAssistant';
      `;
      
      db.exec(sql5);
      break;
    case 5:
      // 5 => 6
      
      let sql6 = `
        CREATE TABLE IF NOT EXISTS TwitterFavorited(
        sHandle TEXT NOT NULL,
        oValue datetime,
        NamedGraph TEXT NOT NULL,
        Timestamp datetime,
        UNIQUE(sHandle, NamedGraph));
        
        CREATE INDEX IF NOT EXISTS IX_TwitterFavorited_os ON TwitterFavorited(oValue, sHandle);
        CREATE INDEX IF NOT EXISTS IX_TwitterFavorited_Timestamp ON TwitterFavorited(Timestamp);
        CREATE INDEX IF NOT EXISTS IX_TwitterFavorited_os ON TwitterFavorited(oValue, sHandle);
        

        /* migration version */
        UPDATE Migration SET Version = 6 WHERE AppName = 'SocialAssistant';
      `;
      
      db.exec(sql6);
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
      db.exec("drop table if exists TwitterProfileDescription;");
      db.exec("drop table if exists FollowingOnTwitter;");
      db.exec("drop table if exists FollowerOnTwitter;");
      db.exec("drop table if exists TwitterImgCdnUrl;");
      db.exec("drop table if exists TwitterImg64Url;");
      db.exec("drop table if exists TwitterProfileMastodonAccount;");
      db.exec("drop table if exists TwitterProfileExternalUrl;");
      db.exec("drop table if exists TwitterProfileEmail;");
      db.exec("drop table if exists TwitterFavorited;");
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
// import library scripts
importScripts(sqlite3Js);
importScripts('/lib/shared/constants.js');
importScripts('/lib/shared/es6lib.js');
importScripts('/lib/shared/strlib.js');

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
    case 'xferCacheToDb':
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
    case 'getNetworkSize':
      getNetworkSize(evt.data);
      break;
    case 'setFavorite':
      setFavorite(evt.data);
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
// within each batch, val is the request originally cached by background.js (made by setFollowSaveTimer in content.js)
const xferCacheToDb = function(data) {
  // we were passed 
  var items = [];
  var keys = [];
  
  for (let i = 0; i < data.batches.length; i++) {
    let batch = data.batches[i];
    keys.push(batch.key);
    items.push(...batch.val); // batch.val was the list of follows which is _savableFollows from content.js (via background.js)
  }
  
  const groups = groupBy(items, 'pageType');
  
  for (let i = 0; i < groups.length; i++) {
    let group = groups[i];
    let pageType = group[0].pageType;
    let meta = getSaveFollowsMetadata(pageType);
    let db = getDb();
    try {
      if (meta.action == 'saveFollows') {
        saveFollows(db, group, keys, meta, _meGraph);
      }
    } 
    finally {
      db.close();
    }
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

const getInverseFollowTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
      return 'FollowerOnTwitter';
    case 'followersOnTwitter':
      return 'FollowingOnTwitter';
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

const getDescriptionTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterProfileDescription';
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

const getProfileMastodonTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterProfileMastodonAccount';
    default:
      return null;
  }
}

const getProfileUrlTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterProfileExternalUrl';
    default:
      return null;
  }
}

const getProfileEmailTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterProfileEmail';
    default:
      return null;
  }
}

const getFavoritedTable = function(pageType) {
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      return 'TwitterFavorited';
    default:
      return null;
  }
}

const getSaveFollowsMetadata = function(pageType) {
  const tblFollow = getFollowTable(pageType);
  const tblDisplayName = getDisplayNameTable(pageType);
  const tblDescription = getDescriptionTable(pageType);
  const tblImgCdnUrl = getImgCdnUrlTable(pageType);
  const tblImg64Url = getImg64UrlTable(pageType);
  const tblProfileMdon = getProfileMastodonTable(pageType);
  const tblProfileExtUrl = getProfileUrlTable(pageType);
  const tblProfileEmail = getProfileEmailTable(pageType);
  
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
    tblDescription: tblDescription,
    tblImgCdnUrl: tblImgCdnUrl,
    tblImg64Url: tblImg64Url,
    tblProfileMdon: tblProfileMdon,
    tblProfileExtUrl: tblProfileExtUrl,
    tblProfileEmail: tblProfileEmail
  };
}

// SAVING TO DB *****************************************

const clearBulkImport = function(db, arr, oneToOne, uid) {
  if (!arr || arr.length === 0) { return; } // no work to do
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

const execUpsert = function(db, arr, uid, tbl, oneToOne, s = 'sHandle', o = 'oValue') {
  if (!arr || arr.length === 0) { return; } // no work to do
  const importTable = getImportTable(oneToOne);
  
  const sql = `
  REPLACE INTO ${tbl} ( ${s}, ${o}, NamedGraph, Timestamp )
  SELECT RdfSubject, RdfObject, NamedGraph, ImportTime
  FROM ${importTable}
  WHERE BatchUid LIKE '${uid}%';
  `;
  
  db.exec(sql);
}

const saveFollows = function(db, follows, cacheKeys, meta, graph) {
  // guids for this batch
  const followUid = crypto.randomUUID();
  const handleDisplayUid = crypto.randomUUID();
  const descriptionUid = crypto.randomUUID();
  const imgCdnUid = crypto.randomUUID();
  const img64Uid = crypto.randomUUID();
  const mdonUid = crypto.randomUUID();
  const urlUid = crypto.randomUUID();
  const emailUid = crypto.randomUUID();
  
  // dump values into import table
  // note: use of import table streamlines upsert scenarios and de-duping
  const qMark = `?`;
  const gParm = `'${graph}'`;
  
  const followSogs = follows.map(function(x) {
    return {s: x.owner, o: x.handle};
  });
  
  const handleDisplaySogs = follows.map(function(x) {
    return {s: x.handle, o: x.displayName};
  });
  
  const handleDescriptionSogs = follows.map(function(x) {
    return {s: x.handle, o: x.description};
  });

  const imgCdnSogs = follows.map(function(x) {
    return {s: x.handle, o: x.imgCdnUrl};
  });

  const img64Sogs = follows.map(function(x) {
    return {s: x.handle, o: x.img64Url};
  });
  
  const mdonSogs = [];
  const urlSogs = [];
  const emailSogs = [];
  for (let i = 0; i < follows.length; i++) {
    let follow = follows[i];
    if (follow.accounts && follow.accounts.mdons) {
      follow.accounts.mdons.forEach(x => mdonSogs.push({s: follow.handle, o: x}));
    }
    if (follow.accounts && follow.accounts.urls) {
      follow.accounts.urls.forEach(x => urlSogs.push({s: follow.handle, o: x}));
    }
    if (follow.accounts && follow.accounts.emails) {
      follow.accounts.emails.forEach(x => emailSogs.push({s: follow.handle, o: x}));
    }
  }
  
  // bulk import
  execBulkImport(db, false, followUid, qMark, qMark, gParm, followSogs);
  execBulkImport(db, true, handleDisplayUid, qMark, qMark, gParm, handleDisplaySogs);
  execBulkImport(db, true, descriptionUid, qMark, qMark, gParm, handleDescriptionSogs);
  execBulkImport(db, true, imgCdnUid, qMark, qMark, gParm, imgCdnSogs);
  execBulkImport(db, true, img64Uid, qMark, qMark, gParm, img64Sogs);
  execBulkImport(db, false, mdonUid, qMark, qMark, gParm, mdonSogs);
  execBulkImport(db, false, urlUid, qMark, qMark, gParm, urlSogs);
  execBulkImport(db, false, emailUid, qMark, qMark, gParm, emailSogs);
  
  // process temp into final
  execUpsert(db, followSogs, followUid, meta.tblFollow, false);
  execUpsert(db, handleDisplaySogs, handleDisplayUid, meta.tblDisplayName, true);
  execUpsert(db, handleDescriptionSogs, descriptionUid, meta.tblDescription, true);
  execUpsert(db, imgCdnSogs, imgCdnUid, meta.tblImgCdnUrl, true);
  execUpsert(db, img64Sogs, img64Uid, meta.tblImg64Url, true);
  execUpsert(db, mdonSogs, mdonUid, meta.tblProfileMdon, false);
  execUpsert(db, urlSogs, urlUid, meta.tblProfileExtUrl, false);
  execUpsert(db, emailSogs, emailUid, meta.tblProfileEmail, false);
  
  // clear out import tables
  clearBulkImport(db, followSogs, followUid, meta.tblFollow, false);
  clearBulkImport(db, handleDisplaySogs, handleDisplayUid, meta.tblDisplayName, true);
  clearBulkImport(db, handleDescriptionSogs, descriptionUid, meta.tblDescription, true);
  clearBulkImport(db, imgCdnSogs, imgCdnUid, meta.tblImgCdnUrl, true);
  clearBulkImport(db, img64Sogs, img64Uid, meta.tblImg64Url, true);
  clearBulkImport(db, mdonSogs, mdonUid, meta.tblProfileMdon, false);
  clearBulkImport(db, urlSogs, urlUid, meta.tblProfileExtUrl, false);
  clearBulkImport(db, emailSogs, emailUid, meta.tblProfileEmail, false);

  // tell caller it can clear those cache keys and send over the next ones
  postMessage({ type: 'copiedToDb', cacheKeys: cacheKeys });
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
        owners: rows
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
  const tblDescription = getDescriptionTable(pageType);
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
            MAX(f.Timestamp) AS Timestamp,
            d.oValue AS DisplayName, dx.oValue AS Description,
            imgcdn.oValue AS ImgCdnUrl, img64.oValue AS Img64Url,
            COUNT(f.sHandle) AS Cnt
    FROM ${tblFollow} f
    LEFT JOIN ${tblDisplay} d ON d.sHandle = f.sHandle AND d.NamedGraph = f.NamedGraph
    LEFT JOIN ${tblDescription} dx ON dx.sHandle = f.sHandle AND d.NamedGraph = f.NamedGraph
    LEFT JOIN ${tblImgCdnUrl} imgcdn ON imgcdn.sHandle = f.sHandle AND imgcdn.NamedGraph = f.NamedGraph
    LEFT JOIN ${tblImg64Url} img64 ON img64.sHandle = f.sHandle AND img64.NamedGraph = f.NamedGraph
    ${searchClauseSql}
    GROUP BY f.sHandle, d.oValue, dx.oValue, imgcdn.oValue, img64.oValue
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

const setFavorite = function(request) {
  const tbl = getFavoritedTable(request.pageType);
  const val = request.favorite === true ? `datetime('now')` : 'null';
  const graph = request.graph || _meGraph;
  // parameter is named $handle
  const sql = `REPLACE INTO ${tbl}(sHandle, NamedGraph, oValue) VALUES ($handle, '${graph}', ${val});`;
  const bound = {$handle: request.handle};
  
  const db = getDb();
  try {
    db.exec({
      sql: sql, 
      bind: bound
    });
  }
  finally {
    db.close();
  }
}

const getNetworkSize = function(request) {
  const graphFilter = request.graph || _meGraph;
  const pageType = request.pageType;
  const networkOwner = request.networkOwner;
  const tblFollow = getFollowTable(pageType);
  
  // parameter is named $owner
  const sql = `SELECT COUNT(*) AS TotalCount FROM ${tblFollow} f WHERE f.sHandle = $owner;`;
  const bound = {$owner: request.networkOwner};

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
  
  const row = rows[0];
  const cnt = parseInt(row["TotalCount"]);
  
  // post back to UI
  postMessage({ 
    type: 'renderNetworkSize',
    payload: { 
      totalCount: cnt,
      request: request
    }
  });  
}

const networkSearch = function(request) {
  const graphFilter = request.graph || _meGraph;
  const pageType = request.pageType;
  const tblFollow = getFollowTable(pageType);
  const tblDisplay = getDisplayNameTable(pageType);
  const tblDescription = getDescriptionTable(pageType);
  const tblImgCdnUrl = getImgCdnUrlTable(pageType);
  const tblImg64Url = getImg64UrlTable(pageType);
  // filters
  const tblMutual = getInverseFollowTable(pageType);
  const tblProfileMdon = getProfileMastodonTable(pageType);
  const tblProfileExtUrl = getProfileUrlTable(pageType);
  const tblProfileEmail = getProfileEmailTable(pageType);
  const tblFavorited = getFavoritedTable(pageType);
  
  const skip = request.skip || 0;
  const take = request.take || 50;
  
  // temporarily commenting out: the order by really slows us down (despite the new '_o' indices, so avoiding it for now
  const orderBy = ''; // (request.orderBy && request.orderBy === 'DisplayName') ? 'ORDER BY d.oValue' : 'ORDER BY f.oValue';
  
  const bind = [];
  let conjunction = 'WHERE';
  let ownerCondition = '';
  if (request.networkOwner && request.networkOwner != '*') {
    let parm = {key: '$owner', value: request.networkOwner};
    ownerCondition = `${conjunction} f.sHandle = ${parm.key} AND f.NamedGraph = '${graphFilter}'`;
    bind.push(parm);
    conjunction = 'AND';
  }
  
  const searchCols = ['f.oValue', 'd.oValue', 'dx.oValue'];
  const searchClause = writeSearchClause(searchCols, request.searchText, conjunction, bind.length);
  let searchClauseSql = '';
  
  if (searchClause) {
    searchClauseSql = searchClause.sql;
    bind.push(...searchClause.parms);
  }
  
  // special filters
  let joinMutual = '';
  let joinMastodon = '';
  let joinEmail = '';
  let joinUrl = '';
  
  // by default we return back the description
  // if a special report (email, url, mdon), we return that instead (to render in the same template)
  let detail = 'dx.oValue';
  
  if (request.mutual === true) {
    joinMutual = `JOIN ${tblMutual} mutual ON mutual.oValue = f.oValue AND mutual.sHandle = f.sHandle AND mutual.NamedGraph = f.NamedGraph`;
  }
  
  if (request.withMdon === true) {
    joinMastodon = `JOIN ${tblProfileMdon} mdon ON mdon.sHandle = f.oValue AND mdon.NamedGraph = f.NamedGraph`;
    detail = 'mdon.oValue';
  }
  else if (request.withEmail === true) {
    joinEmail = `JOIN ${tblProfileEmail} ema ON ema.sHandle = f.oValue AND ema.NamedGraph = f.NamedGraph`;
    detail = 'ema.oValue';
  }
  else if (request.withUrl === true) {
    joinUrl = `JOIN ${tblProfileExtUrl} durl ON durl.sHandle = f.oValue AND durl.NamedGraph = f.NamedGraph`;
    detail = 'durl.oValue';
  }
  
  let favJoinWord = 'LEFT JOIN';
  let favConditionSql = '';
  if (request.favorited === true) {
    favJoinWord = 'JOIN';
    favConditionSql = `AND fav.oValue IS NOT NULL`;
  }
  const joinFavorited = `${favJoinWord} ${tblFavorited} fav ON fav.sHandle = f.oValue AND fav.NamedGraph = f.NamedGraph ${favConditionSql}`;
  
  // possible that multiple graphs (sources) provided a display name, so need an aggregate
  const sql = `
  SELECT DISTINCT f.oValue AS Handle, 
      f.Timestamp AS Timestamp,
      d.oValue AS DisplayName, 
      ${detail} AS Detail,
      imgcdn.oValue AS ImgCdnUrl, 
      img64.oValue AS Img64Url,
      CASE WHEN fav.oValue IS NOT NULL THEN 1 ELSE 0 END AS IsFavorite
  FROM ${tblFollow} f
  ${joinMutual}
  ${joinMastodon}
  ${joinEmail}
  ${joinUrl}
  ${joinFavorited}
  LEFT JOIN ${tblDisplay} d ON d.sHandle = f.oValue AND d.NamedGraph = f.NamedGraph
  LEFT JOIN ${tblDescription} dx ON dx.sHandle = f.oValue AND dx.NamedGraph = f.NamedGraph
  LEFT JOIN ${tblImgCdnUrl} imgcdn ON imgcdn.sHandle = f.oValue AND imgcdn.NamedGraph = f.NamedGraph
  LEFT JOIN ${tblImg64Url} img64 ON img64.sHandle = f.oValue AND img64.NamedGraph = f.NamedGraph
  ${ownerCondition}
  ${searchClauseSql}
  ${orderBy}
  LIMIT ${take} OFFSET ${skip};
  `
  
  const bound = bindConsol(bind);
  
  // let dt = Date.now();
  
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
  
  // console.log(`search: ${request.searchText}, rows: ${rows.length} elapsed: ${Date.now() - dt}`);
  
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
