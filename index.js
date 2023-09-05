// hollow if not favorited
const _starOffCls = 'bi-star';
const _starOnCls = 'bi-star-fill'

// avoid double-submit
var _lastRenderedRequest = '';

// improves experience of deleting in owner textbox
var _deletingOwner = false;
var _deletingMdonRemoteOwner = false;

// so we can reduce how many times we ask for (expensive) total counts
var _counterSet = new Set();
var _counters = [];

// for export
var _exportStopRequested;

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

// each time this page loads/refreshes, we make sure background tasks are running (as needed) for offscreen scraping
chrome.runtime.sendMessage({ 
  actionType: MSGTYPE.TOBACKGROUND.LETS_SCRAPE
});

// listen for messages (aside from worker messages which are handled separately)
chrome.runtime.onMessage.addListener(handleMessages);
async function handleMessages(message) {
  switch (message.actionType) {
    case MSGTYPE.FROMBG.BG_SCRAPED:
      onScrapedBg(message.parsedUrl);
      break;
    default:
      break;
  }
}

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

const saveSubtopic = function(payload) {
  console.log(payload);
}

// returns back a copy of the saved data
const onCompletedSaveAndDelete = function(payload) {
  switch (payload.onSuccessType) {
    case SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS:
      localStorage.setItem(SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS, Date.now());
      break;
    default:
      // no-op
      break;
  }
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

const getSavableCacheKvps = async function() {
  return await SETTINGS.getCacheKvps(STORAGE_PREFIX.FOR_DB);
}

const ensureCopiedToDb = async function() {
  const kvps = await getSavableCacheKvps();
  
  const xferring = document.getElementById('transferringMsg');
  // if concurrent access becomes a problem, we can revert to hiding the list while importing (for now commented out)
  const filterSet = document.getElementById('listFilterSet');
  xferring.textContent = 'Copying ' + kvps.length + ' pages to local database...';
  if (kvps.length > 0) {
    xferring.style.display = 'inline-block';
    filterSet.style.display = 'none';
  }
  
  // allow sqlite to do process in larger batches than what was cached
  const batches = [];
  const maxBatches = 10;
  const monoMultiplier = 10; // if these aren't arrays, we'll process 100 items instead of 10 array pages
  let ctr = 0;
  let hitArray = false;
  for (let i = 0; i < kvps.length; i++) {
    let kvp = kvps[i];
    batches.push(kvp);
    ctr++;
    
    if (Array.isArray(kvp.val)) {
      hitArray = true;
    }

    if ((hitArray == true && ctr >= maxBatches) || (hitArray == false && ctr >= maxBatches * monoMultiplier)) {
      // come back for more rather than sending massive messages around
      break;
    }
  }
  
  if (batches.length > 0) {
    worker.postMessage( { batches: batches, actionType: MSGTYPE.TODB.XFER_CACHE_TODB } );
  }
  else {
    // if we got to here, we've fully copied into the db
    xferring.style.display = 'none';
    filterSet.style.display = 'flex';

    initialRender();
  }
}

const initialRender = function(leaveHistoryStackAlone) {
  // app version
  document.getElementById('manifestVersion').textContent = chrome.runtime.getManifest().version;
  
  const parms = URLPARSE.getQueryParms();

  let owner = parms[URL_PARM.OWNER];
  let pageType = parms[URL_PARM.PAGE_TYPE];
  let mode = parms[URL_PARM.MODE];
  
  // power user mode (undocumented; exposes some advanced features)
  if (mode) {
    switch (mode) {
      case 'power':
        SETTINGS.setPowerUserMode(true);
        break;
      case 'basic':
        document.getElementById('optImportContextEntities').checked = true;
        SETTINGS.setPowerUserMode(false);
        break;
      default:
        break;
    }
  }

  if (!pageType) {
    pageType = SETTINGS.getCachedPageType();
  }
  
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
  let autoResolveOwner = true;
  pageType = pageType || SETTINGS.getCachedPageType() || PAGETYPE.TWITTER.FOLLOWING;

  switch (pageType) {
    case PAGETYPE.TWITTER.FOLLOWERS:
    case PAGETYPE.MASTODON.FOLLOWERS:
        document.getElementById('cmbType').value = CONN_DIRECTION.FOLLOWERS;
      break;
    case PAGETYPE.TWITTER.FOLLOWING:
    case PAGETYPE.MASTODON.FOLLOWING:
        document.getElementById('cmbType').value = CONN_DIRECTION.FOLLOWING;
      break;
    case PAGETYPE.TWITTER.TWEETS:
    case PAGETYPE.MASTODON.TOOTS:
      document.getElementById('cmbType').value = POSTS;
      autoResolveOwner = false;
      break;
    default:
      break;
  }

  // set owner
  let waitForOwnerCallback = false;
  if (autoResolveOwner) {
    owner = owner || SETTINGS.getCachedOwner();
    
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
  }

  // SEARCH
  txtSearch.value = parms[URL_PARM.SEARCH] || '';

  // PAGING
  let page = parms[URL_PARM.PAGE];
  if (!page || isNaN(page) == true) {
    page = 1;
  }
  txtPageNum.value = page;

  // post toggles
  setOptToggleBtn(optWithRetweets, parms[URL_PARM.WITH_RETWEETS] != false); // default to true

  setOptionVisibility();

  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  if (waitForOwnerCallback === false) {
    executeSearch(owner, leaveHistoryStackAlone);
  }
}

const setOptToggleBtn = function(elm, toggledOn) {
  if (toggledOn == true || toggledOn == 'true') {
    elm.classList.add('toggledOn');
  }
  else {
    elm.classList.remove('toggledOn');
  }
}

const conformQueryStringToUi = function(leaveHistoryStackAlone) {
  const urlParms = new URLSearchParams(document.location.search);
  urlParms.set(URL_PARM.OWNER, getOwnerFromUi() || '');
  urlParms.set(URL_PARM.PAGE_TYPE, getPageType() || '');
  urlParms.set(URL_PARM.SEARCH, getUiValue('txtSearch') || '');
  urlParms.set(URL_PARM.SIZE, SETTINGS.getPageSize() || 50);
  urlParms.set(URL_PARM.PAGE, getPageNum() || 1);
  urlParms.set(URL_PARM.WITH_RETWEETS, getUiValue('optWithRetweets') || false);

  if (!leaveHistoryStackAlone) {
    history.pushState(null, null, "?"+urlParms.toString());
  }
}

// companion to the above pushState so that back button works
window.addEventListener("popstate", (event) => {
  initialRender(true);
});

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
      TOPICS.ensureRemoteTopicSettings(onFetchedRawTopicContent);
      ensureCopiedToDb();
      break;
    case MSGTYPE.FROMDB.COPIED_TODB:
      onCopiedToDb(data.cacheKeys);
      break;
    case MSGTYPE.FROMDB.SAVE_AND_DELETE_DONE:
      onCompletedSaveAndDelete(data.payload);
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
    case MSGTYPE.FROMDB.RENDER.POST_STREAM:
      renderPostStream(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.NETWORK_SIZE:
      renderNetworkSize(data.payload);
      break;
    case MSGTYPE.FROMDB.EXPORT.RETURN_EXPORTED_RESULTS:
      handleExportedResults(data.payload);
      break;
    case MSGTYPE.FROMDB.IMPORT.PROCESSED_SYNC_IMPORT_BATCH:
      onProcessedUploadBatch();
      break;
    case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT:
      onGotSavedCount(data.count, data.pageType, data.metadata);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};

const onFetchedRawTopicContent = function(content) {
  const topics = TOPICS.parseTopics(content);
  TOPICS.cacheTopicsToLocal(topics);
  const sets = TOPICS.buildSets(topics);
  worker.postMessage({
    actionType: MSGTYPE.TODB.EXECUTE_SAVE_AND_DELETE,
    savableSet: sets.savableSet,
    deletableSet: sets.deletableSet,
    onSuccessType: SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS
  });
}

const detailReflectsFilter = function() {
  return getUiValue('optWithMdon') === true || getUiValue('optWithEmail')  === true || getUiValue('optWithUrl') === true;
}

const renderPost = function(post) {
  const pageType = getPageType();
  const site = PAGETYPE.getSite(pageType);
  return RENDER.POST.renderPost(post, site);
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

const onScrapedBg = function(parsedUrl) {
  const msg = `Processed ${STR.friendlyParsedUrl(parsedUrl)}`;
  const elm = document.getElementById('bgStatusMsg');
  elm.textContent = msg;
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
    executeSearch();
  }
}

const getUiValue = function(id) {
  switch (id) {
    case 'txtOwnerHandle':
      return txtOwnerHandle.value;
    case 'txtSearch':
      return txtSearch.value;
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
    case 'optWithRetweets':
      return optWithRetweets.classList.contains('toggledOn');
    default:
      return undefined;
  }
}

const getPageType = function() {
  const site = SETTINGS.getCachedSite();
  const type = document.getElementById('cmbType').value;
  if (type == POSTS) {
    switch (site) {
      case SITE.TWITTER:
        return PAGETYPE.TWITTER.TWEETS;
      case SITE.MASTODON:
        return PAGETYPE.MASTODON.TOOTS;
      default:
        return undefined;
    }
  }
  else {
    return PAGETYPE.getPageType(site, type);
  }
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

// site tab is twitter and clicked to filter to mastodon
const onClickedMdonOption = function() {
  // ensure we prompt for server on first-time click of 'w/ mastodon' without them having to click the gear
  ensureAskedMdonServer();
  
  setOptionVisibility();

  // continue even if user cancelled the chance to input a mdon server
  resetPage();
  executeSearch();  
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

// TO-DO
const getOrderByFromUi = function() {
  const pageType = getPageType();
  switch (pageType) {
    case PAGETYPE.TWITTER.TWEETS:
    case PAGETYPE.MASTODON.TOOTS:
      return ORDER_BY.POST_TIME_DESC;
    default:
      return ORDER_BY.HANDLE;
  }
}

const buildSearchRequestFromUi = function() {
  const owner = STR.ensurePrefix(getOwnerFromUi(), '@');  // prefixed in the db
  const pageType = getPageType();
  const site = PAGETYPE.getSite(pageType);
  const pageSize = SETTINGS.getPageSize();
  const searchText = getUiValue('txtSearch');
  const skip = calcSkip();
  const mutual = getUiValue('chkMutual');
  const favorited = getUiValue('chkFavorited');
  const withRetweets = getUiValue('optWithRetweets');

  // conditional filters
  let withUrl = getUiValue('optWithUrl');
  let withMdon = site == SITE.TWITTER ? getUiValue('optWithMdon') : false;
  let withEmail = site == SITE.TWITTER ? getUiValue('optWithEmail') : false;
  
  // if haven't yet clicked to the mastodon tab, we might still only have the cached mdon user
  let myMastodonHandle = _mdonConnectedUser ? _mdonConnectedUser.Handle : undefined;
  myMastodonHandle = myMastodonHandle || (_mdonRememberedUser ? _mdonRememberedUser.Handle : undefined);

  const mdonFollowing = ES6.TRISTATE.getValue(chkMdonImFollowing);
  
  const orderBy = getOrderByFromUi();

  const msg = { 
    actionType: MSGTYPE.TODB.EXECUTE_SEARCH, 
    pageType: pageType,
    site: site,
    networkOwner: owner, 
    searchText: searchText, 
    orderBy: orderBy,
    skip: skip,
    take: pageSize,
    // post filters
    withRetweets: withRetweets,
    // conn filters
    mutual: mutual,
    list: LIST_FAVORITES,
    requireList: favorited,
    withMdon: withMdon,
    withEmail: withEmail,
    withUrl: withUrl,
    myMastodonHandle: myMastodonHandle,
    mdonFollowing: mdonFollowing
  };
  
  return msg;
}

const showSearchProgress = function(showProgressBar) {
  const progressElm = document.getElementById('connListProgress');
  const continuePaging = document.getElementById('continuePaging');
  if (showProgressBar === true) {
    progressElm.style.visibility = 'visible';
    continuePaging.style.display = 'none';
  }
  else {
    progressElm.style.visibility = 'hidden';
    // see if there are any list elements
    const listElmCount = Array.from(document.querySelectorAll('#paginated-list div')).length;
    continuePaging.style.display = listElmCount > 0 ? 'block' : 'none';
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
      displayTotalCount(counter.value);
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

const executeSearch = function(forceRefresh, leaveHistoryStackAlone) {
  conformQueryStringToUi(leaveHistoryStackAlone);
  const msg = buildSearchRequestFromUi();
  const requestJson = JSON.stringify(msg);
  
  SETTINGS.cachePageState(msg);

  if (!forceRefresh && _lastRenderedRequest === requestJson) {
    // we already have this rendered; avoid double-submission
    return;
  }
  
  if (forceRefresh) {
    // ensure that the follow count is re-requested
    clearCachedCountForCurrentRequest();
  }

  showSearchProgress(true);
  worker.postMessage(msg);
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
  displayTotalCount(count);
}

const initMainListUiElms = function() {
  document.getElementById('paginated-list').replaceChildren();
  document.getElementById('listOwnerPivotPicker').replaceChildren();
  clearTotalCount();

  const pageGearTip = `Page size is ${SETTINGS.getPageSize()}. Click to modify.`;
  document.getElementById('pageGear').setAttribute("title", pageGearTip);
}

const canRenderMastodonFollowOneButtons = function() {
  const site = SETTINGS.getCachedSite();
  const mdonMode = getUiValue('optWithMdon');
  return site === SITE.MASTODON || mdonMode === true;
}

const renderPostStream = function(payload) {
  initMainListUiElms();
  const plist = document.getElementById('paginated-list');
  let html = '';
  // rows
  const rows = payload.rows;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
      // renderPost uses DOMPurify.sanitize
      html += renderPost(row);
  }

  plist.innerHTML = html;
  showSearchProgress(false);
  onAddedRows(plist);

  _lastRenderedRequest = JSON.stringify(payload.request);
}

const renderConnections = function(payload) {
  initMainListUiElms();
  const plist = document.getElementById('paginated-list');
  let html = '';

  // rows
  const rows = payload.rows;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
      // renderPerson uses DOMPurify.sanitize
      html += renderPerson(row, 'followResult');
  }

  plist.innerHTML = html;

  IMAGE.resolveDeferredLoadImages(plist);
  if (canRenderMastodonFollowOneButtons() === true) {
    MASTODON.renderFollowOnMastodonButtons(plist);
  }
  
  showSearchProgress(false);
  onAddedRows(plist);
  requestTotalCount();
  
  _lastRenderedRequest = JSON.stringify(payload.request);
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

const onAddedRows = function(container) {
  // tag & rate
  Array.from(container.getElementsByClassName('postScoredTagger')).forEach(elm => RENDER.POST.TAGGING.configureTagAndRate(elm));
  // simple favoriting
  Array.from(container.getElementsByClassName("canstar")).forEach(a => configureFavoriting(a));
}

// public variables for filter elements that we'll attach events to etc.
ES6.TRISTATE.initAll();

const txtOwnerHandle = document.getElementById('txtOwnerHandle');
const listOwnerPivotPicker = document.getElementById('listOwnerPivotPicker');
const followSearch = document.getElementById('txtSearch');
const txtPageNum = document.getElementById('txtPageNum');

// FILTERS
// cell (1,1)
const chkMutual = document.getElementById('chkMutual');

// cell (1,2) conditional
// twitter shows Mastodon radio button until it's clicked (then swaps it for I'm following on Mastodon tri-state checkbox)
const optWithMdon = document.getElementById('optWithMdon');
// mastodon always shows the tri-state checkbox
const chkMdonImFollowing = document.getElementById('chkMdonImFollowing');

// cell (1,3) conditional
// twitter shows email option until Mastodon is clicked (then swaps it for Follow on Mastodon! button)
const optWithEmail = document.getElementById('optWithEmail');

// cell (2,1)
const chkFavorited = document.getElementById('chkFavorited');
// cell (2,2)
const optWithUrl = document.getElementById('optWithUrl');
// cell (2,3)
const optClear = document.getElementById('optClear');

// post option buttons
const optWithRetweets = document.getElementById('optWithRetweets');

// mastodon account typeahead hitting api
const txtRemoteMdon = document.getElementById('txtMdonDownloadConnsFor');
const mdonRemoteOwnerPivotPicker = document.getElementById('mdonRemoteOwnerPivotPicker');

document.getElementById('cmbType').addEventListener('change', (event) => {
  resetPage();
  setOptionVisibility();
  executeSearch();
});

chkMutual.addEventListener('change', (event) => {
  resetPage();
  executeSearch();
});
chkFavorited.addEventListener('change', (event) => {
  resetPage();
  executeSearch();
});
optWithMdon.addEventListener('change', (event) => {
  onClickedMdonOption();
});
optWithEmail.addEventListener('change', (event) => {
  resetPage();
  executeSearch();
});
optWithUrl.addEventListener('change', (event) => {
  setOptionVisibility();
  resetPage();
  executeSearch();
});
chkMdonImFollowing.addEventListener('change', (event) => {
  resetPage();
  executeSearch();
});
optClear.addEventListener('change', (event) => {
  setOptionVisibility();
  resetPage();
  executeSearch();
});

optWithRetweets.onclick = function(event) {
  optWithRetweets.classList.toggle('toggledOn');
  executeSearch();
  return false;
};

// searching
const handleTypeSearch = ES6.debounce((event) => {
  resetPage();
  executeSearch();
}, 250);
// ... uses debounce
followSearch.addEventListener('input', handleTypeSearch);

// hit enter on page number
txtPageNum.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    executeSearch();
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
  switch (pageType) {
    case PAGETYPE.TWITTER.TWEETS:
    case PAGETYPE.MASTODON.TOOTS:
      if (!userInput || userInput.length === 0) {
        // we aren't interested to show the auto-furled top-5 list with tweets because it's not worth it relative to the trouble of clearing the choices (no ui element for that yet)
        listOwnerPivotPicker.replaceChildren();
        executeSearch();
        return;
      }
      break;
    default:
      break;
  }

  worker.postMessage({
    actionType: MSGTYPE.TODB.INPUT_OWNER,
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
    executeSearch();
  }
  return false;
};

const navToNextPage = function() {
  const pageNum = getPageNum();
  txtPageNum.value = pageNum + 1;
  executeSearch();
}

document.getElementById('nextPage').onclick = function(event) {
  navToNextPage();
  return false;
};
document.getElementById('continuePaging').onclick = function(event) {
  navToNextPage();
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
      executeSearch();
    }
  }
  return false;
};

document.getElementById('mdonGear').onclick = function(event) {
  const mdonServer = confirmMdonServer();
  
  if (mdonServer != null) {
    // re-render
    optWithMdon.checked = true;
    executeSearch();
  }
  return false;
};

// choose owner from typeahead results
listOwnerPivotPicker.onclick = function(event) {
  txtOwnerHandle.value = handleFromClickedOwner(event);
  onChooseOwner();
};

const clearTotalCount = function() {
  document.getElementById('txtSearch').setAttribute('placeholder', 'search...');
}

const displayTotalCount = function(count) {
  document.getElementById('txtSearch').setAttribute('placeholder', `search (${count} total)...`);
}

const onChooseOwner = function() {
  // when owner changes, we need to reset the counts and then request a refreshed count
  clearTotalCount();
  listOwnerPivotPicker.replaceChildren();
  resetPage();
  executeSearch();
}

/************************/
// Upload/Import 
// smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/
/************************/
document.getElementById('startImportBtn').onclick = function(event) {
  document.getElementById('uploadui').style.display = 'block';
  document.getElementById('exportui').style.display = 'none';
  document.getElementById('startImportBtn').style.display = 'none';
  document.getElementById('stopImportBtn').style.display = 'inline-block';
  updateUploadDoneBtnText();
  stopExport();
  document.getElementById('dbui').style.display = 'none';
  document.getElementById('mdonDownloadConnsUi').style.display = 'none';

  if (SETTINGS.getPowerUserMode() == 'true') {
    document.getElementById('powerUserImport').style.display = 'block';
  }

  return false;
};
  
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

const handleUploadFiles = function(files) {
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

const getUploadContext = function() {
  if (document.getElementById('optImportContextTwitterProfilesToScrape').checked == true) {
    return UPLOAD_CONTEXT.TWITTER_PROFILES_TO_SCRAPE;
  }
  else {
    return UPLOAD_CONTEXT.ENTITIES_TO_IMPORT;
  }
}

// stackoverflow.com/questions/24886628/upload-file-inside-chrome-extension
const processUpload = function(file) {
  const reader = new FileReader();

  // set the event for when reading completes
  reader.onload = function(e) {
    const uploadedCntElem = document.getElementById('uploadedCnt');
    uploadedCntElem.innerText = parseInt(uploadedCntElem.innerText) + 1;
    updateUploadDoneBtnText();
    
    const uploadContext = getUploadContext();
    if (uploadContext == UPLOAD_CONTEXT.ENTITIES_TO_IMPORT) {
      worker.postMessage({
        actionType: MSGTYPE.TODB.ON_RECEIVED_SYNCABLE_IMPORT,
        json: e.target.result
      });
    }

    onProcessedUploadBatch();
  }

  // start reading
  reader.readAsText(file);
}

const onProcessedUploadBatch = function() {
  const processedCntElem = document.getElementById('uploadProcessedCnt');
  processedCntElem.innerText = parseInt(processedCntElem.innerText) + 1;
  updateUploadDoneBtnText();
}

const updateUploadDoneBtnText = function() {
  const uploadedCnt = parseInt(document.getElementById('uploadedCnt').innerText);
  const processedCnt = parseInt(document.getElementById('uploadProcessedCnt').innerText);
  const btnElem = document.getElementById('uploadDone');

  if (uploadedCnt > 0 && processedCnt >= uploadedCnt) {
    btnElem.innerText = 'Done!';
  }
  else {
    btnElem.innerText = 'Close';
  }
}

/************************/
// Export
/************************/

document.getElementById('showExportUiBtn').onclick = function(event) {
  showExportUi();
  return false;
};

document.getElementById('btnCancelExport').onclick = function(event) {
  stopExport();
  return false;
};
document.getElementById('stopExportBtn').onclick = function(event) {
  stopExport();
  return false;
};

document.getElementById('btnConfirmExport').onclick = function(event) {
  startExport();
  return false;
};

const initiallySelectExportWhatAll = function() {
  const exportWhatDetail = document.getElementById('exportWhatDetail');
  const subOptions = Array.from(exportWhatDetail.querySelectorAll(`input[type=checkbox]`));
  subOptions.forEach(function(elm) {
    elm.checked = true;
  });
}

const showExportUi = function() {
  const site = SETTINGS.getCachedSite();
  document.getElementById('optExportWhomActiveSiteOnlyLabel').textContent = site;

  document.getElementById('optExportWhomActiveAccountFollowingOnlyLabel').textContent = `Followed by ${SETTINGS.getCachedOwner()}`;
  document.getElementById('optExportWhomActiveAccountFollowersOnlyLabel').textContent = `Followers of ${SETTINGS.getCachedOwner()}`;

  document.getElementById('optExportWhomAll').checked = true;
  document.getElementById('optExportWhenAll').checked = true;
  initiallySelectExportWhatAll();

  document.getElementById('exportui').style.display = 'flex';
  document.getElementById('btnConfirmExport').style.display = 'inline-block';

  document.getElementById('uploadui').style.display = 'none';
  document.getElementById('dbui').style.display = 'none';
  document.getElementById('mdonDownloadConnsUi').style.display = 'none';

  document.getElementById('showExportUiBtn').style.display = 'none';
  document.getElementById('stopExportBtn').style.display = 'inline-block';
}

const buildExportRequest = function() {
  
  let direction = undefined;
  let site = undefined;
  let owner = undefined;
  if (document.getElementById('optExportWhomActiveAccountFollowingOnly').checked) {
    site = SETTINGS.getCachedSite();
    direction = CONN_DIRECTION.FOLLOWING;
    owner = SETTINGS.getCachedOwner();
  }
  else if (document.getElementById('optExportWhomActiveAccountFollowersOnly').checked) {
    site = SETTINGS.getCachedSite();
    direction = CONN_DIRECTION.FOLLOWERS;
    owner = SETTINGS.getCachedOwner();
  }
  else if (document.getElementById('optExportWhomActiveSiteOnly').checked) {
    site = SETTINGS.getCachedSite();
  }
  
  let siteFilter = site ? CONN_EXPORT_HELPER.justThisSiteFilter(site) : undefined;

  let hoursAgo = undefined;
  if (document.getElementById('optExportWhenLastWeek').checked) {
    hoursAgo = 24 * 7;
  }
  else if (document.getElementById('optExportWhenLastDay').checked) {
    hoursAgo = 24;
  }
  else if (document.getElementById('optExportWhenLastHour').checked) {
    hoursAgo = 1;
  }

  const hoursAgoFilter = hoursAgo ? CONN_EXPORT_HELPER.recentlyModifiedFilter(hoursAgo) : undefined;

  let entities = [
      // not in use yet
      //APPSCHEMA.SocialConnection,
      //APPSCHEMA.SocialSourceIdentifier,
      // always exported
      APPSCHEMA.SocialListMember
    ];

  if (document.getElementById('optExportWhatFollowers').checked) {
    entities.push(APPSCHEMA.SocialConnHasFollower);
  }
  if (document.getElementById('optExportWhatFollowing').checked) {
    entities.push(APPSCHEMA.SocialConnIsFollowing);
  }
  if (document.getElementById('optExportDisplayNames').checked) {
    entities.push(APPSCHEMA.SocialProfileDisplayName);
  }
  if (document.getElementById('optExportProfileDescriptions').checked) {
    entities.push(APPSCHEMA.SocialProfileDescription);
  }
  if (document.getElementById('optExportProfileLinks').checked) {
    entities.push(APPSCHEMA.SocialProfileLinkMastodonAccount);
    entities.push(APPSCHEMA.SocialProfileLinkExternalUrl);
    entities.push(APPSCHEMA.SocialProfileLinkEmailAddress);
  }
  if (document.getElementById('optExportPhotos').checked) {
    entities.push(APPSCHEMA.SocialProfileImgSourceUrl);
    entities.push(APPSCHEMA.SocialProfileImgBinary);
  }
  if (document.getElementById('optFollowerCounts').checked) {
    entities.push(APPSCHEMA.SocialFollowerCount);
    entities.push(APPSCHEMA.SocialFollowingCount);
  }

  const filterSet = {};

  if (siteFilter) {
    // filter by graph
    filterSet.siteFilter = siteFilter;
  }
  if (hoursAgoFilter) {
    // filter by timestamp
    filterSet.hoursAgoFilter = hoursAgoFilter;
  }

  // indicate relevant entities and the join/where needed to apply related filters
  filterSet.entitiesFilter = []; 
  
  entities.forEach(function(e) {
    filterSet.entitiesFilter.push(CONN_EXPORT_HELPER.entityFilter(e, owner, direction));
  });
  
  return {
    actionType: MSGTYPE.TODB.EXPORT_BACKUP,
    exportTimeMs: Date.now(),
    filterSet: filterSet
  };
}

const startExport = function() {
  
  const msg = buildExportRequest();

  _exportStopRequested = false;

  // at top right
  document.getElementById('showExportUiBtn').style.display = 'none';
  document.getElementById('stopExportBtn').style.display = 'inline-block';
  
  // within the form
  document.getElementById('btnConfirmExport').style.display = 'none';

  worker.postMessage(msg);
}

const stopExport = function() {
  _exportStopRequested = true;
  document.getElementById('showExportUiBtn').innerText = 'Export';
  document.getElementById('showExportUiBtn').style.display = 'inline-block';
  document.getElementById('stopExportBtn').style.display = 'none';
  document.getElementById('exportui').style.display = 'none';
  document.getElementById('dbui').style.display = 'flex';
  document.getElementById('mdonDownloadConnsUi').style.display = 'block';
}

const handleExportedResults = function(payload) {
  // for now, we download to json (later, we could push to user's github etc)
  const result = payload.result;
  const start = result.skip + 1;
  const end = result.skip + result.rows.length;
  const fileName = `${result.entity}-${result.exportTimeMs}-${start}-${end}.json`;
  const json = JSON.stringify(result, null, 2);
  
  if (result.rows.length > 0) {
    RENDER.saveTextFile(json, fileName);
  }
  
  // kick off next page if appropriate
  if (!payload.done) {
    const msg = {
      actionType: MSGTYPE.TODB.EXPORT_BACKUP,
      nextEntity: payload.nextEntity,
      nextSkip: payload.nextSkip,
      nextTake: payload.nextTake,
      filterSet: payload.filterSet
    };

    if (!_exportStopRequested) {
      worker.postMessage(msg);
    }
  }
  else {
    _exportStopRequested = false;

    document.getElementById('showExportUiBtn').innerText = 'Export Again';
    document.getElementById('showExportUiBtn').style.display = 'inline-block';
    document.getElementById('stopExportBtn').style.display = 'none';
    document.getElementById('exportui').style.display = 'none';
    document.getElementById('dbui').style.display = 'flex';
    document.getElementById('mdonDownloadConnsUi').style.display = 'block';
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
    executeSearch();
  }

  return false;
};

document.getElementById('mastodonLensBtn').onclick = function(event) {
  activateMastodonTab();
  return false;
};

const activateMastodonTab = function() {
  const site = SETTINGS.getCachedSite();

  if (site != SITE.MASTODON) {
    SETTINGS.cacheSite(SITE.MASTODON);
    updateForSite();
    executeSearch();
  }
}

const updateForSite = function() {
  stopExport();
  
  const site = SETTINGS.getCachedSite();
  // clear what's there now
  initMainListUiElms();
  _lastRenderedRequest = '';
  
  const owner = SETTINGS.getCachedOwner(site);
  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  const twitterBtn = document.getElementById('twitterLensBtn');
  const mastodonBtn = document.getElementById('mastodonLensBtn');
  const mastodonApiUi = document.getElementById('mdonApiUi');

  setOptionVisibility();

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

const setOptionVisibility = function() {
  setConnOptionVisibility();
  setPostOptionVisibility();
}

const setPostOptionVisibility = function() {
  const queryOptions = document.getElementById('postQueryOptions');
  const cmbType = document.getElementById('cmbType');

  if (cmbType.value != POSTS) {
    queryOptions.style.display = 'none';
    return;
  }
  
  queryOptions.style.display = 'block';
}

const setConnOptionVisibility = function() {
  const queryOptions = document.getElementById('connQueryOptions');
  const cmbType = document.getElementById('cmbType');

  if (cmbType.value == POSTS) {
    queryOptions.style.display = 'none';
    return;
  }
  
  queryOptions.style.display = 'block';

  // default to undefined (no filter applied) for the tri-state
  const chkMdonImFollowing = document.getElementById('chkMdonImFollowing');
  ES6.TRISTATE.setValue(chkMdonImFollowing, undefined);

  const pageType = getPageType();
  const site = PAGETYPE.getSite(pageType);
  const mdonMode = getUiValue('optWithMdon');

  const filterTwitterWithMdonLink = document.getElementById('filterTwitterWithMdonLink');
  const filterMdonImFollowing = document.getElementById('filterMdonImFollowing');
  const filterWithEmail = document.getElementById('filterWithEmail');
  const btnFollowAllOnMastodon = document.getElementById('btnFollowAllOnMastodon');
  const optPosts = document.getElementById('optPosts');

  if (site === SITE.MASTODON || mdonMode === true) {
    // cell (1,2) switches from the Mastodon radio button (which is already true) to the 'Where I'm following' filter
    filterTwitterWithMdonLink.style.display = 'none';
    filterMdonImFollowing.style.display = 'block';
    // cell (1,3) switches from 'w/ Email' to the 'Follow on Mastodon!' button
    filterWithEmail.style.display = 'none';
    btnFollowAllOnMastodon.style.display = 'inline-block';
    optPosts.style.display = 'none';
  }
  else {
    filterTwitterWithMdonLink.style.display = 'block';
    filterMdonImFollowing.style.display = 'none';
    filterWithEmail.style.display = 'block';
    btnFollowAllOnMastodon.style.display = 'none';
    optPosts.style.display = 'inline';
  }
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

document.getElementById('btnFollowAllOnMastodon').onclick = function(event) {
  if (!_mdonRememberedUser || !_mdonRememberedUser.Handle) {
    activateMastodonTab();
  }
  else {
    MASTODON.followAllVisibleMastodonAccounts();
  }

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

document.getElementById('clearMdonCacheBtn').onclick = function(event) {
  MASTODON.disconnect(true);
  return false;
};
