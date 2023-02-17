console.log('Running demo from Worker thread.');

var _sqlite3;

const logHtml = function (cssClass, ...args) {
  postMessage({
    type: 'log',
    payload: { cssClass, args },
  });
};

const log = (...args) => logHtml('', ...args);
const warn = (...args) => logHtml('warning', ...args);
const error = (...args) => logHtml('error', ...args);

const start = function () {
  const capi = _sqlite3.capi; /*C-style API*/
  const oo = _sqlite3.oo1; /*high-level OO API*/
  log('sqlite3 version', capi.sqlite3_libversion(), capi.sqlite3_sourceid());
  let db;
  if (_sqlite3.opfs) {
    db = new _sqlite3.opfs.OpfsDb('/mydb.sqlite3');
    log('The OPFS is available.');
  } else {
    db = new oo.DB('/mydb.sqlite3', 'ct');
    log('The OPFS is not available.');
  }
  log('transient db =', db.filename);

  try {
    log('Create a table...');
    db.exec('CREATE TABLE IF NOT EXISTS t(a,b)');
    log('Insert some data using exec()...');
    let i;
    for (i = 20; i <= 25; ++i) {
      db.exec({
        sql: 'insert into t(a,b) values (?,?)',
        bind: [i, i * 2],
      });
    }
    log("Query data with exec() using rowMode 'array'...");
    db.exec({
      sql: 'select a from t order by a limit 3',
      rowMode: 'array', // 'array' (default), 'object', or 'stmt'
      callback: function (row) {
        log('row ', ++this.counter, '=', row);
      }.bind({ counter: 0 }),
    });
  } finally {
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