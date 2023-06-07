// for recording
var _recordingContext = null;
var _recording = false;
var _savables = [];
var _savableKeySet = new Set(); // to avoid storing dupes
var _savedKeySet = new Set();
var _observers = [];
// for scrolling
var _autoScroll = false;
var _lastDiscoveryTime = null;
var _lastScrollTime = null;
var _emptyScrollCount = 0;
var _preScrollCount = 0;
var _scrollIsPending = false;
var _countWhenScrollDoneSet;
// throttle
var _lastUnthrottleAttempt = null;

var RECORDING = {
  
  pollContext: async function() {
    let shouldTryCure = false;
    // handle scenario of an old tab lying around post-update
    // stackoverflow.com/questions/53939205/how-to-avoid-extension-context-invalidated-errors-when-messaging-after-an-exte
    try {
      _recordingContext = await SETTINGS.RECORDING.getContext();
    }
    catch(error) {
      if (error.toString().includes("Extension context invalidated")) {
        shouldTryCure = true;
      }
    }

    if (shouldTryCure == true) {
      console.log('cure invalid context...');
      return ES6.tryCureInvalidatedContext();
    }
    else {
      return true;
    }
  },

  shouldRecord: function() {
    
    if (!_recordingContext || _recordingContext.state == SETTINGS.RECORDING.STATE.OFF) {
      return false;
    }
    
    if (SETTINGS.RECORDING.isTimeExpiredManualContext(_recordingContext) == true) {
      return false;
    }

    const parsedUrl = URLPARSE.getParsedUrl();
    if (!parsedUrl || !parsedUrl.pageType) {
      return false;
    }

    if (_recordingContext.state == SETTINGS.RECORDING.STATE.MANUAL) {
      switch (parsedUrl.pageType) {
        case PAGETYPE.TWITTER.FOLLOWERS:
        case PAGETYPE.TWITTER.FOLLOWING:
        case PAGETYPE.NITTER.FOLLOWERS:
        case PAGETYPE.NITTER.FOLLOWING:
          return SETTINGS.RECORDING.getManualRecordsFollows(_recordingContext);
        case PAGETYPE.TWITTER.TWEETS:
        case PAGETYPE.NITTER.TWEETS:
          return SETTINGS.RECORDING.getManualRecordsTweets(_recordingContext);
        default:
          return false;
      }
    }
    else if (_recordingContext.state == SETTINGS.RECORDING.STATE.AUTO_SCROLL) {
      const contextParsedUrl = SETTINGS.RECORDING.getAutoParsedUrl(_recordingContext);
      if (parsedUrl.site != contextParsedUrl.site) {
        return false;
      }
      else if (STR.sameText(parsedUrl.owner, contextParsedUrl.owner) != true) {
        return false;
      }
      else {
        return PAGETYPE.finalize(parsedUrl.pageType) == PAGETYPE.finalize(contextParsedUrl.pageType);
      }
    }
    else {
      return false;
    }
  },
  
  getRecorder: function() {
    const parsedUrl = URLPARSE.getParsedUrl();
    
    if (parsedUrl && parsedUrl.pageType) {
      return RECORDERFACTORY.getRecorder(parsedUrl);
    }
    else {
      return undefined;
    }
  },
  
  setSaveTimer: function() {
    if (!_observers || _observers.length == 0) {
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
  
  stopRecording: function() {
    RECORDING.reinit();
    chrome.runtime.sendMessage({actionType: MSGTYPE.TOBACKGROUND.SETBADGE, badgeText: ''});
  },

  reinit: function() {
    _recording = false;
    _autoScroll = false;
    _savables = [];
    _savableKeySet = new Set(); // to avoid storing dupes
    _savedKeySet = new Set();

    if (_observers && _observers.length > 0) {
      for (let i = 0; i < _observers.length; i++) {
        let observer = _observers[i];
        observer.disconnect();
      }
    }
    _observers = [];

    _lastDiscoveryTime = null;
    _lastScrollTime = null;
    _emptyScrollCount = 0;
    _preScrollCount = 0;
    _countWhenScrollDoneSet = undefined;
    _scrollIsPending = false;
  },

  isThrottled: function() {
    const recorder = RECORDING.getRecorder();
    if (!recorder) { return false; }
    return recorder.isThrottled();
  },

  tryUnthrottle: function() {
    const recorder = RECORDING.getRecorder();
    recorder.tryUnthrottle();
  },

  scrollAsNeeded: function(avoidScrollIfHidden) {
    if (_autoScroll != true || !_observers || _observers.length == 0) {
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
    
    let minRest = 300;  // milliseconds
    let maxRest = 700;
    
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
    
    let throttled = false;
    if (scrollable === true) {
      // did we come up empty between prior run and now?
      let count = _savableKeySet.size + _savedKeySet.size;
      let emptyScroll = count <= _preScrollCount;

      if (emptyScroll === true) {
        
        if (isHidden === false) {
          // if page isn't visible it doesn't suggest there's no data (just user switched away)
          // so only boost emptyScrollCount if we're not hidden
          
          // but first, let's see if we have an empty scroll due to throttling
          throttled = this.isThrottled();
          _emptyScrollCount++;
        }
        
        scrollBy = 0.2; // we'll micro-scroll
      }
      else {
        _emptyScrollCount = 0;
      }
      
      if (!throttled && _emptyScrollCount > 4 && isHidden == false) {
        // stop scrolling (avoid re-queueing) because it looks like we're done
        _countWhenScrollDoneSet = count;
        chrome.runtime.sendMessage({
          actionType: MSGTYPE.TOBACKGROUND.SETBADGE, 
          badgeText: 'DONE'
        });
        return;
      }
      
      if (!throttled) {
        // record current count
        _preScrollCount = count;
        // finally, scroll
        _scrollIsPending = true;
        window.scrollBy(0, screen.availHeight * scrollBy);
        _scrollIsPending = false;
      }
    }
    
    if (throttled === true) {
      // our problem isn't loading or micro-scrolling, it's the throttle. 
      // so reset the empty scroll count so it doesn't cause us to think we're done when in fact we need to escape the throttle.
      _emptyScrollCount = 0;
      // if we haven't tried to unthrottle or 1 minute has gone by...
      if (!_lastUnthrottleAttempt || (Date.now() - _lastUnthrottleAttempt > 60000)) {
        console.log('retrying...');
        RECORDING.tryUnthrottle();
        _lastUnthrottleAttempt = Date.now();
      }
      
      console.log('waiting...');
      // we're throttled; say so
      chrome.runtime.sendMessage({
        actionType: MSGTYPE.TOBACKGROUND.SETBADGE, 
        badgeText: 'WAIT'
      });

    }
    else if (_lastUnthrottleAttempt) {
      // clear throttle-related public variables
      _lastUnthrottleAttempt = null;
      _emptyScrollCount = 0;
    }

    // queue it up again (but take our time if throttled anyway)
    let retryMs = throttled ? 5000 : 300;
    setTimeout(() => {
      RECORDING.scrollAsNeeded();
    }, retryMs);
  }
  
};