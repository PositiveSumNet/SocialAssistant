// api access
let _mdonServer = '';
let _mdonClientId = '';
let _mdonClientSecret = '';
let _mdonAccessToken = '';
let _mdonAuthToken = '';

var MASTODON = {

  // constants
  LOCAL_URI: 'urn:ietf:wg:oauth:2.0:oob',
  APP_NAME: 'Whosum for Mastodon',
  APP_SCOPES: 'read write read:accounts read:follows write:follows',
  URL_PARAM_SCOPES: 'write:follows+read:follows+read:accounts',
  
  OAUTH_CACHE_KEY: {
    CLIENT_ID: 'mdonClientId',
    CLIENT_SECRET: 'mdonClientSecret',
    ACCESS_TOKEN: 'mdonAccessToken',
    AUTH_TOKEN: 'mdonAuthToken',
  },

  getVersionedAppName: function() {
    const version = chrome.runtime.getManifest().version;
    return `${MASTODON.APP_NAME} v${version}`;
  },

  ensureConfigured: function(mdonServer, forceReset) {
    
    _mdonServer = mdonServer;
    const owner = SETTINGS.getCachedOwner(SITE.MASTODON);

    if (!forceReset && owner && owner.length > 0 && _mdonClientId.length > 0 && _mdonClientSecret.length > 0 && _mdonAccessToken.length > 0 && _mdonAuthToken.length > 0) {
      console.log('double-checking cached mastodon credentials');
      // we seem to be logged in; double-check
      MASTODON.getLoggedInUser();
    }
    else {
      console.log('connecting to mastodon');
      MASTODON.offerToConnect();
    }
  },

  offerToConnect: function() {
    const alreadyExplained = SETTINGS.getExplainedMdonOauth();

    if (!alreadyExplained) {
      const userResponse = confirm(`Connect your Mastodon account at ${_mdonServer} to access follower lists?\n\nThis does NOT share data with our servers (this is a local application running on your device).\n\nA new window will open and you'll be asked to paste a code back here in the app.`);

      if (userResponse != true) {
        return;
      }

      SETTINGS.setExplainedMdonOauth();
    }
    
    if (_mdonClientId.length > 0 && _mdonClientSecret.length > 0) {
      console.log('prompting mastodon oauth');
      MASTODON.promptForUserAuth();
    }
    else {
      console.log('registering mastodon oauth app to connect');
      MASTODON.registerApiApp(MASTODON.onCompleteAppRegistration);
    }
  },

  onConfigFailure: function(response) {
    if (response.status) {
      alert('Request failed with error code ' + response.status);
    }
    else {
      alert('Failed with error: ' + response);
    }
  },

  getAuthHeader: function() {
    return {
      Authorization: `Bearer ${_mdonAuthToken}`
    }
  },

  getLoggedInUser: function() {

    fetch(`https://${_mdonServer}/api/v1/accounts/verify_credentials`, {
        method: 'GET',
        headers: MASTODON.getAuthHeader()
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        // we should clear cache!
        MASTODON.onConfigFailure(response);
        return;
      }
      
      response.json().then(function(data) {
        // todo: cache owner and auth token
        // use the more secure storage.local
        console.log(data);
      });
    })
    .catch(function(err) {
        // we should clear cache!
        MASTODON.onConfigFailure(err);
    });
  },

  promptForUserAuth: function() {
    const url = `https://${_mdonServer}/oauth/authorize?response_type=code&client_id=${_mdonClientId}&redirect_uri=${MASTODON.LOCAL_URI}&scope=${MASTODON.URL_PARAM_SCOPES}`;

    setTimeout(() => {
      const code = prompt('Another tab opened with a Mastodon prompt. After you accept the prompt, paste the code here.');

      if (code == null) {
        return;
      }
      else {
        _mdonAccessToken = code;
  
        // exchange the access token for an authorization token
  
        const form = new FormData();
        form.append('client_id', _mdonClientId);
        form.append('client_secret', _mdonClientSecret);
        form.append('redirect_uri', MASTODON.LOCAL_URI);
        form.append('grant_type', 'authorization_code');
        form.append('code', code);
        
        fetch(`https://${_mdonServer}/oauth/token`, {
            method: 'POST',
            body: form
        })
        .then(function(response) { 
          
          if (response.status !== 200) {
            MASTODON.onConfigFailure(response);
            return;
          }
          
          response.json().then(function(data) {
            _mdonAuthToken = data.authorization_code;
            console.log('user code received; getting logged-in user');
            MASTODON.getLoggedInUser();
          });
        })
        .catch(function(err) {
          MASTODON.onConfigFailure(err);
        });
      }
  
    }, 1000);

    window.open(url, '_blank');
  },

  onCompleteAppRegistration: function(appRegistrationResult) {
    
    _mdonClientId = appRegistrationResult.client_id;
    _mdonClientSecret = appRegistrationResult.client_secret;

    // and save to cache
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_ID]: _mdonClientId });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_SECRET]: _mdonClientSecret });

    console.log('oauth app is set up; prompting user...');
    MASTODON.promptForUserAuth();
  },

  registerApiApp: function(successCallback) {

    const form = new FormData();
    form.append('client_name', MASTODON.getVersionedAppName());
    form.append('redirect_uris', MASTODON.LOCAL_URI);
    form.append('scopes', MASTODON.APP_SCOPES);
    form.append('website', APP_HOME_URL);
    
    fetch(`https://${_mdonServer}/api/v1/apps`, {
        method: 'POST',
        body: form
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        MASTODON.onConfigFailure(response);
        return;
      }
      
      response.json().then(function(data) {
        successCallback(data);
      });
    })
    .catch(function(err) {
      MASTODON.onConfigFailure(err);
    });
  }
};