// for recording
var _savables = [];
var _savableKeySet = new Set(); // to avoid storing dupes
var _savedKeySet = new Set();
var _observer;
var _observerSettings;
// for scrolling
var _autoScroll = false;
var _lastDiscoveryTime = null;
var _lastScrollTime = null;
var _emptyScrollCount = 0;
var _preScrollCount = 0;
var _scrollIsPending = false;
var _countWhenScrollDoneSet;

var RECORDING = {
  
  getRecorder: function() {
    const parsedUrl = URLPARSE.getParsedUrl();
    
    if (parsedUrl) {
      return RECORDERFACTORY.getRecorder(parsedUrl.pageType);
    }
    else {
      return undefined;
    }
  },
  
  setSaveTimer: function() {
    if (!_observer) {
      return;
    }
    
    if (_savables.length > 0) {
      // tell background js to save to local storage cache
      chrome.runtime.sendMessage(
      {
        actionType: MSGTYPE.TOBACKGROUND.SAVE,
        payload: _savables
      }, 
      function(response) {
        if (response && response.success === true && response.saved && response.saved.length > 0) {
          const newSaveCnt = response.saved.length;
          for (let i = 0; i < response.saved.length; i++) {
            let item = response.saved[i];
            if (!_savedKeySet.has(item.handle.toLowerCase())) {
              _savedKeySet.add(item.handle.toLowerCase());
            }
          }
          
          if (_countWhenScrollDoneSet != _savableKeySet.size + _savedKeySet.size) {
            // tell background js to update badge (the condition is so that we don't set to a number when 'DONE' was in place)
            
            const badgeText = '+' + newSaveCnt;
            
            chrome.runtime.sendMessage({
              actionType: MSGTYPE.TOBACKGROUND.SETBADGE,
              badgeText: badgeText});
          }
        }
      });
      
      // clear
      _savables = [];
      _savableKeySet = new Set();
    }
    
    // every 5 seconds, see if time to save
    setTimeout(() => {
      RECORDING.setSaveTimer();
    }, 5000);
  },
  
  stopRecording: function(badgeText) {
    RECORDING.reinit();
    chrome.runtime.sendMessage({actionType: MSGTYPE.TOBACKGROUND.SETBADGE, badgeText: badgeText});
    chrome.storage.local.remove('recording');
  },

  reinit: function() {
    _savables = [];
    _savableKeySet = new Set(); // to avoid storing dupes
    _savedKeySet = new Set();

    if (_observer) {
      _observer.disconnect();
    }
    _observer = undefined;

    _lastDiscoveryTime = null;
    _lastScrollTime = null;
    _emptyScrollCount = 0;
    _preScrollCount = 0;
    _countWhenScrollDoneSet = undefined;
    _autoScroll = false;
    _scrollIsPending = false;
  },

  isThrottled: function() {
    const recorder = this.getRecorder();
    if (!recorder) { return false; }
    return recorder.isThrottled();
  },

  scrollAsNeeded: function(avoidScrollIfHidden) {
    
    if (_autoScroll != true || !_observer) {
      return;
    }
    
    let isHidden = document.hidden;

    let scrollable = true;
    
    if (isHidden === true && avoidScrollIfHidden === true) {
      scrollable = false;
    }
    
    if (_scrollIsPending === true) {
      scrollable = false;
    }
    
    let minRest = 500;  // milliseconds
    let maxRest = 1500;
    
    let minScrollBy = 0.7;
    let maxScrollBy = 0.8;
    
    if (scrollable === true && _lastDiscoveryTime == null) {
      // if we haven't found any records, scrolling isn't expected to help
      scrollable = false;
    }
    
    // random rest period
    let restMs = Math.random() * (maxRest - minRest) + minRest;
    let scrollBy = Math.random() * (maxScrollBy - minScrollBy) + minScrollBy;
    
    if (scrollable === true && Date.now() < _lastDiscoveryTime + restMs) {
      // last found item was recent; maybe it was part of a set, so wait
      scrollable = false;
    }
    
    if (scrollable === true && _lastScrollTime != null && Date.now() < _lastScrollTime + minRest) {
      // last scroll was recent; let's give it time to take effect
      scrollable = false;
    }
    
    if (scrollable === true) {
      // did we come up empty between prior run and now?
      let count = _savableKeySet.size + _savedKeySet.size;
      
      let emptyScroll = count <= _preScrollCount;
      
      if (emptyScroll === true) {
        
        if (isHidden === false) {
          // if page isn't visible it doesn't suggest there's no data (just user switched away)
          // so only boost emptyScrollCount if we're not hidden
          _emptyScrollCount++;
        }
        
        scrollBy = 0.2; // we'll micro-scroll
      }
      else {
        _emptyScrollCount = 0;
      }
      
      if (_emptyScrollCount > 4 && isHidden == false) {
        // stop scrolling (avoid re-queueing) because it looks like we're done
        _countWhenScrollDoneSet = count;
        chrome.runtime.sendMessage({
          actionType: MSGTYPE.TOBACKGROUND.SETBADGE, 
          badgeText: 'DONE'
        });
        
        return;
      }
      
      // record current count
      _preScrollCount = count;
      // finally, scroll
      _scrollIsPending = true;
      window.scrollBy(0, screen.availHeight * scrollBy);
      _scrollIsPending = false;
    }
    
    // queue it up again
    setTimeout(() => {
      RECORDING.scrollAsNeeded();
    }, 300);
  }
  
};