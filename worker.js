console.log('Running demo from Worker thread.');

var _sqlite3;
var _db;

// legacy logging
const logHtml = function (cssClass, ...args) {
  postMessage({ type: 'log', payload: { cssClass, args } });
};

const log = (...args) => logHtml('', ...args);
const warn = (...args) => logHtml('warning', ...args);
const error = (...args) => logHtml('error', ...args);

// specific logging
const reportVersion = function(versionInfo) {
  postMessage({ type: 'logSqliteVersion', payload: versionInfo });
}

// initialization
const start = function () {
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
  reportVersion( {libVersion: capi.sqlite3_libversion(), sourceId: capi.sqlite3_sourceid(), opfsOk: opfsOk } );
  // log('transient db =', db.filename);

  try {
    _db.exec("CREATE TABLE IF NOT EXISTS Migration(Id int IDENTITY(1,1) PRIMARY KEY, AppName varchar(128) NOT NULL, Version int, UNIQUE(AppName));");
    // RDF schema: graph | subject | predicate | object (where predicate and entity type are implied)
    _db.exec("CREATE TABLE IF NOT EXISTS FollowersOnTwitter(Id int IDENTITY(1,1) PRIMARY KEY, Subject varchar(128) NOT NULL, oFollower varchar(128) NOT NULL, NamedGraph varchar(128) NOT NULL, UNIQUE(Subject, oFollower, NamedGraph));");   // s has follower o on Twitter per source 'g'
    _db.exec("CREATE TABLE IF NOT EXISTS FollowingOnTwitter(Id int IDENTITY(1,1) PRIMARY KEY, Subject varchar(128) NOT NULL, oFollowing varchar(128) NOT NULL, NamedGraph varchar(128) NOT NULL, UNIQUE(Subject, oFollowing, NamedGraph));");  // s is following o on Twitter per source 'g'
    
    // migration version
    _db.exec("INSERT INTO Migration(AppName) SELECT 'SocialAssistant' WHERE NOT EXISTS ( SELECT Id FROM Migration );");
    _db.exec("UPDATE Migration SET Version = 4 WHERE AppName = 'SocialAssistant';");
    
    _db.exec({
      sql: 'SELECT * FROM Migration',
      rowMode: 'array', // 'array' (default), 'object', or 'stmt'
      callback: function (row) {
        log('Migration ', ++this.counter, '=', row);
      }.bind({ counter: 0 }),
    });
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
}