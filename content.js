/*
LISTEN for eligible elements via MutationObserver 
  If already listening, ignore the request message
  on observe
    add to _savableSet
    set _lastObserved = now
  until stop msg received
TIMER to see if _savableSet warrants saving
  5 seconds
  That's long enough that it warrants saving if it has any values
  if so, tell the background app to save
  requeue the timer (until stopped)
LISTEN for background app to tell us what it successfully saved
  remove each from _savableSet 
  _savedCtr++;
  updateBadgeCtr(_savedCtr);
TIMER to see if should scroll (if auto)
  original logic:
    every 0.5 to 1.5 seconds...
    get followers
    if none, tiny scroll and try again
    if none again, we're done
  new logic:
  every 0.5 seconds (min interval)
  calc desiredRest using a random to get a value of 0.5 to 1.5 seconds
    that's the baseline range
  see if desiredRest has elapsed vs _lastObserved (or if _lastObserved is null)
    if so...
      let savableCount = _savableSet.length;
      if savableCount == _preScrollSavableCount;
        emptyRun = true;  // it means that our prior scroll came up empty
        _emptyRunCtr++;
      if _emptyRunCtr > 2... declare us done; else
      _preScrollSavableCount = savableCount;
      scroll
        if emptyRun, tiny scroll, else regular size
  requeue the timer
POPUP should know state of whether recording, whether scrolling; offer 'stop' cmd
*/

// clear prior run's state
chrome.storage.local.remove('recording');

var _emptyRunCtr = 0;
var _scrollIsPending = false;
var _savables = [];
var _savableHandleSet = new Set(); // to avoid storing dupes
var _lastObserved = null;
var _savedCtrl = 0;
var _preScrollSavableCount = 0;
var _autoScroll = false;
var _parsedUrl;
var _observer;

console.log("Content Script initialized.");

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.actionType) {
      case 'startRecording':
        _parsedUrl = parseUrl(window.location.href);
        
        if (!_observer && _parsedUrl && _parsedUrl.site == 'twitter') {
          recordTwitter();
        }
        
        break;
      case 'stopRecording':
        _observer = undefined;
        _autoScroll = false;
        break;
      default:
        break;
    }
    
    sendResponse({auto: request.auto, success: true});
  }
);

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
  
  if (elms && elms.length == 1) {
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
      if (!_savableHandleSet.has(item.h)) {
        _savables.push(item);
        _savableHandleSet.add(item.h);
      }
    }
  }
}

const waitAndScroll = function(cntThisRun) {
  let minRest = 500;  // milliseconds
  let maxRest = 1500;
  let scrollBy = 0.8;
  
  if (cntThisRun == 0) {
    _emptyRunCtr++;
  }
  else {
    _emptyRunCtr = 0;
  }
  
  // backing off the more sure we are that we're done
  if (_emptyRunCtr > 0) {
    minRest = minRest * (_emptyRunCtr - 1);
    maxRest = maxRest * (_emptyRunCtr - 1);
    scrollBy = 0.2; // tiny scroll
  }
  
  let restMs = Math.random() * (maxRest - minRest) + minRest;
  
  _scrollIsPending = true;
  setTimeout(() => {
    window.scrollBy(0, screen.availHeight * scrollBy);
    _scrollIsPending = false;
  }, restMs)  
}
