// avoid double-submit
var _lastRenderedRequest = '';
var _docLocSearch = '';

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
  let elm = document.getElementById('logMsgSection')
  
  if (!elm) { 
    elm = document.createElement('div') 
    elm.append(document.createTextNode(args.join(' ')));
    document.body.append(elm);
  }
  else {
    elm.classList.remove('d-none');
    elm.textContent = args.join('\n');
  }
  
  if (cssClass) elm.classList.add(cssClass);
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

// returns back a copy of the saved data
const onCompletedSaveAndDelete = function(payload) {
  switch (payload.onSuccessType) {
    case SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS:
      localStorage.setItem(SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS, Date.now());
      break;
    case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_POST_TAG:
      TAGGING.POSTS.onTaggingSuccess(payload);
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

const ensureInUseTopicsFilter = function() {
  worker.postMessage({
    actionType: MSGTYPE.TODB.GET_INUSE_TOPICS
  });
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

    await initialRender();
  }
}

const initialRender = async function(leaveHistoryStackAlone) {
  // app version
  document.getElementById('manifestVersion').textContent = chrome.runtime.getManifest().version;

  // ensure _topicTags are in place
  RENDER.POST.TAGGING.initTopicTags();
  // now render the combobox dropdown
  renderTopicFilterChoices();
  
  const parms = URLPARSE.getQueryParms();

  let owner = parms[URL_PARM.OWNER];
  let pageType = parms[URL_PARM.PAGE_TYPE];
  let topic = parms[URL_PARM.TOPIC];
  let threadUrlKey = parms[URL_PARM.THREAD];

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
      document.getElementById('cmbType').value = POSTS;
      autoResolveOwner = false;
      break;
    case PAGETYPE.MASTODON.TOOTS:
      // TEMPORARY - until mastodon toots are ready    
      document.getElementById('cmbType').value = CONN_DIRECTION.FOLLOWING; // POSTS;
      autoResolveOwner = false;
      break;
    case PAGETYPE.GITHUB.CONFIGURE:
    case PAGETYPE.GITHUB.BACKUP:
    case PAGETYPE.GITHUB.RESTORE:
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
  // WITH_RETWEETS
  setOptToggleBtn(optWithRetweets, parms[URL_PARM.WITH_RETWEETS] != 'false'); // default to true

  // TOPIC
  setOptToggleBtn(optGuessTopics, parms[URL_PARM.GUESS_TOPICS] == 'true'); // default to false
  setTopicFilterVisibility();
  setTopicFilterChoiceInUi(topic);
  // THREAD
  setOneThreadState(threadUrlKey);
  // post sort
  setTopicSortInUi();

  setOptionVisibility();

  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  if (waitForOwnerCallback === false) {
    
    switch (site) {
      case SITE.GITHUB:
        await activateGithubTab(pageType);
        _docLocSearch = document.location.search; // aids our popstate behavior
        break;
      default:
        executeSearch(owner, leaveHistoryStackAlone, topic);
        break;
    }
  }
}

const renderTopicFilterChoices = function() {
  let choices = [];
  choices.push(CMB_SPECIAL.TAG_FILTER_BY);
  choices.push(..._topicTags);
  
  let html = '';
  for (let i = 0; i < choices.length; i++) {
    let tag = choices[i];
    // the "-- clear selection --" option should always be visible
    let cls = i == 0 || _inUseTags.has(tag) ? '' : ` class='d-noneif'`;
    html = STR.appendLine(html, `<option value='${i - 1}'${cls}>${tag}</option>`);
  }
  html = DOMPurify.sanitize(html);
  cmbTopicFilter.innerHTML = html;
}

const setTopicSortInUi = function() {
  const byStars = SETTINGS.getSortByStars();
  
  if (byStars == true) {
    optSortByStars.classList.add('toggledOn');
  }
  else {
    optSortByStars.classList.remove('toggledOn');
  }
}

const setTopicFilterChoiceInUi = function(topic) {
  let intVal = -1;
  const tags = _topicTags;
  for (let i = 0; i < tags.length; i++) {
    let tag = tags[i];
    if (topic == tag) {
      intVal = i;
      break;
    }
  }

  cmbTopicFilter.value = intVal;
  setTopicFilterModeInUi();
}

const setTopicFilterModeInUi = function() {
  const container = document.getElementById('mainContainer');
  const topic = getTopicFilterChoiceFromUi();
  
  if (STR.hasLen(topic)) {
    container.classList.add('oneTopic');
  }
  else {
    container.classList.remove('oneTopic');
  }
}

const getTopicFilterChoiceFromUi = function() {
  const intValue = parseInt(cmbTopicFilter.value);
  if (!isNaN(intValue) && intValue > -1 && _topicTags.length >= intValue + 1) {
    return _topicTags[intValue];
  }
  else {
    return null;
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

const conformQueryStringToUi = function(leaveHistoryStackAlone, topic) {
  const urlParms = new URLSearchParams(document.location.search);
  urlParms.set(URL_PARM.OWNER, getOwnerFromUi() || '');
  urlParms.set(URL_PARM.PAGE_TYPE, getPageType() || '');
  urlParms.set(URL_PARM.SEARCH, getUiValue('txtSearch') || '');
  urlParms.set(URL_PARM.SIZE, SETTINGS.getPageSize() || 50);
  urlParms.set(URL_PARM.PAGE, getPageNum() || 1);
  urlParms.set(URL_PARM.WITH_RETWEETS, getUiValue('optWithRetweets') || false);
  urlParms.set(URL_PARM.GUESS_TOPICS, getUiValue('optGuessTopics') || false);
  urlParms.set(URL_PARM.TOPIC, topic || getUiValue('cmbTopicFilter') || '');
  urlParms.set(URL_PARM.THREAD, getUiValue('threadUrlKey') || '');

  if (!leaveHistoryStackAlone) {
    history.pushState(null, null, "?"+urlParms.toString());
  }

  _docLocSearch = document.location.search;
}

// companion to the above pushState so that back button works
window.addEventListener("popstate", async function(event) {
  if (_docLocSearch != document.location.search) {
    await initialRender(true);
  }
});

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
// receive messages from worker
worker.onmessage = async function ({ data }) {
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
      ensureInUseTopicsFilter();
      await ensureCopiedToDb();
      break;
    case MSGTYPE.FROMDB.COPIED_TODB:
      await onCopiedToDb(data.cacheKeys);
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
    case MSGTYPE.FROMDB.RENDER.INUSE_TOPICS:
      _inUseTags = new Set(data.payload);
      adjustTopicFilterVizWhen();
      break;
    case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT:
      onGotSavedCount(data.count, data.pageType, data.metadata);
      break;
    case MSGTYPE.FROMDB.ON_FETCHED_FOR_BACKUP:
      await SYNCFLOW.onFetchedForBackup(data.pushable);
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
    case 'optGuessTopics':
      return optGuessTopics.classList.contains('toggledOn');
    case 'optSortByStars':
      return optSortByStars.classList.contains('toggledOn');
    case 'cmbTopicFilter':
      return getTopicFilterChoiceFromUi();
    case 'threadUrlKey':
      return document.getElementById('mainContainer').getAttribute('data-testid') || '';
    default:
      return undefined;
  }
}

const getPageType = function() {
  const site = SETTINGS.getCachedSite();

  if (site == SITE.GITHUB) {
    return getActiveSyncTabPageType();
  }
  else {
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

const getOrderByFromUi = function(threadUrlKey, topic) {
  const pageType = getPageType();
  switch (pageType) {
    case PAGETYPE.TWITTER.TWEETS:
    case PAGETYPE.MASTODON.TOOTS:
      if (STR.hasLen(threadUrlKey)) {
        // thread-view shows oldest first
        return ORDER_BY.POST_TIME_ASC;
      }
      else if (STR.hasLen(topic)) {
        if (SETTINGS.getSortByStars() == true) {
          return ORDER_BY.POST_RATING;
        }
        else {
          return ORDER_BY.POST_TIME_DESC;
        }
      }
      else {
        // default
        return ORDER_BY.POST_TIME_DESC;
      }
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
  const guessTopics = getUiValue('optGuessTopics');

  const threadUrlKey = URLPARSE.getQueryParm(URL_PARM.THREAD) || '';

  // conditional filters
  let withUrl = getUiValue('optWithUrl');
  let withMdon = site == SITE.TWITTER ? getUiValue('optWithMdon') : false;
  let withEmail = site == SITE.TWITTER ? getUiValue('optWithEmail') : false;
  
  // if haven't yet clicked to the mastodon tab, we might still only have the cached mdon user
  let myMastodonHandle = _mdonConnectedUser ? _mdonConnectedUser.Handle : undefined;
  myMastodonHandle = myMastodonHandle || (_mdonRememberedUser ? _mdonRememberedUser.Handle : undefined);

  const mdonFollowing = ES6.TRISTATE.getValue(chkMdonImFollowing);

  const topic = getUiValue('cmbTopicFilter');

  const orderBy = getOrderByFromUi(threadUrlKey, topic);

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
    guessTopics: guessTopics,
    topic: topic,
    threadUrlKey: threadUrlKey,
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

// topic dropdown isn't populated yet on initial render, which is why that can get passed in
const executeSearch = function(forceRefresh, leaveHistoryStackAlone, topic) {
  conformQueryStringToUi(leaveHistoryStackAlone, topic);
  
  const msg = buildSearchRequestFromUi();
  if (STR.hasLen(topic)) {
    msg.topic = topic;
  }

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
  _docLocSearch = document.location.search; // aids our popstate behavior
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
  const owner = getUiValue('txtOwnerHandle');
  if (STR.hasLen(owner)) {
    optWithRetweets.style.display = 'inline-block';
  }
  else {
    optWithRetweets.style.display = 'none';
  }
  
  document.getElementById('paginated-list').replaceChildren();
  document.getElementById('listOwnerPivotPicker').replaceChildren();
  document.getElementById('txtSearch').setAttribute('placeholder', 'search...');

  const pageGearTip = `Page size is ${SETTINGS.getPageSize()}. Click to modify.`;
  document.getElementById('pageGear').setAttribute("title", pageGearTip);
}

const canRenderMastodonFollowOneButtons = function() {
  const site = SETTINGS.getCachedSite();
  const mdonMode = getUiValue('optWithMdon');
  return site === SITE.MASTODON || mdonMode === true;
}

const adjustTopicFilterVizWhen = function() {
  const options = Array.from(cmbTopicFilter.querySelectorAll('option'));
  options.forEach(function(option) {
    let intVal = option.value;
    // visibility
    if (intVal < 0 || _inUseTags.has(_topicTags[intVal])) {
      option.classList.remove('d-noneif');
    }
    else {
      option.classList.add('d-noneif');
    }
  });
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

const configureGetEmbeddedVideo = function(a) {
  a.onclick = function(event) {
    const postUrlKey = RENDER.POST.getPostUrlKey(a);
    const videoRes = SETTINGS.RECORDING.VIDEO_EXTRACTION.getPreferredVideoRes();
    const squidlrUrl = STR.buildSquidlrUrl(postUrlKey, videoRes, true);
    window.open(squidlrUrl, '_blank');
    a.querySelector('span').textContent = 'Video launched and downloaded in a separate tab. Next time, try "Extract Videos" from our popup menu and then use the Backups -> Upload Videos feature.';
    a.classList.remove('fw-bold');
    a.classList.add('small');
    return false;
  }
}

const onAddedRows = function(container) {
  const pageType = getPageType();
  // tag & rate
  Array.from(container.getElementsByClassName('postScoredTagger')).forEach(elm => RENDER.POST.TAGGING.configureTagAndRate(elm, pageType));
  Array.from(container.getElementsByClassName('postAnotherTag')).forEach(elm => RENDER.POST.TAGGING.configureAddAnotherTag(elm, pageType));
  // view thread
  Array.from(container.getElementsByClassName('btnViewThread')).forEach(elm => configureViewThread(elm));
  // simple favoriting
  Array.from(container.getElementsByClassName("canstar")).forEach(a => FAVORITING_UI.configureFavoriting(a));
  // video elements
  Array.from(container.querySelectorAll('.embedsVideo .videoHeader a')).forEach(a => configureGetEmbeddedVideo(a));
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
const optGuessTopics = document.getElementById('optGuessTopics');
const optSortByStars = document.getElementById('optSortByStars');

// mastodon account typeahead hitting api
const txtRemoteMdon = document.getElementById('txtMdonDownloadConnsFor');
const mdonRemoteOwnerPivotPicker = document.getElementById('mdonRemoteOwnerPivotPicker');

document.getElementById('cmbType').addEventListener('change', (event) => {
  resetPage();
  setOptionVisibility();
  executeSearch();
});

const btnClearThreadFilter = document.getElementById('btnClearThreadFilter');
btnClearThreadFilter.onclick = function(event) {
  setOneThreadState(null);
  resetPage();
  executeSearch();  // no threadUrlKey passed in, so query string will be conformed to '' for thread
  return false;
}

const configureViewThread = function(btnViewThreadElm) {
  btnViewThreadElm.onclick = function(event) {
    const threadUrlKey = btnViewThreadElm.getAttribute('data-testid');
    setOneThreadState(threadUrlKey);
    resetPage();
    executeSearch();
    return false;
  }
};

const setOneThreadState = function(threadUrlKey) {
  const container = document.getElementById('mainContainer');
  if (STR.hasLen(threadUrlKey)) {
    container.classList.add('oneThread');
    container.setAttribute('data-testid', threadUrlKey);
    // clear all that which might confuse a user about why they aren't seeing the full thread
    // clear owner
    txtOwnerHandle.value = '';
    // clear search
    txtSearch.value = '';
    // clear topic filter
    cmbTopicFilter.value = -1;  // clear
  }
  else {
    container.removeAttribute('data-testid');
    container.classList.remove('oneThread');
  }
}

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
  resetPage();
  executeSearch();
  return false;
};

const setTopicFilterVisibility = function() {
  const guessTopics = getUiValue('optGuessTopics');
  if (guessTopics == true) {
    cmbTopicFilter.classList.remove('d-nonefor');
  }
  else {
    cmbTopicFilter.classList.add('d-nonefor');
  }
}

optGuessTopics.onclick = function(event) {
  optGuessTopics.classList.toggle('toggledOn');
  setTopicFilterVisibility();
  resetPage();
  executeSearch();
  return false;
};

optSortByStars.onclick = function(event) {
  optSortByStars.classList.toggle('toggledOn');
  const shouldSortByStars = getUiValue('optSortByStars');
  SETTINGS.setSortByStars(shouldSortByStars);
  resetPage();
  executeSearch();
  return false;
};

const cmbTopicFilter = document.getElementById('cmbTopicFilter');
cmbTopicFilter.addEventListener('change', (event) => {
  setTopicFilterModeInUi();
  resetPage();
  executeSearch();
});

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
  if (!personElm) {
    console.log('Errant owner click');
    return;
  }
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
    _lastRenderedRequest = '';
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

const displayTotalCount = function(count) {
  document.getElementById('txtSearch').setAttribute('placeholder', `search (${count} total)...`);
}

const onChooseOwner = function() {
  initMainListUiElms();
  listOwnerPivotPicker.replaceChildren();
  resetPage();
  executeSearch();
}

const btnClearCache = document.getElementById('btnClearCache');
btnClearCache.addEventListener('click', async () => {
  if (confirm('If unknown problems persist even after relaunching the browser, you may wish to clear the cache. \nContinue?')) {
    await chrome.storage.local.clear();
    localStorage.clear();
  }
  return true;
});

// a full page refresh is in order (helps avoid disk log + redraws the full page)
document.getElementById('uploadDone').onclick = function(event) {
  // a full page refresh is in order
  location.reload();
  return false;
};  

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  _dropArea.addEventListener(eventName, ES6.preventDragBehaviors, false)   
  document.body.addEventListener(eventName, ES6.preventDragBehaviors, false)
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
  files.forEach(processVideoUpload);
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
// stackoverflow.com/questions/61012790/how-to-read-large-video-files-in-javascript-using-filereader
const processVideoUpload = function(file) {
  const reader = new FileReader();

  // set the event for when reading completes
  reader.onload = async function(e) {
    const uploadedCntElem = document.getElementById('uploadedCnt');
    uploadedCntElem.innerText = parseInt(uploadedCntElem.innerText) + 1;
    // base64.guru/converter/encode/video
    // outputs e.g.:
    // data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA...
    let buffer = e.target.result;
    console.log(buffer);
    // outputs e.g.: 'scafaria_status_1626566689864163329 (1).mp4'
    console.log(reader.fileName);
    // let videoBlob = new Blob([new Uint8Array(buffer)], { type: 'video/mp4' });
    // let url = window.URL.createObjectURL(videoBlob);

    onProcessedUploadBatch();
  }

  // start reading
  // stackoverflow.com/questions/36280818/how-to-convert-file-to-base64-in-javascript
  reader.fileName = file.name;
  // bacancytechnology.com/qanda/javascript/javascript-using-the-filereader-api
  reader.readAsDataURL(file);
}

const onProcessedUploadBatch = function() {
  const processedCntElem = document.getElementById('uploadProcessedCnt');
  processedCntElem.innerText = parseInt(processedCntElem.innerText) + 1;
}

/************************/
// Github Backup
/************************/
GHBACKUP_UI.bindElements();

/************************/
// Github Restore
/************************/

const renderSyncRestoreStatus = function() {
  // ghBackupStatusStatus
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

document.getElementById('githubLensBtn').onclick = async function(event) {
  await activateGithubTab();
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

const activateGithubTab = async function(pageType) {
  pageType = pageType || SETTINGS.getCachedPageType(SITE.GITHUB);
  const site = SETTINGS.getCachedSite();
  if (site != SITE.GITHUB) {
    SETTINGS.cacheSite(SITE.GITHUB);
    updateForSite();
  }

  await unveilGithubUi(pageType);
}

const unveilGithubUi = async function(pageType) {
  switch (pageType) {
    case PAGETYPE.GITHUB.BACKUP:
      await activateGhBackupTab();
      break;
    case PAGETYPE.GITHUB.RESTORE:
      await activateGhRestoreTab();
      break;
    case PAGETYPE.GITHUB.CONFIGURE:
    default:
      await activateGhConfigureTab();
      break;
  }
}

document.getElementById('ghConfigDataTab').onclick = async function(event) {
  GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.DATA);
  await GHCONFIG_UI.reflectGithubTokenStatus();
  return false;
}
document.getElementById('ghConfigVideosTab').onclick = async function(event) {
  GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.VIDEOS);
  await GHCONFIG_UI.reflectGithubTokenStatus();
  return false;
}

document.getElementById('btnCancelGithubToken').onclick = async function(event) {
  // the goal is to switch back to the tab of the token type that we do have
  const hasDataToken = await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.DATA);
  const hasVideoToken = await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.VIDEOS);
  if (hasDataToken == true) {
    GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.DATA);
  }
  else if (hasVideoToken == true) {
    GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.VIDEOS);
  }
  await GHCONFIG_UI.reflectGithubTokenStatus();
  return false;
}

document.getElementById('ghConfigureTab').onclick = async function(event) {
  await activateGhConfigureTab();
  return false;
}
document.getElementById('ghBackupTab').onclick = async function(event) {
  await activateGhBackupTab();
  return false;
}
document.getElementById('ghRestoreTab').onclick = async function(event) {
  await activateGhRestoreTab();
  return false;
}

GHCONFIG_UI.bindElements();

const configureSyncUi = document.getElementById('configureSyncUi');

const activateGhConfigureTab = async function() {
  await GHCONFIG_UI.reflectGithubTokenStatus(); 
  await setActiveSyncTabPageType(PAGETYPE.GITHUB.CONFIGURE);
  configureSyncUi.style.display = 'block';
  backupUi.style.display = 'none';
  restoreUi.style.display = 'none';
}

const activateGhBackupTab = async function() {
  await setActiveSyncTabPageType(PAGETYPE.GITHUB.BACKUP);
  configureSyncUi.style.display = 'none';
  backupUi.style.display = 'block';
  restoreUi.style.display = 'none';
  await GHBACKUP_UI.renderSyncBackupStatus();
}

const activateGhRestoreTab = async function() {
  await setActiveSyncTabPageType(PAGETYPE.GITHUB.RESTORE);
  configureSyncUi.style.display = 'none';
  backupUi.style.display = 'none';
  restoreUi.style.display = 'block';
}

const getActiveSyncTabPageType = function() {
  if (document.getElementById('ghRestoreTab').classList.contains('active')) {
    return PAGETYPE.GITHUB.RESTORE;
  }
  else if (document.getElementById('ghBackupTab').classList.contains('active')) {
    return PAGETYPE.GITHUB.BACKUP;
  }
  else {
    return PAGETYPE.GITHUB.CONFIGURE;
  }
}

const setActiveSyncTabPageType = async function(pageType) {
  const backupTab = document.getElementById('ghBackupTab');
  const restoreTab = document.getElementById('ghRestoreTab');
  const configureTab = document.getElementById('ghConfigureTab');

  if (pageType == PAGETYPE.GITHUB.RESTORE) {
    restoreTab.classList.add('active');
    
    if (backupTab.classList.contains('active')) {
      backupTab.classList.remove('active');
    }
    if (configureTab.classList.contains('active')) {
      configureTab.classList.remove('active');
    }
    
    restoreTab.setAttribute('aria-current', 'page');
    backupTab.removeAttribute('aria-current');
    configureTab.removeAttribute('aria-current');
  }
  else if (pageType == PAGETYPE.GITHUB.BACKUP) {
    backupTab.classList.add('active');
    
    if (restoreTab.classList.contains('active')) {
      restoreTab.classList.remove('active');
    }
    if (configureTab.classList.contains('active')) {
      configureTab.classList.remove('active');
    }
    
    backupTab.setAttribute('aria-current', 'page');
    restoreTab.removeAttribute('aria-current');
    configureTab.removeAttribute('aria-current');
  }
  else {
    // configure tab
    configureTab.classList.add('active');
    
    if (restoreTab.classList.contains('active')) {
      restoreTab.classList.remove('active');
    }
    if (backupTab.classList.contains('active')) {
      backupTab.classList.remove('active');
    }
    
    configureTab.setAttribute('aria-current', 'page');
    restoreTab.removeAttribute('aria-current');
    backupTab.removeAttribute('aria-current');
  }

  conformQueryStringToUi(false);
  const cacheKey = SETTINGS.pageTypeCacheKey(SITE.GITHUB);
  localStorage.setItem(cacheKey, pageType);
}

const updateForSite = function() {
  
  const site = SETTINGS.getCachedSite();
  initMainListUiElms();
  _lastRenderedRequest = '';
  
  const owner = SETTINGS.getCachedOwner(site);
  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  const twitterBtn = document.getElementById('twitterLensBtn');
  const mastodonBtn = document.getElementById('mastodonLensBtn');
  const mastodonApiUi = document.getElementById('mdonApiUi');
  const githubBtn = document.getElementById('githubLensBtn');
  const syncUi = document.getElementById('syncUi');

  setOptionVisibility();

  if (site == SITE.TWITTER) {
    twitterBtn.classList.add('active');
    
    if (mastodonBtn.classList.contains('active')) {
      mastodonBtn.classList.remove('active');
    }
    if (githubBtn.classList.contains('active')) {
      githubBtn.classList.remove('active');
    }
    
    twitterBtn.setAttribute('aria-current', 'page');
    mastodonBtn.removeAttribute('aria-current');
    mastodonApiUi.style.display = 'none';
    githubBtn.removeAttribute('aria-current');
    syncUi.style.display = 'none';

    // render list
    document.getElementById('dbui').style.display = 'flex';
  }
  else if (site == SITE.MASTODON) {
    
    if (twitterBtn.classList.contains('active')) {
      twitterBtn.classList.remove('active');
    }
    if (githubBtn.classList.contains('active')) {
      githubBtn.classList.remove('active');
    }

    mastodonBtn.classList.add('active');
    twitterBtn.removeAttribute('aria-current');
    mastodonBtn.setAttribute('aria-current', 'page');
    githubBtn.removeAttribute('aria-current');
    syncUi.style.display = 'none';
    
    MASTODON.render();
    mastodonApiUi.style.display = 'block';
  }
  else if (site == SITE.GITHUB) {
    githubBtn.classList.add('active');
    
    if (twitterBtn.classList.contains('active')) {
      twitterBtn.classList.remove('active');
    }
    if (mastodonBtn.classList.contains('active')) {
      mastodonBtn.classList.remove('active');
    }
    
    githubBtn.setAttribute('aria-current', 'page');
    twitterBtn.removeAttribute('aria-current');
    mastodonBtn.removeAttribute('aria-current');
    mastodonApiUi.style.display = 'none';

    document.getElementById('dbui').style.display = 'none';

    syncUi.style.display = 'flex';
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
MDON_UI.bindElements();s