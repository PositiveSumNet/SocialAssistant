var MDON_UI = {
  bindElements: function() {
    document.getElementById('mdonLaunchAuthBtn').onclick = function(event) {
      MASTODON.launchAuth();
      return false;
    };
    
    document.getElementById('mdonAcceptAuthBtn').onclick = function(event) {
      MASTODON.userSubmittedAuthCode();
      return false;
    };
    
    document.getElementById('mdonDisconnect').onclick = function(event) {
      MASTODON.disconnect();
      return false;
    };
    document.getElementById('mdonDisconnect2').onclick = function(event) {
      MASTODON.disconnect();
      return false;
    };
    
    document.getElementById('mdonDownloadFollowingListBtn').onclick = function(event) {
      MASTODON.downloadConnections(CONN_DIRECTION.FOLLOWING);
      return false;
    };
    
    document.getElementById('mdonDownloadFollowersListBtn').onclick = function(event) {
      MASTODON.downloadConnections(CONN_DIRECTION.FOLLOWERS);
      return false;
    };
    
    document.getElementById('mdonStopDownloadBtn').onclick = function(event) {
      MASTODON.abortPaging();
      return false;
    };
    
    document.getElementById('btnFollowAllOnMastodon').onclick = function(event) {
      if (!_mdonRememberedUser || !_mdonRememberedUser.Handle) {
        activateMastodonTab();
      }
      else {
        MASTODON.followAllVisibleMastodonAccounts();
      }
    
      return false;
    };
    
    txtRemoteMdon.addEventListener('keydown', function(event) {
      if (event.key === "Backspace" || event.key === "Delete") {
        _deletingMdonRemoteOwner = true;
      }
      else {
        _deletingMdonRemoteOwner = false;
      }
    });
    
    const mdonAccountRemoteSearch = ES6.debounce((event) => {
      const userInput = txtRemoteMdon.value || '';
    
      // min 5 characters to search
      if (!userInput || userInput.length < 5) {
        MASTODON.initRemoteOwnerPivotPicker(true);
      }
      
      MASTODON.suggestRemoteAccountOwner(userInput);
    }, 250);
    // ... uses debounce
    txtRemoteMdon.addEventListener('input', mdonAccountRemoteSearch);
    
    // choose owner from typeahead results
    mdonRemoteOwnerPivotPicker.onclick = function(event) {
      txtRemoteMdon.value = handleFromClickedOwner(event);
      MASTODON.onChooseRemoteOwner();
    };
    
    document.getElementById('clearMdonCacheBtn').onclick = function(event) {
      MASTODON.disconnect(true);
      return false;
    };
  }
};