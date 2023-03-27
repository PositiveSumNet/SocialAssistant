// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

// for recording
var _savables = [];
var _savableKeySet = new Set(); // to avoid storing dupes
var _savedKeySet = new Set();
var _observer;
// for scrolling
var _autoScroll = false;
var _lastDiscoveryTime = null;
var _lastScrollTime = null;
var _emptyScrollCount = 0;
var _preScrollCount = 0;
var _scrollIsPending = false;
var _countWhenScrollDoneSet;

var _observerSettings = { 
  attributes: false, 
  childList: true, 
  subtree: true
};

// on startup, see if supposed to already be recording
chrome.storage.local.get(['recording'], function(result) {
  if (result.recording === true) {
    // here at startup, extension is in a 'load if we can' state
    const parsedUrl = URLPARSE.getParsedUrl();
    if (parsedUrl && parsedUrl.site === SITE.TWITTER) {
      tryStartRecordingTwitter();
    }
  }
});

const tryStartRecordingTwitter = function() {
  const warnIfNotYetReady = false;
  let col = TPARSE.getTwitterMainColumn(warnIfNotYetReady);
  
  if (col) {
    startRecording();
  }
  else {
    // try again in a couple seconds to see if page is loaded
    setTimeout(() => {
      tryStartRecordingTwitter();
    }, 2500);
  }
}

const shouldAvoidScrollIfHidden = function(site) {
  switch (site) {
    case SITE.TWITTER:
      return true;
    default:
      return false;
  }
}

const startRecording = function() {
  const parsedUrl = URLPARSE.getParsedUrl();
  const site = parsedUrl.site;
  
  if (!_observer && site === SITE.TWITTER) {
    // begin recording
    recordTwitter();
    // periodically check for collected items to save
    setFollowSaveTimer();
  }
}

// toggle recording and auto-scroll on/off
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch (request.actionType) {
    case MSGTYPE.RECORDING.START:
      startRecording();
      if (request.auto === true && _autoScroll === false) {
        _autoScroll = true;
        const parsedUrl = URLPARSE.getParsedUrl();
        const avoidScrollIfHidden = shouldAvoidScrollIfHidden(parsedUrl.site);
        scrollAsNeeded(avoidScrollIfHidden);
      }
      
      break;
    case MSGTYPE.RECORDING.STOP:
      stopRecording('');
      break;
    default:
      break;
  }
  
  sendResponse({auto: request.auto, success: true});
});

const reinit = function() {
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
}

const stopRecording = function(badgeText) {
  reinit();
  chrome.runtime.sendMessage({actionType: 'setBadge', badgeText: badgeText});
  chrome.storage.local.remove('recording');
}

const setFollowSaveTimer = function() {
  if (!_observer) {
    return;
  }
  
  if (_savables.length > 0) {
    // tell background js to save to local storage cache
    chrome.runtime.sendMessage(
    {
      actionType: 'save',
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
            actionType: 'setBadge',
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
    setFollowSaveTimer();
  }, 5000);
}

const twitterFollowMutationCallback = function(mutations) {
  for (let mutation of mutations) {
    if (mutation.type === 'childList') {
      let nodes = mutation.addedNodes;
      for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        
        if (TPARSE.isTwitterProfilePhoto(node)) {
          processTwitterFollows(node);
        }
      }
    }
  }
}

const recordTwitter = function() {
  
  const mainColumn = TPARSE.getTwitterMainColumn();
  if (!mainColumn) {
    return;
  }
  
  // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
  // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
  _observer = new MutationObserver(twitterFollowMutationCallback);
  _observer.observe(mainColumn, _observerSettings);
  processTwitterFollows(mainColumn);
}

const processTwitterFollows = function(scopeElm) {
  const parsedUrl = URLPARSE.getParsedUrl();
  const photos = TPARSE.getTwitterProfilePhotos(scopeElm);
  const ppl = [];
  
  for (let i = 0; i < photos.length; i++) {
    let photo = photos[i];
    let per = TFOLLOW.buildTwitterFollowFromPhoto(photo, parsedUrl);
    ppl.push(per);
  }
  
  if (ppl.length > 0) {
    for (let i = 0; i < ppl.length; i++) {
      let item = ppl[i];
      let key = `${item.handle}-${item.owner}-${item.pageType}`.toLowerCase();
      if (!_savableKeySet.has(key) && !_savedKeySet.has(key)) {
        // add newly found handles to what we want to save
        _savables.push(item);
        _savableKeySet.add(key);
        _lastDiscoveryTime = Date.now();
      }
    }
  }
}

const scrollAsNeeded = function(avoidScrollIfHidden) {
  
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
      
    if (_emptyScrollCount > 3 && isHidden == false) {
      // stop scrolling (avoid re-queueing) because it looks like we're done
      _countWhenScrollDoneSet = count;
      chrome.runtime.sendMessage({actionType: 'setBadge', badgeText: 'DONE'});
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
    scrollAsNeeded();
  }, 300);
}
