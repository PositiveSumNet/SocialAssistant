// api access
// these api variables are set on startup from the chrome (secure) cache
let _mdonClientId = '';
let _mdonClientSecret = '';
let _mdonAccessToken = '';
let _mdonUserAuthToken = '';
let _mdonUserAccount = '';
let _mdonConnected = false;

var MASTODON = {

  // constants
  LOCAL_URI: 'urn:ietf:wg:oauth:2.0:oob',
  APP_BASE_NAME: 'Whosum for Mastodon',
  APP_SCOPES: 'read write read:accounts read:follows write:follows',
  URL_PARAM_SCOPES: 'write:follows+read:follows+read:accounts',
  
  OAUTH_CACHE_KEY: {
    USER_ACCOUNT: 'mdonUserAccount',
    CLIENT_ID: 'mdonClientId',
    CLIENT_SECRET: 'mdonClientSecret',
    ACCESS_TOKEN: 'mdonAccessToken',
    USER_AUTH_TOKEN: 'mdonUserAuthToken',
  },

  // todo: pass in an object with the elements instead
  render: function() {
    
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

    if (_mdonUserAccount.length > 0 && _mdonUserAuthToken.length > 0) {
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

  disconnect: function() {
    
    const userResponse = confirm("Disconnect from Mastodon?");

    if (userResponse != true) {
      return;
    }
  
    // revoke the app itself?

    let _mdonAccessToken = '';
    let _mdonUserAuthToken = '';
    let _mdonUserAccount = '';
    let _mdonConnected = false;
    
    // todo...
  },

  clearErrorMsg: function() {
    document.getElementById('mdonConnError').replaceChildren();
  },

  onConnectFailure: function(response) {
    const elm = document.getElementById('mdonConnError');
    if (response.status) {
      elm.textContent = 'Request failed with error code ' + response.status;
    }
    else {
      elm.textContent = 'Failed with error: ' + response;
    }
  },

  launchAuth: function() {
    // server
    const server = document.getElementById('txtMdonServer').value || '';

    if (server.length === 0) {
      document.getElementById('mdonConnError').textContent = 'Mastodon server name is required.';
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

  getAuthHeader: function() {
    return {
      Authorization: `Bearer ${_mdonUserAuthToken}`
    }
  },

  onReceivedLoggedInUser: function(data) {
    _mdonUserAccount = STR.standardizeMastodonAccount(data.username, SETTINGS.getMdonServer());
    _mdonConnected = true;
    // and save to secure storage.local cache
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.ACCESS_TOKEN]: _mdonAccessToken });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_AUTH_TOKEN]: _mdonUserAuthToken });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.USER_ACCOUNT]: _mdonUserAccount });
    // rendering
    document.getElementById('mdonUserId').textContent = _mdonUserAccount;
    document.getElementById('txtMdonDownloadConnsFor').value = STR.stripPrefix(_mdonUserAccount, '@');
    // ready to unveil
    document.getElementById('mdonApiUi').classList.remove('authing');
    document.getElementById('mdonOAuthUi').style.display = 'none';
    document.getElementById('mdonReconnecting').style.display = 'none';
    document.getElementById('mdonDownloadConnsUi').style.display = 'block';
  },

  getLoggedInUser: function() {
    
    console.log('getting logged in user');
    
    MASTODON.clearErrorMsg();
    fetch(`https://${SETTINGS.getMdonServer()}/api/v1/accounts/verify_credentials`, {
        method: 'GET',
        headers: MASTODON.getAuthHeader()
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

  userSubmittedAuthCode: function() {

      const code = document.getElementById('txtMdonAuthCode').value || '';

      if (code.length === 0) {
        document.getElementById('mdonConnError').textContent = 'Auth code is required.';
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
  }
};