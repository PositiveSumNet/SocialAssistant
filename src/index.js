// PUBLIC VARIABLES
// avoid double-submit
var _lastRenderedRequest = '';
var _docLocSearch = '';
// improves experience of deleting in autocomplete textbox
var _deletingOwner = false;
var _deletingMdonRemoteOwner = false;
var _deletingTopicFilter = false;
// so we can reduce how many times we ask for (expensive) total counts
var _counterSet = new Set();
var _counters = [];

// CHROME-LEVEL EVENTS

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

// BINDINGS
QUERYWORK_UI.bindWorker();
RENDERBIND_UI.bindEvents();
ES6.TRISTATE.initAll();
QUERYWORK_UI.bindElements();
SETTINGS_UI.bindElements();
GHBACKUP_UI.bindElements();
GHRESTORE_UI.bindElements();
TABS_UI.bindElements();
GHCONFIG_UI.bindElements();
MDON_UI.bindElements();
GHVIDEOUP_UI.bindElements();