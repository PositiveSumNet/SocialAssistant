// api access
// these are set on startup from the chrome (secure) cache
var _mdonClientId = '';
var _mdonClientSecret = '';
var _mdonAccessToken = '';
var _mdonUserAuthToken = '';
var _mdonRememberedUser = {};  // person object
var _mdonConnectedUser = {};  // person object

var _mdonDownloadConnsFor = {}; // person object
var _mdonDownloadDirection = CONN_DIRECTION.FOLLOWING;

var MASTODON = {

  // constants
  LOCAL_URI: 'urn:ietf:wg:oauth:2.0:oob',
  APP_BASE_NAME: 'Whosum for Mastodon',
  APP_SCOPES: 'read write read:accounts read:follows write:follows',
  URL_PARAM_SCOPES: 'write:follows+read:follows+read:accounts',
  
  OAUTH_CACHE_KEY: {
    USER: 'mdonUser',
    CLIENT_ID: 'mdonClientId',
    CLIENT_SECRET: 'mdonClientSecret',
    ACCESS_TOKEN: 'mdonAccessToken',
    USER_AUTH_TOKEN: 'mdonUserAuthToken',
  },

  getConnectedUserId: function() {
    if (!_mdonConnectedUser) { return ''; }
    return _mdonConnectedUser[PERSON_ATTR.SOURCE_ID] || '';
  },

  getRememberedUserId: function() {
    if (!_mdonRememberedUser) { return ''; }
    return _mdonRememberedUser[PERSON_ATTR.SOURCE_ID] || '';
  },

  getConnectedUserHandle: function() {
    if (!_mdonConnectedUser) { return ''; }
    return _mdonConnectedUser[PERSON_ATTR.HANDLE] || '';
  },

  getRememberedUserHandle: function() {
    if (!_mdonRememberedUser) { return ''; }
    return _mdonRememberedUser[PERSON_ATTR.HANDLE] || '';
  },

  isConnected: function() {
    return MASTODON.getConnectedUserId().length > 0;
  },

  // todo: pass in an object with the elements instead
  render: function() {

    if (MASTODON.isConnected() === true) {
      // already rendered
      return;
    }
    
    // initial state should hide paged list ui
    document.getElementById('dbui').style.display = 'none';
    document.getElementById('txtMdonServer').value = SETTINGS.getMdonServer() || '';

    const mdonApiUi = document.getElementById('mdonApiUi');
    const mdonOAuthUi = document.getElementById('mdonOAuthUi');
    const mdonConnectStep1 = document.getElementById('mdonConnectStep1');
    const mdonConnectStep2 = document.getElementById('mdonConnectStep2');
    const mdonReconnecting = document.getElementById('mdonReconnecting');
    const mdonReconnectingAs = document.getElementById('mdonReconnectingAs');
    const mdonDownloadConnsUi = document.getElementById('mdonDownloadConnsUi');

    if (MASTODON.getRememberedUserId().length > 0 && MASTODON.getRememberedUserHandle().length > 0 && _mdonUserAuthToken.length > 0) {
      mdonOAuthUi.style.display = 'none';
      
      if (mdonApiUi.classList.contains('authing')) {
        mdonApiUi.classList.remove('authing');
      }

      mdonDownloadConnsUi.style.display = 'none';
      mdonReconnecting.style.display = 'block';
      mdonReconnectingAs.textContent = `Reconnecting as ${MASTODON.getRememberedUserHandle()}...`;
      
      MASTODON.getLoggedInUser();
    }
    else {
      // the app isn't even registered yet
      if (!mdonApiUi.classList.contains('authing')) {
        mdonApiUi.classList.add('authing');
      }

      mdonOAuthUi.style.display = 'block';
      mdonDownloadConnsUi.style.display = 'none';
      mdonReconnecting.style.display = 'none';
      mdonConnectStep1.style.display = 'block';
      mdonConnectStep2.style.display = 'none';
      // now just wait for the user to connect (calling launchAuth())
    }
  },

  disconnect: function(appToo) {
    
    const userResponse = confirm("Disconnect from Mastodon? \n\nNote: Upon completion, you may wish to also revoke access at the settings page we launch.");

    if (userResponse != true) {
      return;
    }
  
    MASTODON.clearErrorMsg();

    if (appToo) {
      chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_ID]: '' });
      chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_SECRET]: '' });
      _mdonClientId = '';
      _mdonClientSecret = '';
    }

    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.ACCESS_TOKEN]: '' });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_AUTH_TOKEN]: '' });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER]: '' });

    _mdonAccessToken = '';
    _mdonUserAuthToken = '';
    _mdonRememberedUser = {};
    _mdonConnectedUser = {};

    // give a chance to revoke
    const url = `https://${SETTINGS.getMdonServer()}/oauth/authorized_applications`;
    window.open(url, '_blank');
    
    MASTODON.render();
  },

  clearErrorMsg: function() {
    document.getElementById('mdonConnError').replaceChildren();
  },

  setErrorMsg: function(msg) {
    document.getElementById('mdonConnError').textContent = msg;
  },

  onConnectFailure: function(response) {
    if (response.status) {
      
      if (response.status === 401) {
        MASTODON.setErrorMsg('Not authorized. Try clicking Disconnect and start again.');
      }
      else {
        MASTODON.setErrorMsg('Request failed with error code ' + response.status);
      }
    }
    else {
      MASTODON.setErrorMsg('Failed with error: ' + response);
    }
  },

  launchAuth: function() {
    // server
    const server = document.getElementById('txtMdonServer').value || '';

    if (server.length === 0) {
      MASTODON.setErrorMsg('Mastodon server name is required.');
      return;
    }

    localStorage.setItem(SETTINGS.MDON_SERVER, server);
    localStorage.setItem(SETTINGS.ASKED.MDON_SERVER, true);

    // ensure the app is registered
    if (_mdonClientId.length === 0 || _mdonClientSecret.length === 0) {
      // register the app first
      MASTODON.registerApiApp();
    }
    else {
      // proceed directly to prompting user
      MASTODON.promptForUserAuth();
    }
  },

  promptForUserAuth: function() {
    // progress the UI to step 2
    document.getElementById('mdonConnectStep1').style.display = 'none';
    document.getElementById('mdonConnectStep2').style.display = 'block';

    // launch tab
    const url = `https://${SETTINGS.getMdonServer()}/oauth/authorize?response_type=code&client_id=${_mdonClientId}&redirect_uri=${MASTODON.LOCAL_URI}&scope=${MASTODON.URL_PARAM_SCOPES}`;
    window.open(url, '_blank');
  },

  getVersionedAppName: function() {
    const version = chrome.runtime.getManifest().version;
    return `${MASTODON.APP_BASE_NAME} v${version}`;
  },

  getUserAuthHeader: function() {
    return {
      Authorization: `Bearer ${_mdonUserAuthToken}`
    }
  },

  getAppAuthHeader: function() {
    return {
      Authorization: `Bearer ${_mdonAccessToken}`
    }
  },

  accountToPerson: function(account) {
    if (!account) { return account; }

    const fullHandle = STR.mastodonAccountFromProfileUrl(account.url);

    const per = {};
    per[PERSON_ATTR.SITE] = MASTODON.SITE;
    per[PERSON_ATTR.SOURCE_ID] = account.id;
    per[PERSON_ATTR.HANDLE] = fullHandle;
    per[PERSON_ATTR.DISPLAY_NAME] = DOMPurify.sanitize(account.display_name);
    per[PERSON_ATTR.DETAIL] = ES6.unfurlHtml(account.note);
    per[PERSON_ATTR.IMG_CDN_URL] = account.avatar_static;
    per[PERSON_ATTR.IMG_64_URL] = account.Img64Url
    per[PERSON_ATTR.FOLLOWERS_COUNT] = account.followers_count;
    per[PERSON_ATTR.FOLLOWING_COUNT] = account.following_count;

    return per;
  },

  onReceivedLoggedInUser: function(data) {
    _mdonConnectedUser = MASTODON.accountToPerson(data);
    // copy so it's not a shared reference
    _mdonRememberedUser = MASTODON.accountToPerson(data);
    _mdonDownloadConnsFor = MASTODON.accountToPerson(data);
    // and save to secure storage.local cache
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.ACCESS_TOKEN]: _mdonAccessToken });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_AUTH_TOKEN]: _mdonUserAuthToken });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER]: _mdonRememberedUser });

    // renderPerson uses DOMPurify.sanitize
    const userAvatarElm = RENDER.renderPerson(_mdonConnectedUser, RENDER_CONTEXT.PERSON.AUTHD_USER, RENDER_CONTEXT.ANCHORS.ALL, false);
    document.getElementById('loggedInMastodonUser').innerHTML = userAvatarElm;

    document.getElementById('txtMdonDownloadConnsFor').value = STR.stripPrefix(MASTODON.getConnectedUserHandle(), '@');
    // to pre-populate DB UI owner textbox
    localStorage.setItem(SETTINGS.ownerCacheKey(SITE.MASTODON), MASTODON.getConnectedUserHandle());

    // ready to unveil
    document.getElementById('mdonApiUi').classList.remove('authing');
    document.getElementById('mdonOAuthUi').style.display = 'none';
    document.getElementById('mdonReconnecting').style.display = 'none';
    document.getElementById('mdonDownloadConnsUi').style.display = 'block';
  },

  userSubmittedAuthCode: function() {

      const code = document.getElementById('txtMdonAuthCode').value || '';

      if (code.length === 0) {
        MASTODON.setErrorMsg('Auth code is required.');
        return;
      }

      _mdonAccessToken = code;

      // exchange the access token for an authorization token

      const form = new FormData();
      form.append('client_id', _mdonClientId);
      form.append('client_secret', _mdonClientSecret);
      form.append('redirect_uri', MASTODON.LOCAL_URI);
      form.append('grant_type', 'authorization_code');
      form.append('code', code);
      
      MASTODON.clearErrorMsg();
      fetch(`https://${SETTINGS.getMdonServer()}/oauth/token`, {
          method: 'POST',
          body: form
      })
      .then(function(response) { 
        
        if (response.status !== 200) {
          MASTODON.onConnectFailure(response);
          return;
        }
        
        response.json().then(function(data) {
          _mdonUserAuthToken = data.access_token;
          console.log('user code received; getting logged-in user');
          MASTODON.getLoggedInUser();
        });
      })
      .catch(function(err) {
        MASTODON.onConnectFailure(err);
      });

  },

  registerApiApp: function() {

    console.log('registering mastodon api app');

    const form = new FormData();
    form.append('client_name', MASTODON.getVersionedAppName());
    form.append('redirect_uris', MASTODON.LOCAL_URI);
    form.append('scopes', MASTODON.APP_SCOPES);
    form.append('website', APP_HOME_URL);
    
    MASTODON.clearErrorMsg();
    fetch(`https://${SETTINGS.getMdonServer()}/api/v1/apps`, {
        method: 'POST',
        body: form
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        MASTODON.onConnectFailure(response);
        return;
      }
      
      response.json().then(function(data) {

        console.log('mastodon api app registered');

        _mdonClientId = data.client_id;
        _mdonClientSecret = data.client_secret;
        
        // and save to secure storage.local cache
        chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_ID]: _mdonClientId });
        chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_SECRET]: _mdonClientSecret });
    
        MASTODON.promptForUserAuth();
      });
    })
    .catch(function(err) {
      MASTODON.onConnectFailure(err);
    });
  },
  
  getLoggedInUser: function() {
    
    console.log('getting logged in user');
    
    MASTODON.clearErrorMsg();
    fetch(`https://${SETTINGS.getMdonServer()}/api/v1/accounts/verify_credentials`, {
        method: 'GET',
        headers: MASTODON.getUserAuthHeader()
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        // we should clear cache!
        MASTODON.onConnectFailure(response);
        return;
      }
      
      response.json().then(function(data) {
        
        const img64Fn = ES6.getImageBase64(data.avatar_static);
        img64Fn.then(function(resp) { 
          try {
            // successfully converted to base64 image that we can render!
            data.Img64Url = resp;
          }
          catch {
            // no image, no problem
          }
          
          MASTODON.onReceivedLoggedInUser(data);
        });
      });
    })
    .catch(function(err) {
        // we should clear cache!
        MASTODON.onConnectFailure(err);
    });
  },

  downloadConnections: function(direction) {
    _mdonDownloadDirection = direction;
    
    console.log('initiating connections download');

    if (_mdonDownloadConnsForUserId.length === 0) {
      // need to obtain the Id first
      MASTODON.getUserIdForSelectedDownloadAccount(MASTODON.downloadConnectionsForUserId);
    }
    else {
      MASTODON.downloadConnectionsForUserId();
    }
  },

  downloadConnectionsForUserId: function() {
    MASTODON.clearErrorMsg();
    fetch(`https://${SETTINGS.getMdonServer()}/api/v1/accounts/${_mdonDownloadConnsForUserId}/${_mdonDownloadDirection}`, {
        method: 'GET',
        headers: MASTODON.getUserAuthHeader()
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        // we should clear cache!
        MASTODON.onConnectFailure(response);
        return;
      }
      
      response.json().then(function(data) {
        console.log(data);
        // successCallback();
      });
    })
    .catch(function(err) {
        // we should clear cache!
        MASTODON.onConnectFailure(err);
    });
  }
};
