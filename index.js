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
  if (document.getElementById('optWithMdon').checked === true) {
    return RENDER_CONTEXT.ANCHORS.MDON_ONLY;
  }
  else if (document.getElementById('optWithEmail').checked === true) {
    return RENDER_CONTEXT.ANCHORS.EMAIL_ONLY;
  }
  else if (document.getElementById('optWithUrl').checked === true) {
    return RENDER_CONTEXT.ANCHORS.EXTURL_ONLY;
  }
  else {
    return RENDER_CONTEXT.ANCHORS.ALL;
  }
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

const ensureCopiedToDb = async function() {
  const kvps = await SETTINGS.getCacheKvps(STORAGE_PREFIX.FOR_DB);
  
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
    _worker.postMessage( { batches: batches, actionType: MSGTYPE.TODB.XFER_CACHE_TODB } );
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
  QUERYING_UI.FILTERS.renderTopicFilterChoices();
  
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

  QUERYING_UI.PAGE_TYPE.updateUiForCachedSite();

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
      // we'll tell the _worker to call us back with the most sensible initial value
      const msg = { 
        actionType: MSGTYPE.TODB.SUGGEST_OWNER, 
        pageType: pageType
      };
      
      waitForOwnerCallback = true;
      _worker.postMessage(msg);
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
  const optWithRetweets = document.getElementById('optWithRetweets');
  QUERYING_UI.FILTERS.setOptToggleBtn(optWithRetweets, parms[URL_PARM.WITH_RETWEETS] != 'false'); // default to true

  // TOPIC
  const optGuessTopics = document.getElementById('optGuessTopics');
  QUERYING_UI.FILTERS.setOptToggleBtn(optGuessTopics, parms[URL_PARM.GUESS_TOPICS] == 'true'); // default to false
  QUERYING_UI.FILTERS.TOPICS.setTopicFilterVisibility();
  QUERYING_UI.FILTERS.TOPICS.setTopicFilterChoiceInUi(topic);
  // THREAD
  QUERYING_UI.THREAD.setOneThreadState(threadUrlKey);
  // post sort
  QUERYING_UI.ORDERING.setTopicSortInUi();

  QUERYING_UI.FILTERS.setQueryOptionVisibility();

  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  if (waitForOwnerCallback === false) {
    
    switch (site) {
      case SITE.GITHUB:
        await TABS_UI.SYNC.activateGithubTab(pageType);
        _docLocSearch = document.location.search; // aids our popstate behavior
        break;
      default:
        QUERYWORK_UI.executeSearch(owner, leaveHistoryStackAlone, topic);
        break;
    }
  }
}

// companion to the above pushState so that back button works
window.addEventListener("popstate", async function(event) {
  if (_docLocSearch != document.location.search) {
    await initialRender(true);
  }
});

// receive messages from _worker
_worker.onmessage = async function ({ data }) {
  switch (data.type) {
    case MSGTYPE.FROMDB.LOG.LEGACY:
      // legacy + error logging
      LOG_UI.logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    case MSGTYPE.FROMDB.LOG.SQLITE_VERSION:
      LOG_UI.logSqliteVersion(data.payload);
      break;
    case MSGTYPE.FROMDB.LOG.DB_SCRIPT_VERSION:
      LOG_UI.logDbScriptVersion(data.payload);
      break;
    case MSGTYPE.FROMDB.WORKER_READY:
      TOPICS.ensureRemoteTopicSettings(QUERYWORK_UI.onFetchedRawTopicContent);
      QUERYWORK_UI.ensureInUseTopicsFilter();
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
      QUERYING_UI.COUNT.renderNetworkSize(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.INUSE_TOPICS:
      _inUseTags = new Set(data.payload);
      QUERYING_UI.FILTERS.TOPICS.adjustTopicFilterVizWhen();
      break;
    case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT:
      QUERYWORK_UI.onGotSavedCount(data.count, data.pageType, data.metadata);
      break;
    case MSGTYPE.FROMDB.ON_FETCHED_FOR_BACKUP:
      await SYNCFLOW.onFetchedForBackup(data.pushable);
      break;
    default:
      LOG_UI.logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};

const renderPost = function(post) {
  const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
  const site = PAGETYPE.getSite(pageType);
  return RENDER.POST.renderPost(post, site);
}

const renderPerson = function(person, context) {
  const renderAnchorsRule = getPersonRenderAnchorsRule();
  const filtered = QUERYING_UI.FILTERS.detailReflectsFilter();
  return RENDER.PERSON.renderPerson(person, context, renderAnchorsRule, filtered);
}

const renderMatchedOwners = function(payload) {
  const owners = payload.owners;
  listOwnerPivotPicker.replaceChildren();
  
  if (owners.length === 1 && !_deletingOwner) {
    // exact match; pick it! (after an extra check that the user isn't 
    // trying to delete, in which case auto-complete would be annoying)
    txtOwnerHandle.value = STR.stripPrefix(owners[0].Handle, '@');
    QUERYWORK_UI.onChooseOwner();
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
  
  const value = document.getElementById('txtOwnerHandle').value;
  
  if (!value || value.length === 0) {
    document.getElementById('txtOwnerHandle').value = owner.Handle;
    // we're doing a page init and so far it's empty, so let's
    QUERYING_UI.PAGING.resetPage();
    QUERYWORK_UI.executeSearch();
  }
}

const renderPostStream = function(payload) {
  QUERYING_UI.initMainListUiElms();
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
  QUERYING_UI.SEARCH.showSearchProgress(false);
  onAddedRows(plist);

  _lastRenderedRequest = JSON.stringify(payload.request);
}

const renderConnections = function(payload) {
  QUERYING_UI.initMainListUiElms();
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
  if (SETTINGS_UI.canRenderMastodonFollowOneButtons() === true) {
    MASTODON.renderFollowOnMastodonButtons(plist);
  }
  
  QUERYING_UI.SEARCH.showSearchProgress(false);
  onAddedRows(plist);
  QUERYWORK_UI.requestTotalCount();
  
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
  const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
  // tag & rate
  Array.from(container.getElementsByClassName('postScoredTagger')).forEach(elm => RENDER.POST.TAGGING.configureTagAndRate(elm, pageType));
  Array.from(container.getElementsByClassName('postAnotherTag')).forEach(elm => RENDER.POST.TAGGING.configureAddAnotherTag(elm, pageType));
  // view thread
  Array.from(container.getElementsByClassName('btnViewThread')).forEach(elm => QUERYING_UI.THREAD.configureViewThread(elm));
  // simple favoriting
  Array.from(container.getElementsByClassName("canstar")).forEach(a => FAVORITING_UI.configureFavoriting(a));
  // video elements
  Array.from(container.querySelectorAll('.embedsVideo .videoHeader a')).forEach(a => configureGetEmbeddedVideo(a));
}

// public variables for filter elements that we'll attach events to etc.
ES6.TRISTATE.initAll();

const txtOwnerHandle = document.getElementById('txtOwnerHandle');
const txtSearch = document.getElementById('txtSearch');
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

QUERYWORK_UI.bindElements();
SETTINGS_UI.bindElements();
GHBACKUP_UI.bindElements();
TABS_UI.bindElements();
GHCONFIG_UI.bindElements();
MDON_UI.bindElements();