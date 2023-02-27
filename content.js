// clear prior run's state
chrome.storage.local.remove('recording');

// clear badge
chrome.runtime.sendMessage({actionType: 'setBadge', badgeText: ''});

// reinit variables
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
var _countWhenScrollDoneSet;

//console.log("Content Script initialized.");

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
          let avoidScrollIfHidden = (_parsedUrl.site === 'twitter');
          scrollAsNeeded(avoidScrollIfHidden);
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

const reinit = function() {
  _savables = [];
  _savableHandleSet = new Set(); // to avoid storing dupes
  _savedHandleSet = new Set();
  _parsedUrl = undefined;
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

const setSaveTimer = function() {
  if (!_observer) {
    return;
  }
  
  if (_parsedUrl && _savables.length > 0) {
    // tell background js to save to local storage cache
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
          if (!_savedHandleSet.has(item.h.toLowerCase())) {
            _savedHandleSet.add(item.h.toLowerCase());
          }
        }
        
        if (_countWhenScrollDoneSet != _savableHandleSet.size + _savedHandleSet.size) {
          // tell background js to update badge (the condition is so that we don't set to a number when 'DONE' was in place)
          chrome.runtime.sendMessage({
            actionType: 'setBadge',
            badgeText: badgeNum(_savedHandleSet.size)});
        }
      }
    });
    
    // clear
    _savables = [];
    _savableHandleSet = new Set();
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
    console.error('Cannot find twitter main column; page structure may have changed.');
  }
}

const processTwitterFollowsOnPage = function(parentElm) {
  
  // all links
  const all = Array.from(parentElm.getElementsByTagName('a')).map(function(a) {
    return { u: a.getAttribute('href'), d: a.innerText, a: a };
  });
  
  // those that are handles
  const handles = all.filter(function(a) {
    return a.u.startsWith('/') && a.d.startsWith('@');
  });
  
  // a hash of the urls
  const urlSet = new Set(handles.map(function(h) { return h.u.toLowerCase() }));
  
  const ppl = [];
  const photos = [];
  
  // loop through all anchors and spot those that are valid handles
  for (let i = 0; i < all.length; i++) {
    let item = all[i];
    
    if (item.u && urlSet.has(item.u.toLowerCase())) {
      let h = '@' + item.u.substring(1);
      if (item.d && item.d.length > 1) {
        if (!item.d.startsWith('@')) {
          // it had display text (not the @handle)
          // this is the display name title anchor, usable as the handle/display pair
          let per = { h: h, d: item.d };
          ppl.push(per);
        }
      }
      // is it the image thumbnail?
      let photoImg = getTwitterProfileImg(item.a);
      
      if (photoImg) {
        let photo = { h: h, img: photoImg.src };
        photos.push(photo);
      }
    }
  }
  
  if (ppl.length > 0) {
    for (let i = 0; i < ppl.length; i++) {
      let item = ppl[i];
      
      if (!_savableHandleSet.has(item.h.toLowerCase()) && !_savedHandleSet.has(item.h.toLowerCase())) {
        // add newly found handles to what we want to save
        // first grab its photo url
        let photo = photos.find(function(p) {
          return sameText(p.h, item.h);
        });
        
        if (photo) {
          item.imgCdnUrl = photo.img;
        }
        
        _savables.push(item);
        _savableHandleSet.add(item.h.toLowerCase());
        _lastDiscoveryTime = Date.now();
      }
    }
  }
}

// passing in anchor element for a given user; seek img thumbnail child
const getTwitterProfileImg = function(a) {
  return Array.from(a.getElementsByTagName('img')).find(function(img) {
    return img.getAttribute('src').startsWith('https://pbs.twimg.com/profile_images/')
  });
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
  }, 500);
}
