// see IRecorder defined at recorderfactory
// see state variables at recordinglib

// specific observers are held in _observers and also referenced by specific recorders
var _followObserver;

var TFOLLOWREC = {
  
  // IRecorder
  pollForRecording: async function() {
    const mainColumn = TPARSE.getMainColumn();
    let polledContextOk = undefined;  // see ES6.tryCureInvalidatedContext
    if (mainColumn) {
      polledContextOk = await RECORDING.pollContext();
      if (polledContextOk == true) {
        const shouldRecord = await RECORDING.shouldRecord();

        if (shouldRecord == false && _recording == true) {
          // need to stop recording
          RECORDING.stopRecording('');
        }
        else if (shouldRecord == true && _recording == false) {
          // need to start recording
          TFOLLOWREC.kickoffRecording();
        }
      }
    }

    if (polledContextOk != false) {
      setTimeout(() => {
        TFOLLOWREC.pollForRecording();
      }, 2000);
    }
  },
  
  // IRecorder
  kickoffRecording: function() {

    const mainColumn = TPARSE.getMainColumn();
    if (!mainColumn) {
      return;
    }
    
    // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
    // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
    _recording = true;
    _autoScroll = RECORDING.calcShouldAutoScroll();
    _followObserver = new MutationObserver(TFOLLOWREC.twitterFollowMutationCallback);
    _observers.push(_followObserver);
    const observerSettings = { attributes: false, childList: true, subtree: true };
    _followObserver.observe(document.body, observerSettings);
    TFOLLOWREC.processTwitterFollows(mainColumn);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    const avoidScrollIfHidden = TFOLLOWREC.shouldAvoidScrollIfHidden(SITE.TWITTER);
    RECORDING.scrollAsNeeded(avoidScrollIfHidden);
  },
  
  // IRecorder
  // n/a (this is infinite scroll)
  getNextPageNavAnchor: function(parsedUrl) {
    return null;
  },

  // IRecorder
  shouldAvoidScrollIfHidden: function() {
    return true;
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

  getMaxEmptyScrolls: function() {
    return 4;
  },

  ensureLastItemInView: function() {
    // no-op for now
  },

  processTwitterFollows: function(scopeElm) {
    const parsedUrl = RECORDING.getParsedUrl();
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
        item.key = key;
        if (!_savableKeySet.has(key) && !_savedKeySet.has(key)) {
          _savables.push(item);
          _savableKeySet.add(key);
          _lastDiscoveryTime = Date.now();
        }
      }
    }
  },
  
  // IRecorder
  finalizeParsedUrl: function(parsedUrl) {
    // no-op
  },

  // ensures that mutation callback wasn't triggered after an ajax call changed the de-facto page type
  // caller should ensure that it's finalized
  isCompatibleUrl: function(parsedUrl) {
    if (!parsedUrl) { return false; }
    // see RECORDERFACTORY.getRecorder
    switch(parsedUrl.pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return true;
      default:
        return false;
    }
  },

  twitterFollowMutationCallback: function(mutations) {
    try {
      TFOLLOWREC.mutationCallbackWorker(mutations);
    }
    catch (ex) {
      console.log('Twitter follow recorder error');
      console.log(ex);
      console.trace();
    }
  },


  mutationCallbackWorker: function(mutations) {
    const parsedUrl = RECORDING.getParsedUrl();
    // if e.g. the page context changed to 'notifications' (and had been recording), we will end up with an undefined parsedUrl and should exit
    if (TFOLLOWREC.isCompatibleUrl(parsedUrl)) {
      const mainColumn = TPARSE.getMainColumn();
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          let nodes = mutation.addedNodes;
          for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];

            if (ES6.isElmaWithinElmB(node, mainColumn) == true) {
              if (TPARSE.isTwitterProfilePhoto(node)) {
                TFOLLOWREC.processTwitterFollows(node);
              }
            }
          }
        }
      }
    }
  },

  onSaved: function(records) {
    // no-op
  }
  
};