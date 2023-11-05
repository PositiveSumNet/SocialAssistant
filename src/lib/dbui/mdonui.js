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
        TABS_UI.activateMastodonTab();
      }
      else {
        MASTODON.followAllVisibleMastodonAccounts();
      }
    
      return false;
    };
    
    document.getElementById('txtMdonDownloadConnsFor').addEventListener('keydown', function(event) {
      if (event.key === "Backspace" || event.key === "Delete") {
        _deletingMdonRemoteOwner = true;
      }
      else {
        _deletingMdonRemoteOwner = false;
      }
    });
    
    const mdonAccountRemoteSearch = ES6.debounce((event) => {
      const userInput = document.getElementById('txtMdonDownloadConnsFor').value || '';
    
      // min 5 characters to search
      if (!userInput || userInput.length < 5) {
        MASTODON.initRemoteOwnerPivotPicker(true);
      }
      
      MASTODON.suggestRemoteAccountOwner(userInput);
    }, 250);
    // ... uses debounce
    document.getElementById('txtMdonDownloadConnsFor').addEventListener('input', mdonAccountRemoteSearch);
    
    // choose owner from typeahead results
    const mdonRemoteOwnerPivotPicker = document.getElementById('mdonRemoteOwnerPivotPicker');
    mdonRemoteOwnerPivotPicker.onclick = function(event) {
      document.getElementById('txtMdonDownloadConnsFor').value = QUERYING_UI.OWNER.handleFromClickedOwner(event);
      MASTODON.onChooseRemoteOwner();
    };
    
    document.getElementById('clearMdonCacheBtn').onclick = function(event) {
      MASTODON.disconnect(true);
      return false;
    };
  }
};