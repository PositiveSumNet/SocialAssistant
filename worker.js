console.log('Running demo from Worker thread.');

var _sqlite3;
var _db;
const _codeVersion = 2;

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

const reportDbScriptVersion = function() {
  _db.exec({
    sql: "SELECT * FROM Migration WHERE AppName = 'SocialAssistant';",
    rowMode: 'object',
    callback: function (row) {
      postMessage({ type: 'logDbScriptVersion', payload: {version: row.Version} });
    }
  });
}

// INITIALIZATION *****************************************

// migration
const migrateDbAsNeeded = function() {
  let dbVersion = 0;
  
  // migration prereqs
  _db.exec("CREATE TABLE IF NOT EXISTS Migration(Id int IDENTITY(1,1) PRIMARY KEY, AppName varchar(128) NOT NULL, Version int, UNIQUE(AppName));");
  _db.exec("INSERT INTO Migration(AppName, Version) SELECT 'SocialAssistant', 0 WHERE NOT EXISTS ( SELECT Id FROM Migration );");
  _db.exec("UPDATE Migration SET Version = 1 WHERE AppName = 'SocialAssistant';");
  
  // do migration
  for (let i = 0; i < _codeVersion; i++) {
    _db.exec({
      sql: "SELECT * FROM Migration WHERE AppName = 'SocialAssistant';",
      rowMode: 'object',
      callback: function (row) {
        dbVersion = row.Version;
        
        if (dbVersion && dbVersion > 0 && dbVersion < _codeVersion) {
          migrateDb(dbVersion);
        }
      }
    });
  }
  
  // report status
  reportDbScriptVersion();
}

// pass in current dbVersion
const migrateDb = function(dbVersion) {
  switch(dbVersion) {
    case 1:
      // 1 => 2
      // RDF schema: graph | subject | predicate | object (where predicate and entity type are implied)
      _db.exec("CREATE TABLE IF NOT EXISTS FollowerOnTwitter(Id int IDENTITY(1,1) PRIMARY KEY, sHandle varchar(128) NOT NULL, oFollowerHandle varchar(128) NOT NULL, NamedGraph varchar(128) NOT NULL, UNIQUE(sHandle, oFollowerHandle, NamedGraph));");   // s has follower o on Twitter per source 'g'
      _db.exec("CREATE INDEX IX_FollowerOnTwitter_os ON FollowerOnTwitter(oFollowerHandle, sHandle);");
      
      _db.exec("CREATE TABLE IF NOT EXISTS FollowingOnTwitter(Id int IDENTITY(1,1) PRIMARY KEY, sHandle varchar(128) NOT NULL, oFollowingHandle varchar(128) NOT NULL, NamedGraph varchar(128) NOT NULL, UNIQUE(sHandle, oFollowingHandle, NamedGraph));");  // s is following o on Twitter per source 'g'
      _db.exec("CREATE INDEX IX_FollowingOnTwitter_os ON FollowingOnTwitter(oFollowingHandle, sHandle);");
      
      // migration version
      _db.exec("UPDATE Migration SET Version = 2 WHERE AppName = 'SocialAssistant';");
      break;
      
    default:
      break;
  }
}

// initialization
const start = function() {
  const capi = _sqlite3.capi; /*C-style API*/
  const oo = _sqlite3.oo1; /*high-level OO API*/
  // log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
  
  let opfsOk;
  if (_sqlite3.opfs) {
    _db = new _sqlite3.opfs.OpfsDb('/mydb.sqlite3');
    opfsOk = true;
  } else {
    _db = new oo.DB('/mydb.sqlite3', 'ct');
    opfsOk = false;
  }
  reportAppVersion( {libVersion: capi.sqlite3_libversion(), sourceId: capi.sqlite3_sourceid(), opfsOk: opfsOk } );

  try {
    migrateDbAsNeeded();
  } 
  finally {
    _db.close();
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
      // demo initialization code
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
  if (evt.data) {
    switch(evt.data.actionType) {
      case 'save':
        xferCacheToDb(evt.data);
        break;
      default:
        break;
    }
  }
};

// data is the request originally cached by background.js
const xferCacheToDb = function(data) {
  log(data.pageType);
  log(data.owner);
  console.log(data);
}