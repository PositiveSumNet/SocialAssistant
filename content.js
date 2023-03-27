// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

// also see lib/recording.js (including for public variables)

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
    RECORDING.setSaveTimer();
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
        RECORDING.scrollAsNeeded(avoidScrollIfHidden);
      }
      
      break;
    case MSGTYPE.RECORDING.STOP:
      RECORDING.stopRecording('');
      break;
    default:
      break;
  }
  
  sendResponse({auto: request.auto, success: true});
});

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
    let per = TFOLLOWPARSE.buildTwitterFollowFromPhoto(photo, parsedUrl);
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
