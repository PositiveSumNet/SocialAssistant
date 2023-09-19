// specific observers are held in _observers and also referenced by specific recorders
var _neetObserver;

var _nitterFullyLoaded = false;
window.onload = function() {
  _nitterFullyLoaded = true;
};

var NEETSREC = {
  
  // IRecorder
  pollForRecording: async function() {
    const mainColumn = NPARSE.getMainColumn();
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

    const mainColumn = NPARSE.getMainColumn();
    
    if (!mainColumn) {
      return;
    }

    // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
    // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
    _recording = true;
    _autoScroll = RECORDING.calcShouldAutoScroll();
    _neetObserver = new MutationObserver(NEETSREC.tweetMutationCallback);
    _observers.push(_neetObserver);
    const observerSettings = { attributes: false, childList: true, subtree: true };
    // process nodes that are already there
    const parsedUrl = RECORDING.getParsedUrl();
    NEETSREC.processForNodeScope(mainColumn, parsedUrl);
    // record more nodes that get added
    // use of 'body' is because main column can change during non-reload page update
    // (happens for twitter, not so much for nitter, but choosing to be consistent in approach)
    _neetObserver.observe(document.body, observerSettings);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    const avoidScrollIfHidden = NEETSREC.shouldAvoidScrollIfHidden(SITE.NITTER);
    RECORDING.scrollAsNeeded(avoidScrollIfHidden);
  },
  
  getMaxEmptyScrolls: function() {
    return 10;
  },

  ensureLastItemInView: function() {
    // no-op for now
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
        RECORDING.storeThreadExpansionUrlKeyAsNeeded(tweet);
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
    }
  },

  // IRecorder
  finalizeParsedUrl: function(parsedUrl) {
    // no-op
  },

  processForNodeScope: function(node, parsedUrl) {
    if (!ES6.isElementNode(node)) { return; }
    NEETSREC.processTweets(node, parsedUrl);
  },

  tweetMutationCallback: function(mutations) {
    const parsedUrl = URLPARSE.parseUrl(document.location.href);
    if (parsedUrl) {
      const mainColumn = TPARSE.getMainColumn();
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          let nodes = mutation.addedNodes;
          for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            if (ES6.isElmaWithinElmB(node, mainColumn) == true) {
              NEETSREC.processForNodeScope(node, parsedUrl);
            }
          }
        }
      }
    }
  },

  onSaved: function(records) {
    RECORDING.onSavedPosts(records);
  }  
};