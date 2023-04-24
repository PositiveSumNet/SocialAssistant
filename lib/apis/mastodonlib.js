// api access
// these api variables are set on startup from the chrome (secure) cache
let _mdonClientId = '';
let _mdonClientSecret = '';
let _mdonAccessToken = '';
let _mdonUserAuthToken = '';
let _mdonUserId = '';
let _mdonUserAccount = '';
let _mdonConnected = false;

let _mdonDownloadConnsForUserId = '';
let _mdonDownloadConnsForUserAccount = '';
let _mdonDownloadDirection = CONN_DIRECTION.FOLLOWING;

var MASTODON = {

  // constants
  LOCAL_URI: 'urn:ietf:wg:oauth:2.0:oob',
  APP_BASE_NAME: 'Whosum for Mastodon',
  APP_SCOPES: 'read write read:accounts read:follows write:follows',
  URL_PARAM_SCOPES: 'write:follows+read:follows+read:accounts',
  
  OAUTH_CACHE_KEY: {
    USER_ID: 'mdonUserId',
    USER_ACCOUNT: 'mdonUserAccount',
    CLIENT_ID: 'mdonClientId',
    CLIENT_SECRET: 'mdonClientSecret',
    ACCESS_TOKEN: 'mdonAccessToken',
    USER_AUTH_TOKEN: 'mdonUserAuthToken',
  },

  // todo: pass in an object with the elements instead
  render: function() {
    
    // temporary debug logging
    /*
    console.log(_mdonClientId);
    console.log(_mdonClientSecret);
    console.log(_mdonAccessToken);
    console.log(_mdonUserAuthToken);
    */

    if (_mdonConnected === true) {
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
    const mdonDownloadConnsUi = document.getElementById('mdonDownloadConnsUi');

    if (_mdonUserId.length > 0 && _mdonUserAccount.length > 0 && _mdonUserAuthToken.length > 0) {
      mdonOAuthUi.style.display = 'none';
      
      if (mdonApiUi.classList.contains('authing')) {
        mdonApiUi.classList.remove('authing');
      }

      mdonDownloadConnsUi.style.display = 'none';
      mdonReconnecting.style.display = 'block';
      mdonReconnectingAs.textContent = `Reconnecting as ${_mdonUserAccount}...`;
      
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
  
    if (appToo) {
      chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_ID]: '' });
      chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_SECRET]: '' });
      _mdonClientId = '';
      _mdonClientSecret = '';
    }

    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.ACCESS_TOKEN]: '' });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_AUTH_TOKEN]: '' });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_ACCOUNT]: '' });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_ID]: '' });

    _mdonAccessToken = '';
    _mdonUserAuthToken = '';
    _mdonUserAccount = '';
    _mdonUserId = '';
    _mdonConnected = false;

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
      MASTODON.setErrorMsg('Request failed with error code ' + response.status);
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

  onReceivedLoggedInUser: function(data) {
    _mdonUserId = data.id;
    _mdonDownloadConnsForUserId = _mdonUserId;
    _mdonUserAccount = STR.standardizeMastodonAccount(data.username, SETTINGS.getMdonServer());
    _mdonDownloadConnsForUserAccount = _mdonUserAccount;
    _mdonConnected = true;
    // and save to secure storage.local cache
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.ACCESS_TOKEN]: _mdonAccessToken });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_AUTH_TOKEN]: _mdonUserAuthToken });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_ACCOUNT]: _mdonUserAccount });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_ID]: _mdonUserId });
    // rendering
    document.getElementById('mdonUserAccount').textContent = _mdonUserAccount;
    document.getElementById('txtMdonDownloadConnsFor').value = STR.stripPrefix(_mdonUserAccount, '@');
    // to pre-populate DB UI owner textbox
    localStorage.setItem(SETTINGS.ownerCacheKey(SITE.MASTODON), _mdonUserAccount);

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
        MASTODON.onReceivedLoggedInUser(data);
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
