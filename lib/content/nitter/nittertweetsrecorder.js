// specific observers are held in _observers and also referenced by specific recorders
var _neetObserver;

var _nitterFullyLoaded = false;
window.onload = function() {
  _nitterFullyLoaded = true;
};

var NEETSREC = {
    
  // IRecorder
  pollForRecording: async function() {
    const mainColumn = NPARSE.getNitterTimelineColumn();
    let polledContextOk = undefined;  // see ES6.tryCureInvalidatedContext
    if (mainColumn) {
      polledContextOk = await RECORDING.pollContext();
      if (polledContextOk == true) {
        const shouldRecord = RECORDING.shouldRecord();

        if (shouldRecord == false && _recording == true) {
          // need to stop recording
          RECORDING.stopRecording('');
        }
        else if (shouldRecord == true && _recording == false) {
          // need to start recording
          NEETSREC.kickoffRecording();
        }
      }
    }

    if (polledContextOk != false) {
      
      const timerTime = _nitterFullyLoaded ? 2000 : 1000;
      
      setTimeout(() => {
        NEETSREC.pollForRecording();
      }, timerTime);
    }
  },
  
  // IRecorder
  kickoffRecording: function() {

    const mainColumn = NPARSE.getNitterTimelineColumn();
    if (!mainColumn) {
      return;
    }
    
    // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
    // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
    _recording = true;
    _autoScroll = _recordingContext.state == SETTINGS.RECORDING.STATE.AUTO_SCROLL;
    _neetObserver = new MutationObserver(NEETSREC.tweetMutationCallback);
    _observers.push(_neetObserver);
    const observerSettings = { attributes: false, childList: true, subtree: true };
    // process nodes that are already there
    NEETSREC.processForNodeScope(mainColumn);
    // record more nodes that get added
    _neetObserver.observe(mainColumn, observerSettings);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    const avoidScrollIfHidden = NEETSREC.shouldAvoidScrollIfHidden(SITE.NITTER);
    RECORDING.scrollAsNeeded(avoidScrollIfHidden);
  },
  
  // IRecorder
  shouldAvoidScrollIfHidden: function() {
    return false;
  },
  
  // IRecorder
  isThrottled: function() {
    return false;
  },

  tryUnthrottle: function() {
    // no-op
  },

  processTweets: function(scopeElm) {
    const tweetElms = NPARSE.getTweetElms(scopeElm);
    if (!tweetElms || tweetElms.length == 0) { return; }

    const tweets = [];
    for (let i = 0; i < tweetElms.length; i++) {
      let tweetElm = tweetElms[i];
      let tweet = NEETPARSE.buildTweetFromElm(tweetElm);
      if (tweet) {
        console.log(tweet);
        tweets.push(tweet);
      }
    }
    //console.log(tweets);
  },

  processForNodeScope: function(node) {
    if (!ES6.isElementNode(node)) { return; }
    NEETSREC.processTweets(node);
  },

  tweetMutationCallback: function(mutations) {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          NEETSREC.processForNodeScope(node);
        }
      }
    }
  }
  
};