// html grid via webdesign.tutsplus.com/tutorials/pagination-with-vanilla-javascript--cms-41896

// default (legacy) logging
const logHtml = function (cssClass, ...args) {
  const ln = document.createElement('div');
  if (cssClass) ln.classList.add(cssClass);
  ln.append(document.createTextNode(args.join(' ')));
  document.body.append(ln);
};

// specific logging
const logSqliteVersion = function(versionInfo) {
  document.getElementById('sqliteVersionLib').innerHTML = versionInfo.libVersion;
  document.getElementById('sqliteOpfsOk').innerHTML = versionInfo.opfsOk.toString();
  //document.getElementById('sqliteSourceId').innerHTML = versionInfo.sourceId;
}

const logDbScriptVersion = function(versionInfo) {
  document.getElementById('dbScriptNumber').innerHTML = versionInfo.version.toString();
}

const onCopiedToDb = async function(cacheKey) {
  // we can clear out the cache key
  await chrome.storage.local.remove(cacheKey);
  
  // and queue up the next one
  const transferDone = await ensureCopiedToDb();
  
  if (transferDone === true) {
    // can do any other "fully initialized" work here
  }
}

const ensureCopiedToDb = async function() {
  const all = await chrome.storage.local.get();
  const entries = Object.entries(all);
  const xferring = document.getElementById('transferringMsg');
  xferring.innerHTML = 'Copying ' + entries.length + ' pages of data to local database...';
  
  if (entries.length > 0) {
    xferring.style.display = 'block';
  }
  
  for (const [key, val] of entries) {
    if (key.startsWith('fordb-')) {
      worker.postMessage({ key: key, val: val });
      return false; // we only do *one* because we don't want to multi-thread sqlite; wait for callback
    }
  }
  
  // if we got to here, we're fully copied
  xferring.style.display = 'none';
  
  // we're fully copied and it's time to render the 
  // most relevant list, i.e. the one for the query string parms we were passed
  initialRender();
  
  return true;
}

const initialRender = function() {
  const urlParams = new URLSearchParams(location.search);
  // defaults
  let owner = '*';
  let pageType = 'followingOnTwitter';
  
  for (const [key, value] of urlParams) {
    if (key === 'owner') {
      owner = value;
    }
    else if (key === 'pageType') {
      pageType = value;
    }
  }
  
  networkSearch(owner, pageType);
}

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
// receive messages from worker
worker.onmessage = function ({ data }) {
  switch (data.type) {
    case 'log':
      // legacy + error logging
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    case 'logSqliteVersion':
      logSqliteVersion(data.payload);
      break;
    case 'logDbScriptVersion':
      logDbScriptVersion(data.payload);
      break;
    case 'workerReady':
      ensureCopiedToDb();
      break;
    case 'copiedToDb':
      onCopiedToDb(data.cacheKey);
      break;
    case 'renderFollows':
      renderFollows(data.payload);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};

const networkSearch = function(owner = '*', pageType = 'followingOnTwitter') {
  worker.postMessage({ 
    actionType: 'networkSearch', 
    pageType: pageType,
    networkOwner: owner, 
    searchText: '*', 
    orderBy: 'Handle',  // Handle or DisplayName
    skip: 0,
    take: 10  // 50
    });
}

const getOwnerHandle = function() {
  const followPivotHandle = document.getElementById('followPivotHandle');
  let owner = followPivotHandle.value;
}

const renderFollows = function(payload) {
  const request = payload.request;
  const rows = payload.rows;
  console.log(payload);
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    logHtml('', row.TotalCount);
    logHtml('', row.Handle);
  }
}