// api access
let _mdonClientId = '';
let _mdonClientSecret = '';
let _mdonAccessToken = '';
let _mdonAuthToken = '';

var MASTODON = {

  // constants
  LOCAL_URI: 'urn:ietf:wg:oauth:2.0:oob',
  APP_NAME: 'Whosum for Mastodon',
  APP_SCOPES: 'read write read:follows write:follows',
  
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

    alert('cool!');
  }

};