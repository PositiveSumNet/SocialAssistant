// this functions more like a partial class of index.js in that it doesn't 
// separate concerns of dom elements and public variables all that well (for now)

// api access
// these are set on startup from the chrome (secure) cache
// the auth is for the user's logged-in server
var _mdonClientId = '';
var _mdonClientSecret = '';
var _mdonAccessToken = '';
var _mdonUserAuthToken = '';

// person objects
var _mdonRememberedUser = {};
var _mdonConnectedUser = {};
var _mdonDownloadConnsFor = {};

var _mdonApiCallsRemaining = 300;
var _mdonApilimitResetAt = '';
var _mastodonPaging = {};
var _fetchedCtr = 0;
var _savedCtr = 0;

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
    USER_AUTH_TOKEN: 'mdonUserAuthToken'
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

  getFollowDirectionFromPageType: function(pageType) {
    switch(pageType) {
      case PAGETYPE.MASTODON.FOLLOWERS: 
        return CONN_DIRECTION.FOLLOWERS;
      case PAGETYPE.MASTODON.FOLLOWING:
        return CONN_DIRECTION.FOLLOWING;
      default:
        return undefined;
    }
  },

  isConnected: function() {
    return MASTODON.getConnectedUserId().length > 0;
  },

  // todo: pass in an object with the elements instead
  render: function() {

    // initial state should hide paged list ui
    const haveHadMdonDownloadOk = SETTINGS.hadSuccessfulMdonDownload();
    if (!haveHadMdonDownloadOk) {
      document.getElementById('dbui').style.display = 'none';
    }
    else {
      document.getElementById('dbui').style.display = 'flex';
    }

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

      const alreadyConnectedInThisSession = MASTODON.isConnected();
      if (!alreadyConnectedInThisSession) {
        mdonDownloadConnsUi.style.display = 'none';
        mdonReconnecting.style.display = 'block';
        mdonReconnectingAs.textContent = `Reconnecting as ${MASTODON.getRememberedUserHandle()}...`;
        
        MASTODON.getLoggedInUser();
      }
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

  warnOfApiThrottleAsNeeded: function() {
    if (_mdonApilimitResetAt && _mdonApiCallsRemaining < 3) {
      const dt = new Date(_mdonApilimitResetAt);
      // the message is phrased this way because we choose not to retain paging state across tabs and sessions.
      const msg = `The Mastodon API needs to rest until ${dt.toLocaleTimeString()}.`;
      MASTODON.setErrorMsg(msg);
    }
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

    MASTODON.abortPaging();
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

  // owner is optional (depends on context)
  accountToPerson: function(account, ownerHandle) {
    if (!account) { return account; }

    let fullHandle = '';
    if (account.url && account.url.startsWith('http') && account.url.indexOf('@') > -1) {
      // valid url
      fullHandle = STR.MASTODON.accountFromProfileUrl(account.url);
    }
    else {
      // console.log(`Non-standard mastodon profile url: ${account.url}`);

      // e.g., we encountered this, and that forced the else case...
      // url: https://hub.netzgemeinde.eu/channel/jupiter_rowland
      // acct: jupiter_rowland@hub.netzgemeinde.eu
      const stripped = STR.stripPrefix(account.acct, '@');

      if (stripped.indexOf('@') > -1) {
        // the server is attached
        fullHandle = STR.ensurePrefix(account.acct, '@');
      }
      else {
        // on our home server, the server is not provided
        fullHandle = `@${stripped}@${SETTINGS.getMdonServer()}`;
      }

      // console.log(`Non-standard account parsed to: ${fullHandle}`);
    }

    const per = {};
    per[PERSON_ATTR.OWNER_HANDLE] = ownerHandle;
    per[PERSON_ATTR.SITE] = SITE.MASTODON;
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

  setDownloadConnsFor: function(accountAsPerson, resetOwner) {
    _mdonDownloadConnsFor = accountAsPerson;
    document.getElementById('mdonDownloadFollowingListBtn').textContent = `Save Following List (${accountAsPerson.FollowingCount})`;
    document.getElementById('mdonDownloadFollowersListBtn').textContent = `Save Followers (${accountAsPerson.FollowersCount})`;
    MASTODON.clearDownloadStatus();

    if (resetOwner) {
      document.getElementById('txtOwnerHandle').value = accountAsPerson.Handle;
    }

    resetPage();
    resetFilters();
    MASTODON.renderNetwork();
  },

  onReceivedLoggedInUser: function(data) {
    _mdonConnectedUser = MASTODON.accountToPerson(data);
    // copy so it's not a shared reference
    _mdonRememberedUser = MASTODON.accountToPerson(data);
    MASTODON.setDownloadConnsFor(MASTODON.accountToPerson(data));
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
        
        const img64Fn = IMAGE.getImageBase64(data.avatar_static);
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

  abortPaging: function() {
    _mastodonPaging = {};
    MASTODON.showStopBtn(false);
  },

  showStopBtn: function(show) {
    const elm = document.getElementById('mdonStopDownloadBtn');
    
    if (show) {
      elm.style.display = 'inline';
    }
    else {
      elm.style.display = 'none';
    }
  },

  applyPagingNext: function(url) {
    if (_mastodonPaging && _mastodonPaging.next && _mastodonPaging.next.parmValue && _mastodonPaging.next.parmValue.length > 0 && STR.sameText(_mastodonPaging.baseUrl, url)) {
      return `${url}&${_mastodonPaging.next.parmName}=${_mastodonPaging.next.parmValue}`;
    }
    else {
      return url;
    }
  },

  applyPagingPrev: function(url) {
    if (_mastodonPaging && _mastodonPaging.prev && _mastodonPaging.prev.parmValue && _mastodonPaging.prev.parmValue.length > 0 && STR.sameText(_mastodonPaging.baseUrl, url)) {
      return `${url}&${_mastodonPaging.prev.parmName}=${_mastodonPaging.prev.parmValue}`;
    }
    else {
      return url;
    }
  },

  // if a new request has initiated and this is continuing a prior request, need to stop this one so they don't conflict (the user has moved on to something else and we're not trying to multi-thread)
  compatiblePaging: function(api, accountId, followDirection) {
    if (_mastodonPaging.api != api || _mastodonPaging.accountId != accountId || _mastodonPaging.followDirection != followDirection) {
      // a different action has been kicked off since
      console.log('Changed paging request');
      return false;
    }
    else if (api === 'accounts' && accountId != _mdonDownloadConnsFor.SourceId) {
      // a new network owner has been selected
      console.log('Network owner change');
      return false;
    }
    else {
      return true;
    }
  },

  clearDownloadStatus: function() {
    document.getElementById('mastodonDownloadStatus').textContent = '';
    document.getElementById('mastodonDownloadingIcon').style.display = 'none';
    _fetchedCtr = 0;

    document.getElementById('mastodonSavingStatus').textContent = '';
    document.getElementById('mastodonSavingDoneIcon').style.display = 'none';
    document.getElementById('mastodonSavingIcon').style.display = 'none';
    _savedCtr = 0;
  },

  updateConnectionDownloadStatus: function(ownerAccountId, pagedPeople, followDirection) {
    
    const compatible = MASTODON.compatiblePaging('accounts', ownerAccountId, followDirection);
    
    if (compatible) {
      _fetchedCtr += pagedPeople.length;
    }
    else {
      _fetchedCtr = 0;
    }

    // refer to paging and compare vs. follower/following count etc.
    let outOf = 0;

    if (followDirection === CONN_DIRECTION.FOLLOWERS) {
      outOf = _mdonDownloadConnsFor.FollowersCount;
    }
    else if (followDirection === CONN_DIRECTION.FOLLOWING) {
      outOf = _mdonDownloadConnsFor.FollowingCount;
    }
    else {
      return;
    }

    const msg = `${_fetchedCtr} of ${outOf}`;
    document.getElementById('mastodonDownloadStatus').textContent = msg;
    document.getElementById('mastodonDownloadingIcon').style.display = 'inline';

    if (_fetchedCtr === outOf) {
      // we can hide our downloading information (no great reason to leave both counters up)
      document.getElementById('mastodonDownloadingIcon').style.display = 'none';
      document.getElementById('mastodonDownloadStatus').style.display = 'none';

      // ensure that the saving icon is displayed so the user knows there's more to do
      document.getElementById('mastodonSavingIcon').style.display = 'inline';
      const savingStatusElm = document.getElementById('mastodonSavingStatus');

      if (!savingStatusElm.textContent || savingStatusElm.textContent.length === 0) {
        savingStatusElm.textContent = 'Saving...';
      }
      savingStatusElm.style.display = 'inline';
    }
  },

  onGotSavedCount: function(increment, ownerAccountId, followDirection) {
    
    const compatible = MASTODON.compatiblePaging('accounts', ownerAccountId, followDirection);
    
    if (compatible) {
      _savedCtr += increment;
    }
    else {
      _savedCtr = 0;
    }

    // refer to paging and compare vs. follower/following count etc.
    let outOf = 0;

    if (followDirection === CONN_DIRECTION.FOLLOWERS) {
      outOf = _mdonDownloadConnsFor.FollowersCount;
    }
    else if (followDirection === CONN_DIRECTION.FOLLOWING) {
      outOf = _mdonDownloadConnsFor.FollowingCount;
    }
    else {
      return;
    }

    const msg = `${_savedCtr} of ${outOf}`;
    document.getElementById('mastodonSavingStatus').textContent = msg;
    document.getElementById('mastodonSavingIcon').style.display = 'inline';

    if (_savedCtr === outOf) {
      document.getElementById('mastodonSavingIcon').style.display = 'none';
      document.getElementById('mastodonSavingDoneIcon').style.display = 'inline';
      SETTINGS.markMdonDownloadSuccess();
      MASTODON.renderNetwork();
    }
  },

  saveConnections: function(ownerAccountId, ppl, followDirection) {
    if (ownerAccountId != _mdonDownloadConnsFor.SourceId) {
      MASTODON.clearDownloadStatus();
    }
    else {
      // so far we've downloaded but haven't yet saved (let alone received the on-saved callback)
      MASTODON.updateConnectionDownloadStatus(ownerAccountId, ppl, followDirection);
    }

    const pageType = PAGETYPE.getPageType(SITE.MASTODON, followDirection);

    // console.log(ppl);

    // worker lives in index.js (see note at top of this file)
    // worker will receive this message, do the save, and call us back on-save to increment the saved counter
    worker.postMessage( { 
      records: ppl, 
      pageType: pageType, 
      actionType: MSGTYPE.TODB.SAVE_PAGE_RECORDS,
      metadata: {
        ownerAccountId: ownerAccountId
      },
      onSuccessCountMsg: MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT
    } );
  },

  downloadConnections: function(followDirection, isSubsequentPage) {
    
    if (!_mdonDownloadConnsFor || !_mdonDownloadConnsFor.SourceId || _mdonDownloadConnsFor.SourceId.length === 0) {
      
      // TODO: be more robust about allowing the search to happen now (e.g. in case pasted a handle without picking one)
      
      MASTODON.setErrorMsg('Owner account is not set. Use the typeahead.');
      return;
    }

    MASTODON.clearErrorMsg();
    MASTODON.warnOfApiThrottleAsNeeded();
    
    const api = 'accounts';
    const accountId = _mdonDownloadConnsFor.SourceId;
    const ownerHandle = _mdonDownloadConnsFor.Handle;
    const server = STR.MASTODON.serverFromHandle(ownerHandle);

    let url = `https://${server}/api/v1/${api}/${accountId}/${followDirection}?limit=80`;
    
    if (isSubsequentPage === true) {
      // this is not the first call
      if (!MASTODON.compatiblePaging(api, accountId, followDirection)) {
        console.log(`${followDirection} connections download for ${_mdonDownloadConnsFor.Handle} was aborted.`);
        return;
      }
      // append paging info from prior call
      url = MASTODON.applyPagingNext(url);
    }
    else {
      // first call; clear status before beginning
      MASTODON.clearDownloadStatus();
      _mastodonPaging.api = api;
      _mastodonPaging.accountId = _mdonDownloadConnsFor.SourceId,
      _mastodonPaging.followDirection = followDirection;
    }

    MASTODON.showStopBtn(true);

    fetch(url, {
        method: 'GET'
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        // we should clear cache!
        MASTODON.onConnectFailure(response);
        return;
      }
      
      const parsedHeaders = STR.MASTODON.parseResponseHeaders(response);
      _mdonApiCallsRemaining = parsedHeaders.apiCallsRemaining;
      _mdonApilimitResetAt = parsedHeaders.apiLimitResetAt;

      response.json().then(function(data) {
        const ppl = data.map(function(acct) {
          return MASTODON.accountToPerson(acct, ownerHandle);
        });

        MASTODON.saveConnections(accountId, ppl, followDirection);

        if (MASTODON.compatiblePaging(api, accountId, followDirection)) {
          if (parsedHeaders.paging.next && parsedHeaders.paging.next.parmValue) {
            _mastodonPaging = parsedHeaders.paging;
            // append parameters specific to fetching connections
            _mastodonPaging.api = api;
            _mastodonPaging.accountId = accountId;
            _mastodonPaging.followDirection = followDirection;
            console.log('Fetch next page...');
            try
            {
              MASTODON.downloadConnections(followDirection, true);
            }
            catch(error) {
              // error will be handled on the invocation; doesn't have to bubble up
            }
            return;
          }
          else {
            console.log('ALL DONE!');
            MASTODON.showStopBtn(false);
          }
        }
        else {
          console.log('Paging halted; user request has changed.');
        }
      });
    })
    .catch(function(err) {
        // we should clear cache!
        MASTODON.onConnectFailure(err);
    });
  },

  suggestRemoteAccountOwner: function(userInput) {
    if (userInput.length === 0) {
      // reset the text
      document.getElementById('mdonDownloadFollowingListBtn').textContent = `Save Following List`;
      document.getElementById('mdonDownloadFollowersListBtn').textContent = `Save Following List`;
    }
    else {
      MASTODON.searchRemoteAccounts(userInput, MASTODON.onSearchedRemoteAccountOwners);
    }
    MASTODON.clearDownloadStatus();
  },

  onSearchedRemoteAccountOwners: function(owners) {
    MASTODON.initRemoteOwnerPivotPicker(false);
    
    if (owners.length === 1 && !_deletingMdonRemoteOwner) {
      // exact match; pick it! (after an extra check that the user isn't 
      // trying to delete, in which case auto-complete would be annoying)
      txtRemoteMdon.value = STR.stripPrefix(owners[0].Handle, '@');
      MASTODON.onChooseRemoteOwner();
    }
    else {
      for (i = 0; i < owners.length; i++) {
        // renderPerson uses DOMPurify.sanitize
        mdonRemoteOwnerPivotPicker.innerHTML += RENDER.renderPerson(owners[i], 'owner', RENDER_CONTEXT.PERSON.ACCOUNT_OWNER);
      }

      IMAGE.resolveDeferredLoadImages(mdonRemoteOwnerPivotPicker);
    }
  },

  initRemoteOwnerPivotPicker: function(hide) {
    // mdonRemoteOwnerPivotPicker is declared at index.js
    mdonRemoteOwnerPivotPicker.replaceChildren();

    if (hide) {
      mdonRemoteOwnerPivotPicker.style.display = 'none';
    }
    else {
      mdonRemoteOwnerPivotPicker.style.display = 'block';
    }
  },

  // the textbox now has the account text; need to ensure the _mdonDownloadConnsFor variable is set too
  onChooseRemoteOwner: function() {
    MASTODON.searchRemoteAccounts(txtRemoteMdon.value, MASTODON.onResolvedChosenRemoteOwner, 1, 1);
    MASTODON.clearRemoteOwnerPivotPicker(true);
  },

  onResolvedChosenRemoteOwner: function(result) {
    if (result && result.length === 1) {
      const person = result[0];
      MASTODON.setDownloadConnsFor(person, true);
    }
  },

  renderNetwork: function() {
    // placeholder to render the list...
  },

  searchRemoteAccounts: function(searchText, successCallback, searchLimit, takeLimit) {
    const exactMatch = (searchLimit === 1 && takeLimit === 1) || STR.MASTODON.couldBeFullHandle(searchText);

    if (exactMatch) {
      searchText = STR.ensurePrefix(searchText, '@');
    }

    searchLimit = searchLimit || 10;
    takeLimit = takeLimit || 5;
    
    const server = exactMatch ? STR.MASTODON.serverFromHandle(searchText) : SETTINGS.getMdonServer();

    MASTODON.clearErrorMsg();
    MASTODON.warnOfApiThrottleAsNeeded();
    
    let url = `https://${server}/api/v2/search?type=accounts&q=${searchText}&limit=${searchLimit}`;

    fetch(url, {
      method: 'GET'
    })
    .then(function(response) { 
      
      if (response.status !== 200) {
        // we should clear cache!
        MASTODON.onConnectFailure(response);
        return;
      }
      
      const parsedHeaders = STR.MASTODON.parseResponseHeaders(response);
      _mdonApiCallsRemaining = parsedHeaders.apiCallsRemaining;
      _mdonApilimitResetAt = parsedHeaders.apiLimitResetAt;

      response.json().then(function(data) {
        const ppl = data.accounts.map(function(acct) {
          return MASTODON.accountToPerson(acct);
        });

        let ordered = [];
        if (exactMatch) {
          const matchedPerson = ppl.find(function(per) { return per.Handle === searchText; });

          if (matchedPerson) {
            ordered.push(matchedPerson);
          }
        }
        else {
          // flaviocopes.com/how-to-sort-array-of-objects-by-property-javascript/
          // take the first 5
          ordered = ppl.sort((a, b) => (a.FollowingCount > b.FollowingCount) ? -1 : 1).slice(0, takeLimit);
        }
        successCallback(ordered);
      });
    })
    .catch(function(err) {
        // we should clear cache!
        MASTODON.onConnectFailure(err);
    });

  }
};
