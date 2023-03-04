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
    case 'renderSuggestedOwner':
      renderSuggestedOwner(data.payload);
      break;
    case 'renderMatchedOwners':
      renderMatchedOwners(data.payload);
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
  // pageType/direction
  pageType = pageType || getCachedPageType() || 'followingOnTwitter';
  
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

  // set owner
  owner = owner || getCachedOwner();
  let waitForOwnerCallback = false;
  
  if (!owner || owner.length === 0) {
    // we'll initialize to empty string, but 
    // we'll tell the worker to call us back with the most sensible initial value
    const msg = { 
      actionType: 'suggestOwner', 
      pageType: pageType
    };
    
    waitForOwnerCallback = true;
    worker.postMessage(msg);
  }
  
  txtFollowPivotHandle.value = owner || '';
  
  if (waitForOwnerCallback === false) {
    networkSearch(owner, pageType);
  }
}

const renderMatchedOwners = function(owners) {
  ulFollowPivotPicker.style.display = 'block';
  for (i = 0; i < owners.length; i++) {
    ulFollowPivotPicker.innerHTML += "<li>" + owners[i] + "</li>";
  }
}

const renderSuggestedOwner = function(payload) {
  const owner = payload.owner;
  
  if (!owner || !owner.Handle || owner.Handle.length === 0) {
    return;
  }
  
  const value = getUiValue('txtFollowPivotHandle');
  
  if (!value || value.length === 0) {
    document.getElementById('txtFollowPivotHandle').value = owner.Handle;
    // we're doing a page init and so far it's empty, so let's
    networkSearch();
  }
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

const getCachedOwner = function() {
  return localStorage.getItem('networkOwner');
}

const getCachedPageType = function() {
  return localStorage.getItem('pageType');
}

const cachePageState = function(msg) {
  if (!msg) { return; }
  
  if (msg.networkOwner) {
    localStorage.setItem('networkOwner', msg.networkOwner);
  }
  
  if (msg.pageType) {
    localStorage.setItem('pageType', msg.pageType);
  }
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
  const rows = payload.rows;
  
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    logHtml('', row.TotalCount);
    logHtml('', row.Handle);
  }
}

const txtFollowPivotHandle = document.getElementById('txtFollowPivotHandle');
const ulFollowPivotPicker = document.getElementById('ulFollowPivotPicker');
const optFollowing = document.getElementById('optFollowing');
const optFollowers = document.getElementById('optFollowers');
const followSearch = document.getElementById('txtFollowSearch');

optFollowing.addEventListener('change', (event) => {
  networkSearch();
})
optFollowers.addEventListener('change', (event) => {
  networkSearch();
})

// hit enter on account owner
txtFollowPivotHandle.addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    networkSearch();
  }
});

// typeahead for account owner
txtFollowPivotHandle.oninput = function () {
  const userInput = this.value;

  if (!userInput || userInput.length === 0) {
    ulFollowPivotPicker.innerHTML = '';
    return;
  }
  
  const pageType = getPageType();
  
  worker.postMessage({
    actionType: 'inputFollowOwner',
    pageType: pageType,
    searchText: userInput,
    limit: 5
  });
};