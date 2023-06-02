// see IRecorder defined at recorderfactory

var TFOLLOWREC = {
  
  // IRecorder
  tryStartRecording: function() {
    const warnIfNotYetReady = false;
    let col = TPARSE.getTwitterMainColumn(warnIfNotYetReady);
    
    if (col) {
      TFOLLOWREC.startRecording();
    }
    else {
      // try again in a couple seconds to see if page is loaded
      setTimeout(() => {
        TFOLLOWREC.tryStartRecording();
      }, 2500);
    }
  },
  
  // IRecorder
  shouldAvoidScrollIfHidden: function() {
    return true;
  },
  
  // IRecorder
  startRecording: function() {

    const mainColumn = TPARSE.getTwitterMainColumn();
    if (!mainColumn) {
      return;
    }
    
    // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
    // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
    _observer = new MutationObserver(TFOLLOWREC.twitterFollowMutationCallback);
    _observerSettings = { attributes: false, childList: true, subtree: true };
    _observer.observe(mainColumn, _observerSettings);
    TFOLLOWREC.processTwitterFollows(mainColumn);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
  },
  
  // IRecorder
  isThrottled: function() {
    return TPARSE.isThrottled();
  },

  tryUnthrottle: function() {
    const retryBtn = TPARSE.getThrottledRetryElem();
    if (retryBtn) {
      retryBtn.click();
    }
  },

  processTwitterFollows: function(scopeElm) {
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
  },
  
  twitterFollowMutationCallback: function(mutations) {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          
          if (TPARSE.isTwitterProfilePhoto(node)) {
            TFOLLOWREC.processTwitterFollows(node);
          }
        }
      }
    }
  }
  
};