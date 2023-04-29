// hollow if not favorited
const _starOffCls = 'bi-star';
const _starOnCls = 'bi-star-fill'

// avoid double-submit
var _lastRenderedFollowsRequest = '';

// improves experience of deleting in owner textbox
var _deletingOwner = false;
var _deletingMdonRemoteOwner = false;

// so we can reduce how many times we ask for (expensive) total counts
var _counterSet = new Set();
var _counters = [];

// for export
var _exportPauseRequested;
var _pausedExportMsg;

// read out to initialize (using chrome.storage.local is more seure than localStorage)
chrome.storage.local.get([MASTODON.OAUTH_CACHE_KEY.USER], function(result) {
  _mdonRememberedUser = result.mdonUser || {};
});

chrome.storage.local.get([MASTODON.OAUTH_CACHE_KEY.CLIENT_ID], function(result) {
  _mdonClientId = result.mdonClientId || '';
  // console.log('clientid: ' + _mdonClientId);
});

chrome.storage.local.get([MASTODON.OAUTH_CACHE_KEY.CLIENT_SECRET], function(result) {
  _mdonClientSecret = result.mdonClientSecret || '';
  // console.log('secret: ' + _mdonClientSecret);
});

chrome.storage.local.get([MASTODON.OAUTH_CACHE_KEY.ACCESS_TOKEN], function(result) {
  _mdonAccessToken = result.mdonAccessToken || '';
  // console.log('access: ' + _mdonAccessToken);
});

chrome.storage.local.get([MASTODON.OAUTH_CACHE_KEY.USER_AUTH_TOKEN], function(result) {
  _mdonUserAuthToken = result.mdonUserAuthToken || '';
  // console.log('userauth: ' + _mdonUserAuthToken);
});

// guides us as to which links to look for (e.g. so that if we're focused on mdon we don't distract the user with rendered email links)
const getPersonRenderAnchorsRule = function() {
  if (getUiValue('optWithMdon') === true) {
    return RENDER_CONTEXT.ANCHORS.MDON_ONLY;
  }
  else if (getUiValue('optWithEmail') === true) {
    return RENDER_CONTEXT.ANCHORS.EMAIL_ONLY;
  }
  else if (getUiValue('optWithUrl') === true) {
    return RENDER_CONTEXT.ANCHORS.EXTURL_ONLY;
  }
  else {
    return RENDER_CONTEXT.ANCHORS.ALL;
  }
}

// when sqlite pushes unhandled exception log messages, they log (ugly) as rendered divs
const logHtml = function (cssClass, ...args) {
  const ln = document.createElement('div');
  if (cssClass) ln.classList.add(cssClass);
  ln.append(document.createTextNode(args.join(' ')));
  document.body.append(ln);
};

// specific logging
const logSqliteVersion = function(versionInfo) {
  document.getElementById('sqliteVersionLib').textContent = versionInfo.libVersion;
  document.getElementById('sqliteOpfsOk').textContent = versionInfo.opfsOk.toString();
  //document.getElementById('sqliteSourceId').textContent = versionInfo.sourceId;
}

const logDbScriptVersion = function(versionInfo) {
  document.getElementById('dbScriptNumber').textContent = versionInfo.version.toString();
}

const onCopiedToDb = async function(cacheKeys) {
  // we can clear out the cache keys
  for (let i = 0; i < cacheKeys.length; i++) {
    let cacheKey = cacheKeys[i];
    await chrome.storage.local.remove(cacheKey);
  }
  
  // and queue up the next run
  await ensureCopiedToDb();
}

const onGotSavedCount = function(count, pageType, metadata) {
  const site = PAGETYPE.getSite(pageType);
  
  switch (site) {
    case SITE.MASTODON:
      MASTODON.onGotSavedCount(count, metadata.ownerAccountId, MASTODON.getFollowDirectionFromPageType(pageType));
      return;
    case SITE.TWITTER:
    default:
      // no rendering planned
      console.log('Saved ' + count);
      break;
  }
}

const ensureCopiedToDb = async function() {
  const all = await chrome.storage.local.get();
  const entries = Object.entries(all);
  const xferring = document.getElementById('transferringMsg');
  // if concurrent access becomes a problem, we can revert to hiding the list while importing (for now commented out)
  const filterSet = document.getElementById('listFilterSet');
  
  xferring.textContent = 'Copying ' + entries.length + ' pages to local database...';
  if (entries.length > 0) {
    xferring.style.display = 'inline-block';
    filterSet.style.display = 'none';
  }
  
  // allow sqlite to do process in larger batches than what was cached
  const batches = [];
  const maxBatches = 10;
  let ctr = 0;
  for (const [key, val] of entries) {
    if (key.startsWith('fordb-')) {
      let batch = { key: key, val: val };
      batches.push(batch);
      ctr++;
      
      if (ctr >= maxBatches) {
        // come back for more rather than sending massive messages around
        break;
      }
    }
  }
  
  if (batches.length > 0) {
    worker.postMessage( { batches: batches, actionType: MSGTYPE.TODB.XFER_CACHE_TODB } );
  }
  else {
    // if we got to here, we're fully copied
    xferring.style.display = 'none';
    filterSet.style.display = 'flex';

    initialRender();
  }
}

const initialRender = function() {
  // app version
  document.getElementById('manifestVersion').textContent = chrome.runtime.getManifest().version;
  
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
  
  if (owner || pageType) {
    // clear url parms so that a page refresh going forward respects the UI state instead of the query string
    // stackoverflow.com/questions/38625654/remove-url-parameter-without-page-reloading
    const url= document.location.href;
    window.history.pushState({}, "", url.split("?")[0]);
  }
  
  if (!pageType) {
    pageType = SETTINGS.getCachedPageType();
  }
  
  initUi(owner, pageType);
}

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
// receive messages from worker
worker.onmessage = function ({ data }) {
  switch (data.type) {
    case MSGTYPE.FROMDB.LOG.LEGACY:
      // legacy + error logging
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    case MSGTYPE.FROMDB.LOG.SQLITE_VERSION:
      logSqliteVersion(data.payload);
      break;
    case MSGTYPE.FROMDB.LOG.DB_SCRIPT_VERSION:
      logDbScriptVersion(data.payload);
      break;
    case MSGTYPE.FROMDB.WORKER_READY:
      ensureCopiedToDb();
      break;
    case MSGTYPE.FROMDB.COPIED_TODB:
      onCopiedToDb(data.cacheKeys);
      break;
    case MSGTYPE.FROMDB.RENDER.SUGGESTED_OWNER:
      renderSuggestedOwner(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS:
      renderMatchedOwners(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.CONNECTIONS:
      renderConnections(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.NETWORK_SIZE:
      renderNetworkSize(data.payload);
      break;
    case MSGTYPE.FROMDB.EXPORT.RETURN_EXPORTED_RESULTS:
      handleExportedResults(data.payload);
      break;
    case MSGTYPE.FROMDB.IMPORT.PROCESSED_SYNC_IMPORT_BATCH:
      onProcessedSyncBatch();
      break;
    case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT:
      onGotSavedCount(data.count, data.pageType, data.metadata);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};

// handles optionally passing in query string parameters
const initUi = function(owner, pageType) {
  let site;
  if (pageType) {
    site = PAGETYPE.getSite(pageType);
    SETTINGS.cacheSite(site);
  }
  else {
    site = SETTINGS.getCachedSite();
  }

  updateForSite();
  // pageType/direction
  pageType = pageType || SETTINGS.getCachedPageType() || PAGETYPE.TWITTER.FOLLOWING;
  
  switch (pageType) {
    case PAGETYPE.TWITTER.FOLLOWERS:
    case PAGETYPE.MASTODON.FOLLOWERS:
        document.getElementById('optFollowers').checked = true;
      break;
    case PAGETYPE.TWITTER.FOLLOWING:
    case PAGETYPE.MASTODON.FOLLOWING:
        document.getElementById('optFollowing').checked = true;
      break;
    default:
      break;
  }

  // set owner
  owner = owner || SETTINGS.getCachedOwner();
  let waitForOwnerCallback = false;
  
  if (!owner || owner.length === 0) {
    // we'll initialize to empty string, but 
    // we'll tell the worker to call us back with the most sensible initial value
    const msg = { 
      actionType: MSGTYPE.TODB.SUGGEST_OWNER, 
      pageType: pageType
    };
    
    waitForOwnerCallback = true;
    worker.postMessage(msg);
  }

  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  if (waitForOwnerCallback === false) {
    networkSearch(owner, pageType);
  }
}

const choiceFiltersApply = function() {
  const site = SETTINGS.getCachedSite();

  switch (site) {
    case SITE.TWITTER:
      // only twitter renders the option buttons for the filters
      return true;
    default:
      return false;
  }
}

const detailReflectsFilter = function() {
  return getUiValue('optWithMdon') === true || getUiValue('optWithEmail')  === true || getUiValue('optWithUrl') === true;
}

const renderPerson = function(person, context) {
  const renderAnchorsRule = getPersonRenderAnchorsRule();
  const filtered = detailReflectsFilter();
  return RENDER.renderPerson(person, context, renderAnchorsRule, filtered);
}

const renderMatchedOwners = function(payload) {
  const owners = payload.owners;
  listOwnerPivotPicker.replaceChildren();
  
  if (owners.length === 1 && !_deletingOwner) {
    // exact match; pick it! (after an extra check that the user isn't 
    // trying to delete, in which case auto-complete would be annoying)
    txtOwnerHandle.value = STR.stripPrefix(owners[0].Handle, '@');
    onChooseOwner();
  }
  else {
    for (i = 0; i < owners.length; i++) {
      // renderPerson uses DOMPurify.sanitize
      listOwnerPivotPicker.innerHTML += renderPerson(owners[i], 'owner');
    }
    
    IMAGE.resolveDeferredLoadImages(listOwnerPivotPicker);
  }
}

const renderSuggestedOwner = function(payload) {
  const owner = payload.owner;
  if (!owner || !owner.Handle || owner.Handle.length === 0) {
    return;
  }
  
  const value = getUiValue('txtOwnerHandle');
  
  if (!value || value.length === 0) {
    document.getElementById('txtOwnerHandle').value = owner.Handle;
    // we're doing a page init and so far it's empty, so let's
    resetPage();
    networkSearch();
  }
}

const getUiValue = function(id) {
  switch (id) {
    case 'txtOwnerHandle':
      return txtOwnerHandle.value;
    case 'optFollowDirection':
      return document.getElementById('optFollowers').checked ? CONN_DIRECTION.FOLLOWERS : CONN_DIRECTION.FOLLOWING;
    case 'txtConnSearch':
      return txtConnSearch.value;
    case 'txtPageNum':
      return parseInt(txtPageNum.value);
    case 'chkMutual':
      return chkMutual.checked;
    case 'chkFavorited':
      return chkFavorited.checked;
    case 'optWithMdon':
      return optWithMdon.checked;
    case 'optWithEmail':
      return optWithEmail.checked;
    case 'optWithUrl':
      return optWithUrl.checked;
    default:
      return undefined;
  }
}

const getPageType = function(direction) {
  direction = direction || getUiValue('optFollowDirection');
  const site = SETTINGS.getCachedSite();
  return PAGETYPE.getPageType(site, direction);
}

const resetPage = function() {
  document.getElementById('txtPageNum').value = 1;
}

const resetFilters = function() {
  chkMutual.checked = false;
  chkFavorited.checked = false;
  optClear.checked = true;
}

const getPageNum = function() {
  let pageNum = getUiValue('txtPageNum');
  if (isNaN(pageNum)) { pageNum = 1 };
  return pageNum;
}

const calcSkip = function() {
  const pageNum = getPageNum();
  const pageSize = SETTINGS.getPageSize();
  const skip = (pageNum - 1) * pageSize;
  return skip;
}

// this ensures we prompt for server on first-time click of 'w/ mastodon' without them having to click the gear
const onClickedMdonOption = function() {
  ensureAskedMdonServer();
  
  // continue even if user cancelled the chance to input a mdon server
  resetPage();
  networkSearch();  
}

const ensureAskedMdonServer = function() {
  const asked = SETTINGS.getAskedMdonServer();
  
  if (!asked) {
    confirmMdonServer();
  }
}

const confirmMdonServer = function() {
  const mdonServer = SETTINGS.getMdonServer() || '';
  const input = prompt("First, please input the Mastodon server where you have an account (e.g. 'toad.social').", mdonServer);
  
  if (input != null) {
    localStorage.setItem(SETTINGS.MDON_SERVER, input);
  }
  
  // even if they cancelled, we'll avoid showing again (they can click the gear if desired)
  localStorage.setItem(SETTINGS.ASKED.MDON_SERVER, true);
  return input;
}

const getOwnerFromUi = function() {
  // trim the '@'
  let owner = getUiValue('txtOwnerHandle');
  owner = owner && owner.startsWith('@') ? owner.substring(1) : owner;
  return owner;
}

const buildNetworkSearchRequestFromUi = function() {
  const owner = STR.ensurePrefix(getOwnerFromUi(), '@');  // prefixed in the db
  const pageType = getPageType();
  const site = PAGETYPE.getSite(pageType);
  const pageSize = SETTINGS.getPageSize();
  const searchText = getUiValue('txtConnSearch');
  const skip = calcSkip();
  const mutual = getUiValue('chkMutual');
  const favorited = getUiValue('chkFavorited');

  const withUrl = getUiValue('optWithUrl');
  const canChoiceFilter = choiceFiltersApply();
  const withMdon = canChoiceFilter ? getUiValue('optWithMdon') : false;
  const withEmail = canChoiceFilter ? getUiValue('optWithEmail') : false;
  
  const msg = { 
    actionType: MSGTYPE.TODB.NETWORK_SEARCH, 
    pageType: pageType,
    site: site,
    networkOwner: owner, 
    searchText: searchText, 
    orderBy: 'Handle',  // Handle or DisplayName
    skip: skip,
    take: pageSize,
    // filters
    mutual: mutual,
    list: LIST_FAVORITES,
    requireList: favorited,
    withMdon: withMdon,
    withEmail: withEmail,
    withUrl: withUrl
  };
  
  return msg;
}

const showNetworkSearchProgress = function(show) {
  const elm = document.getElementById('connListProgress');
  if (show === true) {
    elm.style.visibility = 'visible';
  }
  else {
    elm.style.visibility = 'hidden';
  }
}

const makeNetworkSizeCounterKey = function(owner, pageType) {
  return `${owner}-${pageType}`;
}

const clearCachedCountForCurrentRequest = function() {
  const owner = getOwnerFromUi();
  const pageType = getPageType();

  if (!owner || !pageType) {
    return;
  }

  const key = makeNetworkSizeCounterKey(owner, pageType);
  if (_counterSet.has(key)) {
    _counterSet.delete(key);
  }
}

const requestTotalCount = function() {
  const owner = getOwnerFromUi();
  if (!owner) {
    return;
  }
  
  const pageType = getPageType();
  
  const key = makeNetworkSizeCounterKey(owner, pageType);
  if (_counterSet.has(key)) {
    const counter = _counters.find(function(c) { return c.key === key; });
    if (counter && counter.value) {
      // we already have this count cached; apply it
      setFollowLabelCaption(pageType, counter.value);
    }
    // else wait for fetch to finish; either way, we're done
    return;
  }
  
  const atOwner = STR.ensurePrefix(owner, '@'); // DB includes @ prefix
  const msg = {actionType: MSGTYPE.TODB.GET_NETWORK_SIZE, networkOwner: atOwner, pageType: pageType};
  
  worker.postMessage(msg);
  // record knowledge that this count has been requested
  _counterSet.add(key);
  _counters.push({key: key});   // value not set yet; will be when called back
}

const networkSearch = function(forceRefresh) {
  const msg = buildNetworkSearchRequestFromUi();
  const requestJson = JSON.stringify(msg);
  
  SETTINGS.cachePageState(msg);

  if (!forceRefresh && _lastRenderedFollowsRequest === requestJson) {
    // we already have this rendered; avoid double-submission
    return;
  }
  
  if (forceRefresh) {
    // ensure that the follow count is re-requested
    clearCachedCountForCurrentRequest();
  }

  showNetworkSearchProgress(true);
  worker.postMessage(msg);
}

const setFollowLabelCaption = function(pageType, count) {
  switch (pageType) {
    case PAGETYPE.TWITTER.FOLLOWING:
    case PAGETYPE.MASTODON.FOLLOWING:
      document.getElementById('optFollowingLabel').textContent = `following (${count})`;
      return;
    case PAGETYPE.TWITTER.FOLLOWERS:
    case PAGETYPE.MASTODON.FOLLOWERS:
      document.getElementById('optFollowersLabel').textContent = `followers (${count})`;
      return;
    default:
      return;
  }
}

const renderNetworkSize = function(payload) {
  const uiPageType = getPageType();
  const uiOwner = getOwnerFromUi();
  const dbOwnerSansPrefix = STR.stripPrefix(payload.request.networkOwner, '@');
  
  if (uiPageType != payload.request.pageType || uiOwner != dbOwnerSansPrefix) {
    return; // page status has changed since request was made
  }
  
  const key = makeNetworkSizeCounterKey(uiOwner, uiPageType);
  let counter = _counters.find(function(c) { return c.key === key; });
  
  if (!counter) {
    counter = {key: key};
    _counters.push(counter); // surprising
  }
  
  const count = payload.totalCount;
  counter.value = count;  // cached for later
  setFollowLabelCaption(uiPageType, count);
}

const clearConnectionUiElms = function() {
  document.getElementById('paginated-list').replaceChildren();
  document.getElementById('listOwnerPivotPicker').replaceChildren();
  clearFollowCounters();
}

const renderConnections = function(payload) {
  clearConnectionUiElms();
  
  const plist = document.getElementById('paginated-list');
  
  // rows
  const rows = payload.rows;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
      // renderPerson uses DOMPurify.sanitize
      plist.innerHTML += renderPerson(row, 'followResult');
  }

  IMAGE.resolveDeferredLoadImages(plist);
  
  const pageGearTip = `Page size is ${SETTINGS.getPageSize()}. Click to modify.`;
  document.getElementById('pageGear').setAttribute("title", pageGearTip);
  
  showNetworkSearchProgress(false);
  onAddedFollows(plist);
  requestTotalCount();
  
  _lastRenderedFollowsRequest = JSON.stringify(payload.request);
}

const configureFavoriting = function(a) {
  a.onclick = function(event) {
    const pageType = getPageType();
    const handle = this.getAttribute('data-testid');
    const atHandle = STR.ensurePrefix(handle, '@');
    const iconElm = this.querySelector('i');
    
    const alreadyFavorited = iconElm.classList.contains(_starOnCls);
    let removeFromFavorites;
    if (alreadyFavorited) {
      // toggle to not-favorite
      iconElm.classList.remove(_starOnCls)
      iconElm.classList.add(_starOffCls);
      removeFromFavorites = true;
    }
    else {
      // toggle to is-favorite
      if (iconElm.classList.contains(_starOffCls)) {
        iconElm.classList.remove(_starOffCls);
      }
      iconElm.classList.add(_starOnCls);
      removeFromFavorites = false;
    }
    
    // tell the db (see DBORM.setListMember)
    const msg = {
      actionType: MSGTYPE.TODB.SET_LIST_MEMBER, 
      list: LIST_FAVORITES, 
      member: atHandle, 
      pageType: pageType,
      removal: removeFromFavorites
    };
    
    worker.postMessage(msg);
    return false;
  };
}

const onAddedFollows = function(container) {
  // favoriting
  Array.from(container.getElementsByClassName("canstar")).forEach(a => configureFavoriting(a));
}

const txtOwnerHandle = document.getElementById('txtOwnerHandle');
const listOwnerPivotPicker = document.getElementById('listOwnerPivotPicker');
const optFollowing = document.getElementById('optFollowing');
const optFollowers = document.getElementById('optFollowers');
const followSearch = document.getElementById('txtConnSearch');
const txtPageNum = document.getElementById('txtPageNum');
const chkMutual = document.getElementById('chkMutual');
const optWithMdon = document.getElementById('optWithMdon');
const optWithEmail = document.getElementById('optWithEmail');
const optWithUrl = document.getElementById('optWithUrl');
const optClear = document.getElementById('optClear');
// mastodon account typeahead hitting api
const txtRemoteMdon = document.getElementById('txtMdonDownloadConnsFor');
const mdonRemoteOwnerPivotPicker = document.getElementById('mdonRemoteOwnerPivotPicker');

optFollowing.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optFollowers.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});

chkMutual.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
chkFavorited.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optWithMdon.addEventListener('change', (event) => {
  onClickedMdonOption();
});
optWithEmail.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optWithUrl.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optClear.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});

// searching
const handleTypeSearch = ES6.debounce((event) => {
  resetPage();
  networkSearch();
}, 250);
// ... uses debounce
followSearch.addEventListener('input', handleTypeSearch);

// hit enter on page number
txtPageNum.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    networkSearch();
  }
});

const handleFromClickedOwner = function(event) {
  const personElm = ES6.findUpClass(event.target, 'person');
  const handleElm = personElm.querySelector('.personLabel .personHandle');
  let handleText = handleElm.innerText;
  handleText = STR.stripPrefix(handleText, '@');
  return handleText;
}

const suggestAccountOwner = function(userInput) {
  const pageType = getPageType();
  
  worker.postMessage({
    actionType: MSGTYPE.TODB.INPUT_FOLLOW_OWNER,
    pageType: pageType,
    searchText: userInput,
    limit: 5
  });
}

// typeahead for account owner
// w3collective.com/autocomplete-search-javascript/
const ownerSearch = ES6.debounce((event) => {
  const userInput = getUiValue('txtOwnerHandle');

  if (!userInput || userInput.length === 0) {
    listOwnerPivotPicker.replaceChildren();
  }
  
  suggestAccountOwner(userInput);
}, 250);
txtOwnerHandle.addEventListener('input', ownerSearch);

// auto-populate with a few owners on-focus (if empty)
txtOwnerHandle.onfocus = function () {
  const userInput = this.value;
  if (!userInput || userInput.length === 0) {
    suggestAccountOwner(userInput);
  }
};

txtOwnerHandle.addEventListener('keydown', function(event) {
  if (event.key === "Backspace" || event.key === "Delete") {
    _deletingOwner = true;
  }
  else {
    _deletingOwner = false;
  }
});

// click for prior page
document.getElementById('priorPage').onclick = function(event) {
  const pageNum = getUiValue('txtPageNum');
  if (pageNum > 1) {
    txtPageNum.value = pageNum - 1;
    networkSearch();
  }
  return false;
};

document.getElementById('nextPage').onclick = function(event) {
  const pageNum = getPageNum();
  txtPageNum.value = pageNum + 1;
  networkSearch();
  return false;
};

document.getElementById('pageGear').onclick = function(event) {
  const pageSize = SETTINGS.getPageSize();
  const input = prompt("Choose page size", pageSize.toString());
  
  if (input != null) {
    const intVal = parseInt(input);
    if (isNaN(intVal)) {
      alert("Invalid input; page size unchanged");
    }
    else if (intVal > 100) {
      alert("Max suggested page size is 100; leaving unchanged");
    }
    else {
      localStorage.setItem('pageSize', intVal);
      resetPage();
      networkSearch();
    }
  }
  return false;
};

document.getElementById('mdonGear').onclick = function(event) {
  const mdonServer = confirmMdonServer();
  
  if (mdonServer != null) {
    // re-render
    optWithMdon.checked = true;
    networkSearch();
  }
  return false;
};

// choose owner from typeahead results
listOwnerPivotPicker.onclick = function(event) {
  txtOwnerHandle.value = handleFromClickedOwner(event);
  onChooseOwner();
};

const clearFollowCounters = function() {
  // the nbsp values are to be less jarring with width changes
  document.getElementById('optFollowersLabel').innerHTML = `followers&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
  document.getElementById('optFollowingLabel').innerHTML = `following&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
}

const onChooseOwner = function() {
  // when owner changes, we need to reset the counts and then request a refreshed count
  clearFollowCounters();
  listOwnerPivotPicker.replaceChildren();
  resetPage();
  networkSearch();
}

/************************/
// Import 
// smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/
/************************/
document.getElementById('startImportBtn').onclick = function(event) {
  document.getElementById('uploadui').style.display = 'block';
  document.getElementById('dbui').style.display = 'none';
  document.getElementById('startImportBtn').style.display = 'none';
  document.getElementById('stopImportBtn').style.display = 'inline-block';
  updateUploadDoneBtnText();
  return false;
};

const finishImporting = function() {
  document.getElementById('uploadui').style.display = 'none';
  document.getElementById('dbui').style.display = 'flex';
  document.getElementById('startImportBtn').style.display = 'inline-block';
  document.getElementById('stopImportBtn').style.display = 'none';
}
  
// a full page refresh is in order (helps avoid disk log + redraws the full page)
document.getElementById('stopImportBtn').onclick = function(event) {
  location.reload();
  return false;
};  
document.getElementById('uploadDone').onclick = function(event) {
  // a full page refresh is in order
  location.reload();
  return false;
};  

let _dropArea = document.getElementById("drop-area");
let _fileElem = document.getElementById('fileElem');

// Prevent default drag behaviors
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  _dropArea.addEventListener(eventName, preventDefaults, false)   
  document.body.addEventListener(eventName, preventDefaults, false)
});

// Highlight drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
  _dropArea.addEventListener(eventName, highlightDropArea, false)
});

['dragleave', 'drop'].forEach(eventName => {
  _dropArea.addEventListener(eventName, unhighlightDropArea, false)
});

// Handle dropped files
_dropArea.addEventListener('drop', handleDrop, false);

_fileElem.addEventListener('change', (event) => {
  handleUploadFiles(event.target.files);
});

function handleUploadFiles(files) {
  files = [...files];
  files.forEach(processUpload);
}

function highlightDropArea(e) {
  _dropArea.classList.add('highlightDropArea');
}

function unhighlightDropArea(e) {
  _dropArea.classList.remove('active');
}

function handleDrop(e) {
  var dt = e.dataTransfer;
  var files = dt.files;

  handleUploadFiles(files);
}

// stackoverflow.com/questions/24886628/upload-file-inside-chrome-extension
function processUpload(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const uploadedCntElem = document.getElementById('uploadedCnt');
    uploadedCntElem.innerText = parseInt(uploadedCntElem.innerText) + 1;
    updateUploadDoneBtnText();
    worker.postMessage({
      actionType: MSGTYPE.TODB.ON_RECEIVED_SYNCABLE_IMPORT,
      json: e.target.result
    });
  }
  reader.readAsText(file);
}

function onProcessedSyncBatch() {
  const processedCntElem = document.getElementById('syncImportProcessedCnt');
  processedCntElem.innerText = parseInt(processedCntElem.innerText) + 1;
  updateUploadDoneBtnText();
}

function updateUploadDoneBtnText() {
  const uploadedCnt = parseInt(document.getElementById('uploadedCnt').innerText);
  const processedCnt = parseInt(document.getElementById('syncImportProcessedCnt').innerText);
  const btnElem = document.getElementById('uploadDone');

  if (uploadedCnt > 0 && processedCnt === uploadedCnt) {
    btnElem.innerText = 'Done!';
  }
  else {
    btnElem.innerText = 'Close';
  }
}

/************************/
// Export
/************************/

document.getElementById('startExportBtn').onclick = function(event) {
  startExport();
  return false;
};

document.getElementById('pauseExportBtn').onclick = function(event) {
  pauseExport();
  return false;
};

const startExport = function() {
  
  const userResponse = confirm("This will download a set of plain-text files (could be many). You can pause any time. To later import, browse to your PC's Downloads folder and you can import in batch.");

  if (userResponse != true) {
    return;
  }

  const msg = _pausedExportMsg || {
    actionType: MSGTYPE.TODB.EXPORT_BACKUP,
    exportTimeMs: Date.now()
  };

  _exportPauseRequested = false;

  document.getElementById('startExportBtn').style.display = 'none';
  document.getElementById('pauseExportBtn').style.display = 'inline-block';

  worker.postMessage(msg);
}

const pauseExport = function() {
  _exportPauseRequested = true;
  document.getElementById('startExportBtn').innerText = 'Resume Export';
  document.getElementById('startExportBtn').style.display = 'inline-block';
  document.getElementById('pauseExportBtn').style.display = 'none';
}

const handleExportedResults = function(payload) {
  // for now, we download to json (later, we could push to user's github etc)
  const result = payload.result;
  const start = result.skip + 1;
  const end = result.skip + result.rows.length;
  const fileName = `${result.entity}-${result.exportTimeMs}-${start}-${end}.json`;
  const json = JSON.stringify(result, null, 2);
  RENDER.saveTextFile(json, fileName);
  
  // kick off next page if appropriate
  if (!payload.done) {
    const msg = {
      actionType: MSGTYPE.TODB.EXPORT_BACKUP,
      nextEntity: payload.nextEntity,
      nextSkip: payload.nextSkip,
      nextTake: payload.nextTake
    };

    if (_exportPauseRequested) {
      _pausedExportMsg = msg;
    }
    else {
      worker.postMessage(msg);
    }
  }
  else {
    _exportPauseRequested = false;
    _pausedExportMsg = undefined;

    document.getElementById('startExportBtn').innerText = 'Export Again';
    document.getElementById('startExportBtn').style.display = 'inline-block';
    document.getElementById('pauseExportBtn').style.display = 'none';
  }
}

/************************/
// Multi-tab
/************************/

document.getElementById('twitterLensBtn').onclick = function(event) {
  const site = SETTINGS.getCachedSite();

  if (site != SITE.TWITTER) {
    SETTINGS.cacheSite(SITE.TWITTER);
    updateForSite();
    networkSearch();
  }

  return false;
};

document.getElementById('mastodonLensBtn').onclick = function(event) {
  const site = SETTINGS.getCachedSite();

  if (site != SITE.MASTODON) {
    SETTINGS.cacheSite(SITE.MASTODON);
    updateForSite();
    networkSearch();
  }

  return false;
};

const updateForSite = function() {
  const site = SETTINGS.getCachedSite();
  SETTINGS.cacheSite(site);
  // clear what's there now
  clearConnectionUiElms();
  _lastRenderedFollowsRequest = '';
  
  const owner = SETTINGS.getCachedOwner(site);
  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  const twitterBtn = document.getElementById('twitterLensBtn');
  const mastodonBtn = document.getElementById('mastodonLensBtn');
  const mastodonApiUi = document.getElementById('mdonApiUi');

  setChoiceFilterVisibility();
  
  if (site == SITE.TWITTER) {
    twitterBtn.classList.add('active');
    
    if (mastodonBtn.classList.contains('active')) {
      mastodonBtn.classList.remove('active');
    }
    
    twitterBtn.setAttribute('aria-current', 'page');
    mastodonBtn.removeAttribute('aria-current');
    mastodonApiUi.style.display = 'none';

    // render list
    document.getElementById('dbui').style.display = 'flex';
  }
  else if (site == SITE.MASTODON) {
    
    if (twitterBtn.classList.contains('active')) {
      twitterBtn.classList.remove('active');
    }

    mastodonBtn.classList.add('active');
    twitterBtn.removeAttribute('aria-current');
    mastodonBtn.setAttribute('aria-current', 'page');
    
    MASTODON.render();
    mastodonApiUi.style.display = 'block';
  }
  else {
    return;
  }

  resetPage();
  resetFilters();
}

// show/hide the filter option buttons (only used by twitter)
const setChoiceFilterVisibility = function() {
  const canChoiceFilter = choiceFiltersApply();

  Array.from(document.getElementsByClassName("choiceFilterCell")).forEach(function(td) {
    if (canChoiceFilter) {
      td.style.display = "table-cell";
    }
    else {
      td.style.display = "none";
    }
  });
}

/************************/
// Mastodon events
/************************/

document.getElementById('mdonLaunchAuthBtn').onclick = function(event) {
  MASTODON.launchAuth();
  return false;
};

document.getElementById('mdonAcceptAuthBtn').onclick = function(event) {
  MASTODON.userSubmittedAuthCode();
  return false;
};

document.getElementById('mdonDisconnect').onclick = function(event) {
  MASTODON.disconnect();
  return false;
};
document.getElementById('mdonDisconnect2').onclick = function(event) {
  MASTODON.disconnect();
  return false;
};

document.getElementById('mdonDownloadFollowingListBtn').onclick = function(event) {
  MASTODON.downloadConnections(CONN_DIRECTION.FOLLOWING);
  return false;
};

document.getElementById('mdonDownloadFollowersListBtn').onclick = function(event) {
  MASTODON.downloadConnections(CONN_DIRECTION.FOLLOWERS);
  return false;
};

document.getElementById('mdonStopDownloadBtn').onclick = function(event) {
  MASTODON.abortPaging();
  return false;
};

txtRemoteMdon.addEventListener('keydown', function(event) {
  if (event.key === "Backspace" || event.key === "Delete") {
    _deletingMdonRemoteOwner = true;
  }
  else {
    _deletingMdonRemoteOwner = false;
  }
});

const mdonAccountRemoteSearch = ES6.debounce((event) => {
  const userInput = txtRemoteMdon.value || '';

  // min 5 characters to search
  if (!userInput || userInput.length < 5) {
    MASTODON.initRemoteOwnerPivotPicker(true);
  }
  
  MASTODON.suggestRemoteAccountOwner(userInput);
}, 250);
// ... uses debounce
txtRemoteMdon.addEventListener('input', mdonAccountRemoteSearch);

// choose owner from typeahead results
mdonRemoteOwnerPivotPicker.onclick = function(event) {
  txtRemoteMdon.value = handleFromClickedOwner(event);
  MASTODON.onChooseRemoteOwner();
};
