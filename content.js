// for recording
var _savableFollows = [];
var _savableFollowHandleSet = new Set(); // to avoid storing dupes
var _savedFollowHandleSet = new Set();
var _photos = [];
var _photoHandleSet = new Set();
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

const getParsedUrl = function() {
  return parseUrl(window.location.href);
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.actionType) {
      case 'startRecording':
        var parsedUrl = getParsedUrl();
        
        if (!_observer && parsedUrl.site === 'twitter') {
          // begin recording
          recordTwitter();
          // periodically check for collected items to save
          setFollowSaveTimer();
        }
        
        if (request.auto === true && _autoScroll === false) {
          _autoScroll = true;
          let avoidScrollIfHidden = (parsedUrl.site === 'twitter');
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
  _savableFollows = [];
  _savableFollowHandleSet = new Set(); // to avoid storing dupes
  _savedFollowHandleSet = new Set();
  _photos = [];
  _photoHandleSet = new Set();
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

const ensureFollowPhotosInfused = function() {
  for (let i = 0; i < _savableFollows.length; i++) {
    let follow = _savableFollows[i];
    let followUrl = twitterProfileUrlFromHandle(follow.h).toLowerCase();
    
    if (!follow.imgCdnUrl && _photoHandleSet.has(followUrl)) {
      let photo = _photos.find(function(p) {
        return sameText(p.href, followUrl);
      });
      
      if (photo) {
        follow.imgCdnUrl = photo.imgSrc;
      }
    }
  }
}

const setFollowSaveTimer = function() {
  if (!_observer) {
    return;
  }
  
  if (_savableFollows.length > 0) {
    ensureFollowPhotosInfused();
    
    // tell background js to save to local storage cache
    chrome.runtime.sendMessage(
    {
      actionType: 'save',
      payload: _savableFollows
    }, 
    function(response) {
      if (response && response.success === true && response.saved && response.saved.length > 0) {
        for (let i = 0; i < response.saved.length; i++) {
          let item = response.saved[i];
          if (!_savedFollowHandleSet.has(item.h.toLowerCase())) {
            _savedFollowHandleSet.add(item.h.toLowerCase());
          }
        }
        
        if (_countWhenScrollDoneSet != _savableFollowHandleSet.size + _savedFollowHandleSet.size) {
          // tell background js to update badge (the condition is so that we don't set to a number when 'DONE' was in place)
          chrome.runtime.sendMessage({
            actionType: 'setBadge',
            badgeText: badgeNum(_savedFollowHandleSet.size)});
        }
      }
    });
    
    // clear
    _savableFollows = [];
    _savableFollowHandleSet = new Set();
    _photos = [];
    _photoHandleSet = new Set();
  }
  
  // every 5 seconds, see if time to save
  setTimeout(() => {
    setFollowSaveTimer();
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
          processTwitterFollowsAndPhotos(node);
        }
      }
    }
  });

  _observer.observe(mainColumn, { 
      attributes: false, 
      childList: true, 
      subtree: true }
  );

  processTwitterFollowsAndPhotos(mainColumn);
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

const processTwitterFollowsAndPhotos = function(scopeElm) {
  processTwitterFollowsOnPage(scopeElm);
  processTwitterPhotosOnPage(scopeElm);
}

const isTwitterProfilePhoto = function(elm) {
  const srcPrefix = 'https://pbs.twimg.com/profile_images';
  const isPhoto = elm && sameText(elm.tagName, 'img') && elm.getAttribute('src').startsWith(srcPrefix);
  return isPhoto;
}

const processTwitterPhotosOnPage = function(scopeElm) {
  let photos = [];
  
  if (isTwitterProfilePhoto(scopeElm) === true) {
    const photo = buildLinkedImg(scopeElm);
    if (photo) {
      photos.push(photo);
    }
  }
  else {
    photos = Array.from(scopeElm.getElementsByTagName('img')).filter(function(img) {
      return isTwitterProfilePhoto(img);
    }).map(function(img) {
      return buildLinkedImg(img);
    }).filter(function(p) {
      return (p && p.href && p.imgSrc);
    });
  }
  
  for (let i = 0; i < photos.length; i++) {
    let photo = photos[i];
    if (!_photoHandleSet.has(photo.href.toLowerCase())) {
      _photos.push(photo);
      _photoHandleSet.add(photo.href.toLowerCase());
    }
  }
}

// exclude the '@'
const twitterHandleFromProfileUrl = function(url) {
  let trimmed = url.startsWith('/') ? url.substring(1) : url;
  return  trimmed;
}

const twitterProfileUrlFromHandle = function(handle) {
  let trimmed = handle.startsWith('@') ? handle.substring(1) : handle;
  return  '/' + trimmed;
}

const processTwitterFollowsOnPage = function(scopeElm) {
  
  const parsedUrl = getParsedUrl();
  
  // all links
  const all = Array.from(scopeElm.getElementsByTagName('a')).map(function(a) {
    return { u: a.getAttribute('href'), d: a.innerText };
  });
  
  // those that are handles
  const handles = all.filter(function(a) {
    return a.u.startsWith('/') && a.d.startsWith('@');
  });
  
  // a hash of the urls
  const urlSet = new Set(handles.map(function(h) { return h.u.toLowerCase() }));
  
  const ppl = [];
  
  // loop through all anchors and spot those that are valid handles
  for (let i = 0; i < all.length; i++) {
    let item = all[i];
    
    if (item.u && urlSet.has(item.u.toLowerCase())) {
      let h = twitterHandleFromProfileUrl(item.u);
      if (item.d && item.d.length > 1) {
        if (!item.d.startsWith('@')) {
          // it had display text (not the @handle)
          // this is the display name title anchor, usable as the handle/display pair
          let per = { h: h, d: item.d, pageType: parsedUrl.pageType, owner: parsedUrl.owner };
          ppl.push(per);
        }
      }
    }
  }
  
  if (ppl.length > 0) {
    for (let i = 0; i < ppl.length; i++) {
      let item = ppl[i];
      
      if (!_savableFollowHandleSet.has(item.h.toLowerCase()) && !_savedFollowHandleSet.has(item.h.toLowerCase())) {
        // add newly found handles to what we want to save
        
        _savableFollows.push(item);
        _savableFollowHandleSet.add(item.h.toLowerCase());
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
    let count = _savableFollowHandleSet.size + _savedFollowHandleSet.size;
    
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
