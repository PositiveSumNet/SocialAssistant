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
  await ensureCopiedToDb();
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
      return; // we only do *one* because we don't want to multi-thread sqlite; wait for callback
    }
  }
  
  // if we got to here, we're fully copied
  xferring.style.display = 'none';
  
  initialRender();
}

const initialRender = function() {
  const urlParams = new URLSearchParams(location.search);
  // defaults
  let owner;
  let pageType;
  
  for (const [key, value] of urlParams) {
    if (key === 'owner') {
      owner = value;
    }
    else if (key === 'pageType') {
      pageType = value;
    }
  }
  
  if (!pageType) {
    pageType = getCachedPageType();
  }
  
  initUi(owner, pageType);
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

const initUi = function(owner, pageType) {
  // owner
  if (owner && !owner.startsWith('@')) {
    owner = '@' + owner;
  }
  
  txtFollowPivotHandle.value = owner;
  
  // pageType/direction
  pageType = pageType || getCachedPageType();
  
  switch (pageType) {
    case 'followersOnTwitter':
      document.getElementById('optFollowers').checked = true;
      break;
    case 'followingOnTwitter':
      document.getElementById('optFollowing').checked = true;
      break;
    default:
      break;
  }
}

const getCachedPageType = function() {
  return localStorage.getItem('pageType') || 'followingOnTwitter';
}

const getUiValue = function(id) {
  switch (id) {
    case 'txtFollowPivotHandle':
      return txtFollowPivotHandle.value;
    case 'optFollowDirection':
      return document.getElementById('optFollowing').checked ? 'following' : 'followers';
    case 'txtFollowSearch':
      return txtFollowSearch.value;
    default:
      return undefined;
  }
}

const getSite = function() {
  // the only one supported for now
  return 'twitter';
}

const getPageType = function(direction) {
  direction = direction || getUiValue('optFollowDirection');
  const site = getSite();
  switch (site) {
    case 'twitter':
      switch (direction) {
        case 'following':
          return 'followingOnTwitter';
        case 'followers':
          return 'followersOnTwitter';
        default:
          return undefined;
      }
      break;
    default:
      return undefined;
  }
}

const cachePageState = function(msg) {
  if (!msg) { return; }
  
  localStorage.setItem('owner', msg.owner);
  localStorage.setItem('pageType', msg.pageType);
}

const buildNetworkSearchRequestFromUi = function() {
  const owner = getUiValue('txtFollowPivotHandle');
  const pageType = getPageType();
  const searchText = getUiValue('txtFollowSearch');
  
  const msg = { 
    actionType: 'networkSearch', 
    pageType: pageType,
    networkOwner: owner, 
    searchText: searchText, 
    orderBy: 'Handle',  // Handle or DisplayName
    skip: 0,
    take: 10  // 50
    };
  
  return msg;
}

const networkSearch = function() {
  const msg = buildNetworkSearchRequestFromUi();
  cachePageState(msg);
  worker.postMessage(msg);
}

const renderFollows = function(payload) {
  const request = payload.request;
  const rows = payload.rows;
  
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    logHtml('', row.TotalCount);
    logHtml('', row.Handle);
  }
}

const txtFollowPivotHandle = document.getElementById('txtFollowPivotHandle');
const ulFollowPivotPicker = document.getElementById('ulFollowPivotPicker');
const followSearch = document.getElementById('txtFollowSearch');

/*
txtFollowPivotHandle.oninput = function () {
  worker.postMessage({
    actionType: 'pickFollowOwner'
    
  });
};
*/
