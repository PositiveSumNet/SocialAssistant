// clear prior run's state
chrome.storage.local.remove('recording');

// clear badge
chrome.runtime.sendMessage({actionType: 'setBadge', badgeText: ''});

// init variables
// for recording
var _savables = [];
var _savableHandleSet = new Set(); // to avoid storing dupes
var _savedHandleSet = new Set();
var _parsedUrl;
var _observer;
// for scrolling
var _lastDiscoveryTime = null;
var _lastScrollTime = null;
var _emptyScrollCount = 0;
var _preScrollCount = 0;
var _autoScroll = false;
var _scrollIsPending = false;

console.log("Content Script initialized.");

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.actionType) {
      case 'startRecording':
        _parsedUrl = parseUrl(window.location.href);
        
        if (!_observer && _parsedUrl && _parsedUrl.site === 'twitter') {
          // begin recording
          recordTwitter();
          // periodically check for collected items to save
          setSaveTimer();
        }
        
        if (request.auto === true && _autoScroll === false) {
          _autoScroll = true;
          scrollAsNeeded();
        }
        
        break;
      case 'stopRecording':
        stopRecording('');
        break;
      default:
        break;
    }
    
    sendResponse({auto: request.auto, success: true});
  }
);

const stopRecording = function(badgeText) {
  _observer = undefined;
  _autoScroll = false;
  chrome.runtime.sendMessage({actionType: 'setBadge', badgeText: badgeText});
}

const setSaveTimer = function() {
  if (!_observer) {
    return;
  }
  
  if (_parsedUrl && _savables.length > 0) {
    // tell background js to save
    chrome.runtime.sendMessage(
    {
      actionType: 'save',
      pageType: _parsedUrl.pageType,
      owner: _parsedUrl.owner,
      payload: _savables
    }, 
    function(response) {
      if (response && response.success === true && response.saved && response.saved.length > 0) {
        for (let i = 0; i < response.saved.length; i++) {
          let item = response.saved[i];
          if (!_savedHandleSet.has(item.h)) {
            _savedHandleSet.add(item.h);
            //console.log(item);
          }
        }
        
        // tell background js to update badge
        chrome.runtime.sendMessage({
          actionType: 'setBadge',
          badgeText: badgeNum(_savedHandleSet.size)});
      }
    });
  }
  
  // every 5 seconds, see if time to save
  setTimeout(() => {
    setSaveTimer();
  }, 5000);
}

const recordTwitter = function() {
  
  const mainColumn = getTwitterMainColumn();
  
  if (!mainColumn) {
    return;
  }
  
  // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
  _observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          processTwitterFollowsOnPage(node);
        }
      }
    }
  });

  _observer.observe(mainColumn, { 
      attributes: false, 
      childList: true, 
      subtree: true }
  );

  processTwitterFollowsOnPage(mainColumn);
}

const getTwitterMainColumn = function() {
  const elms = document.querySelectorAll('div[data-testid="primaryColumn"]');
  
  if (elms && elms.length === 1) {
    return elms[0];
  }
  else {
    console.log('Cannot find twitter main column; page structure may have changed.');
  }
}

const processTwitterFollowsOnPage = function(parentElm) {
  
  // all links
  const all = Array.from(parentElm.getElementsByTagName('a')).map(function(a) {
    return { u: a.getAttribute('href'), d: a.innerText };
  });

  // those that are handles
  const handles = all.filter(function(a) {
    return a.u.startsWith('/') && a.d.startsWith('@');
  });
  
  // a hash of the urls
  const urlSet = new Set(handles.map(function(h) { return h.u }));
  
  const ppl = [];
  
  // loop through all anchors and spot those that are valid handles
  for (let i = 0; i < all.length; i++) {
    let item = all[i];
    
    if (item.u && urlSet.has(item.u) && item.d && !item.d.startsWith('@')) {
      let per = { h: '@' + item.u.substring(1), d: item.d };
      ppl.push(per);
    }
  }
  
  if (ppl.length > 0) {
    for (let i = 0; i < ppl.length; i++) {
      let item = ppl[i];
      if (!_savableHandleSet.has(item.h) && !_savedHandleSet.has(item.h)) {
        // add newly found handles to what we want to save
        _savables.push(item);
        _savableHandleSet.add(item.h);
        _lastDiscoveryTime = Date.now();
      }
    }
  }
}

const scrollAsNeeded = function() {
  
  if (_autoScroll != true || !_observer) {
    return;
  }
  
  let scrollable = true;
  
   if (_scrollIsPending === true) {
     scrollable = false;
   }
  
  let minRest = 500;  // milliseconds
  let maxRest = 1500;
  let scrollBy = 0.8;
  
  if (scrollable === true && _lastDiscoveryTime == null) {
    // if we haven't found any records, scrolling isn't expected to help
    scrollable = false;
  }
  
  // random rest period
  let restMs = Math.random() * (maxRest - minRest) + minRest;
  
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
    let count = _savableHandleSet.size + _savedHandleSet.size;
    let emptyScroll = count <= _preScrollCount;
    
    if (emptyScroll === true) {
      _emptyScrollCount++;
      scrollBy = 0.2; // we'll micro-scroll
    }
    else {
      _emptyScrollCount = 0;
    }
    
    if (_emptyScrollCount > 3) {
      // declare this done!
      stopRecording('DONE');
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
  }, 500);
}