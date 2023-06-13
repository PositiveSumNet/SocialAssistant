// specific observers are held in _observers and also referenced by specific recorders
var _neetObserver;

var _nitterFullyLoaded = false;
window.onload = function() {
  _nitterFullyLoaded = true;
};

var NEETSREC = {
    
  // IRecorder
  pollForRecording: async function() {
    const mainColumn = NPARSE.getNitterMainColumn();
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

    const mainColumn = NPARSE.getNitterMainColumn();
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
    const parsedUrl = URLPARSE.getParsedUrl();
    NEETSREC.processForNodeScope(mainColumn, parsedUrl);
    // record more nodes that get added
    _neetObserver.observe(mainColumn, observerSettings);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    const avoidScrollIfHidden = NEETSREC.shouldAvoidScrollIfHidden(SITE.NITTER);
    RECORDING.scrollAsNeeded(avoidScrollIfHidden);
  },
  
  getNextPageNavAnchor: function(parsedUrl) {
    
    if (parsedUrl.threadDetailId) {
      // on a thread detail page
      // we only want to click 'next page' with regard to the "main" conversation.
      // (we're not trying to iterate through all comment pages)
      return Array.from(document.querySelectorAll('.conversation .main-thread .more-replies a.more-replies-text')).find(function(a) {
        // as opposed to the 'earlier replies' button at the top
        return a.innerText == 'more replies';
      });
    }
    else {
      // on the main timeline stream
      return Array.from(document.querySelectorAll('.timeline .show-more a')).find(function(a) {
        // as opposed to the 'Load newest' button at the top
        return a.innerText == 'Load more';
      });
    }
  },

  // IRecorder
  tryNavToNextPage: function(parsedUrl) {
    const navAnchor = NEETSREC.getNextPageNavAnchor(parsedUrl);
    if (!navAnchor) { return false; }
    navAnchor.click();
    return true;
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

  processTweets: function(scopeElm, parsedUrl) {
    const tweetElms = NPARSE.getTweetElms(scopeElm);
    if (!tweetElms || tweetElms.length == 0) { return; }
    const skipImg64 = _recordingContext.recordsTweetImages == false;
    const tweets = [];
    for (let i = 0; i < tweetElms.length; i++) {
      let tweetElm = tweetElms[i];
      let tweet = NEETPARSE.buildTweetFromElm(tweetElm, parsedUrl);
      if (tweet) {
        if (skipImg64 == true) {
          tweet.skipImg64 = true;
        }
        tweets.push(tweet);
        console.log(tweet);
      }
    }

    if (tweets.length > 0) {
      for (let i = 0; i < tweets.length; i++) {
        let item = tweets[i];
        let key = `nitterTweet:${item.urlKey}`.toLowerCase();
        item.key = key;
        if (!_savableKeySet.has(key) && !_savedKeySet.has(key)) {
          _savables.push(item);
          _savableKeySet.add(key);
          _lastDiscoveryTime = Date.now();
        }
      }

      // trigger background processing of rest of threads, as needed
      BGFETCH_REQUEST.TWITTER.TWEETS.cacheTweetUrlKeysForHasMoreBgScrape(tweets);
      BGFETCH_REQUEST.kickoffBackgroundScraping();
    }
  },

  processForNodeScope: function(node, parsedUrl) {
    if (!ES6.isElementNode(node)) { return; }
    NEETSREC.processTweets(node, parsedUrl);
  },

  tweetMutationCallback: function(mutations) {
    const parsedUrl = URLPARSE.getParsedUrl();
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          NEETSREC.processForNodeScope(node, parsedUrl);
        }
      }
    }
  }
  
};