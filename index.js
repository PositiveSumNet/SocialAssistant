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

const onCopiedToDb = async function(cacheKeys) {
  // we can clear out the cache keys
  for (let i = 0; i < cacheKeys.length; i++) {
    let cacheKey = cacheKeys[i];
    await chrome.storage.local.remove(cacheKey);
  }
  
  // and queue up the next run
  await QUERYWORK_UI.ensureCopiedToDb();
}

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
      await QUERYWORK_UI.ensureCopiedToDb();
      break;
    case MSGTYPE.FROMDB.COPIED_TODB:
      await onCopiedToDb(data.cacheKeys);
      break;
    case MSGTYPE.FROMDB.SAVE_AND_DELETE_DONE:
      QUERYWORK_UI.onCompletedSaveAndDelete(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.SUGGESTED_OWNER:
      RENDERBIND_UI.renderSuggestedOwner(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS:
      RENDERBIND_UI.renderMatchedOwners(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.CONNECTIONS:
      RENDERBIND_UI.renderConnections(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.POST_STREAM:
      RENDERBIND_UI.renderPostStream(data.payload);
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

RENDERBIND_UI.bindEvents();
ES6.TRISTATE.initAll();
QUERYWORK_UI.bindElements();
SETTINGS_UI.bindElements();
GHBACKUP_UI.bindElements();
TABS_UI.bindElements();
GHCONFIG_UI.bindElements();
MDON_UI.bindElements();