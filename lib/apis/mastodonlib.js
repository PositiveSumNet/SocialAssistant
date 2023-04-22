// api access
let _mdonClientId = '';
let _mdonClientSecret = '';
let _mdonAccessToken = '';
let _mdonAuthToken = '';

var MASTODON = {

  // constants
  LOCAL_URI: 'urn:ietf:wg:oauth:2.0:oob',
  APP_NAME: 'Whosum for Mastodon',
  APP_SCOPES: 'read write read:accounts read:follows write:follows',
  
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

  ensureConfigured: function(mdonServer) {
    const owner = SETTINGS.getCachedOwner(SITE.MASTODON);

    if (owner && owner.length > 0 && _mdonClientId.length > 0 && _mdonClientSecret.length > 0 && _mdonAccessToken.length > 0 && _mdonAuthToken.length > 0) {
      // all set
      return;
    }
    else {
      MASTODON.offerToConnect(mdonServer);
    }
  },

  offerToConnect: function(mdonServer) {
    const userResponse = confirm(`Connect your Mastodon account at ${mdonServer} to access follower lists?\n\nThis does NOT share data with our servers (this is a local application running on your device).`);

    if (userResponse != true) {
      return;
    }
    
    if (_mdonClientId.length > 0 && _mdonClientSecret > 0) {
      MASTODON.promptForUserAuth();
    }
    else {
      MASTODON.registerApiApp(mdonServer, onCompleteAppRegistration);
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

  promptForUserAuth: function() {
    
  },

  onCompleteAppRegistration: function(appRegistrationResult) {
    _mdonClientId = appRegistrationResult.client_id;
    _mdonClientSecret = appRegistrationResult.client_secret;

    // and save to cache
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_ID]: _mdonClientId });
    chrome.storage.local.set({ [MASTODON.OAUTH_CACHE_KEY.CLIENT_SECRET]: _mdonClientSecret });

    promptForUserAuth();
  },

  registerApiApp: function(mdonServer, successCallback) {

    const form = new FormData();
    form.append('client_name', MASTODON.getVersionedAppName());
    form.append('redirect_uris', MASTODON.LOCAL_URI);
    form.append('scopes', MASTODON.APP_SCOPES);
    form.append('website', APP_HOME_URL);
    
    fetch(`https://${mdonServer}/api/v1/apps`, {
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