// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

// for recording
var _savableFollows = [];
var _savableFollowKeySet = new Set(); // to avoid storing dupes
var _savedFollowHandleSet = new Set();
var _twitterObserver;
// for scrolling
var _lastDiscoveryTime = null;
var _lastScrollTime = null;
var _emptyScrollCount = 0;
var _preScrollCount = 0;
var _autoScroll = false;
var _scrollIsPending = false;
var _countWhenScrollDoneSet;

var _mutationSettings = { 
  attributes: false, 
  childList: true, 
  subtree: true
};

// on startup, see if supposed to already be recording
chrome.storage.local.get(['recording'], function(result) {
  if (result.recording === true) {
    // here at startup, extension is in a 'load if we can' state
    const parsedUrl = getParsedUrl();
    if (parsedUrl && parsedUrl.site === SITE_TWITTER) {
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

const startRecording = function() {
  const parsedUrl = getParsedUrl();
  const site = parsedUrl.site;
  
  if (!_twitterObserver && site === SITE_TWITTER) {
    // begin recording
    recordTwitter();
    // periodically check for collected items to save
    setFollowSaveTimer();
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.actionType) {
      case 'startRecording':
        startRecording();
        if (request.auto === true && _autoScroll === false) {
          _autoScroll = true;
          const parsedUrl = getParsedUrl();
          const avoidScrollIfHidden = (parsedUrl.site === SITE_TWITTER);
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
  _savableFollowKeySet = new Set(); // to avoid storing dupes
  _savedFollowHandleSet = new Set();

  if (_twitterObserver) {
    _twitterObserver.disconnect();
  }
  _twitterObserver = undefined;

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
  if (!_twitterObserver) {
    return;
  }
  
  if (_savableFollows.length > 0) {
    // tell background js to save to local storage cache
    chrome.runtime.sendMessage(
    {
      actionType: 'save',
      payload: _savableFollows
    }, 
    function(response) {
      if (response && response.success === true && response.saved && response.saved.length > 0) {
        const newSaveCnt = response.saved.length;
        for (let i = 0; i < response.saved.length; i++) {
          let item = response.saved[i];
          if (!_savedFollowHandleSet.has(item.handle.toLowerCase())) {
            _savedFollowHandleSet.add(item.handle.toLowerCase());
          }
        }
        
        if (_countWhenScrollDoneSet != _savableFollowKeySet.size + _savedFollowHandleSet.size) {
          // tell background js to update badge (the condition is so that we don't set to a number when 'DONE' was in place)
          
          const badgeText = '+' + newSaveCnt;
          
          chrome.runtime.sendMessage({
            actionType: 'setBadge',
            badgeText: badgeText});
        }
      }
    });
    
    // clear
    _savableFollows = [];
    _savableFollowKeySet = new Set();
  }
  
  // every 5 seconds, see if time to save
  setTimeout(() => {
    setFollowSaveTimer();
  }, 5000);
}

const getTwitterFollowImgs = function(scopeElem) {
  if (TPARSE.isTwitterProfilePhoto(scopeElem)) {
    return [scopeElem];
  }
  else {
    // all img elms with src that starts with the tell-tale prefix
    return Array.from(scopeElem.querySelectorAll(`img[src*="${_twitterProfileImgSrcHint}"]`));
  }
}

const twitterFollowMutationCallback = function(mutations) {
  for (let mutation of mutations) {
    if (mutation.type === 'childList') {
      let nodes = mutation.addedNodes;
      for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        
        // The twitter profile photo points upward to anchor with href of '/myhandle' 
        // then upward to div with data-testid of UserCell.
        // The UserCell has two anchor elements (other than the img anchor), the first for DisplayName and the next with Handle (myhandle).
        // So we can grab everything using this photo node.
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
  _twitterObserver = new MutationObserver(twitterFollowMutationCallback);
  _twitterObserver.observe(mainColumn, _mutationSettings);
  processTwitterFollows(mainColumn);
}

// see comments at Mutation callback
const buildTwitterFollowFromPhoto = function(img, parsedUrl) {
  const imgSrc = img.getAttribute('src');
  const imgAnchor = ES6.findUpTag(img, 'a', false);
  const profileUrl = imgAnchor.getAttribute('href');
  const handle = profileUrl.substring(1); // trim the starting '/'
  const atHandle = TPARSE.twitterHandleFromProfileUrl(profileUrl); 
  const userCell = TFOLLOW.findUpTwitterUserCell(img);
  // one is handle, one is description
  
  const textAnchors = Array.from(userCell.getElementsByTagName('a')).filter(function(a) { return a != imgAnchor; });
  
  const displayNameAnchor = textAnchors.find(function(a) { 
    return a.innerText && a.innerText.length > 0 && 
            a.innerText.toLowerCase() != atHandle.toLowerCase(); 
  });
  
  const displayName = getUnfurledText(displayNameAnchor);
  const description = getTwitterProfileDescription(displayNameAnchor);
  
  // TODO: switch to atHandle, and also for owner
  const per = {
    handle: handle,
    displayName: displayName,
    description: description,
    pageType: parsedUrl.pageType,
    owner: parsedUrl.owner,
    imgCdnUrl: imgSrc
  };
  
  per.accounts = STR.extractAccounts([per.displayName, per.description]);
  return per;
}

const processTwitterFollows = function(scopeElm) {
  const parsedUrl = getParsedUrl();
  const photos = getTwitterFollowImgs(scopeElm);
  const ppl = [];
  
  for (let i = 0; i < photos.length; i++) {
    let photo = photos[i];
    let per = buildTwitterFollowFromPhoto(photo, parsedUrl);
    ppl.push(per);
  }
  
  if (ppl.length > 0) {
    for (let i = 0; i < ppl.length; i++) {
      let item = ppl[i];
      let key = `${item.handle}-${item.owner}-${item.pageType}`.toLowerCase();
      if (!_savableFollowKeySet.has(key) && !_savedFollowHandleSet.has(key)) {
        // add newly found handles to what we want to save
        _savableFollows.push(item);
        _savableFollowKeySet.add(key);
        _lastDiscoveryTime = Date.now();
      }
    }
  }
}

const getTwitterProfileDescription = function(displayNameAnchorElm) {
  if (!displayNameAnchorElm) { return null; }
  const parentCell = TFOLLOW.findUpTwitterUserCell(displayNameAnchorElm);
  if (!parentCell) { return null; }
  const descripElm = TFOLLOW.findTwitterDescriptionWithinUserCell(parentCell);
  if (!descripElm) { return null; }
  let text = getUnfurledText(descripElm);
  return text;
}

const scrollAsNeeded = function(avoidScrollIfHidden) {
  
  if (_autoScroll != true || !_twitterObserver) {
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
    let count = _savableFollowKeySet.size + _savedFollowHandleSet.size;
    
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
