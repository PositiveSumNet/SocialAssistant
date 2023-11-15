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
    const tweetElms = NEETPARSE.getTweetElms(scopeElm);
    if (!tweetElms || tweetElms.length == 0) { return; }
    let tweets = [];
    for (let i = 0; i < tweetElms.length; i++) {
      let tweetElm = tweetElms[i];
      let tweet = NEETPARSE.buildTweetFromElm(tweetElm, parsedUrl);
      if (tweet) {
        tweets.push(tweet);
      }
    }

    tweets = NEETSREC.REPLY_GUY_FILTER.filter(tweets);

    if (tweets.length > 0) {
      for (let i = 0; i < tweets.length; i++) {
        let item = tweets[i];
        let key = `nitterTweet:${item.urlKey}`.toLowerCase();
        if (RECORDING.pushSavable(item, key) == true) {
          // mark for follow-on processing
          RECORDING.storeThreadExpansionUrlKeyAsNeeded(item);
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

  // ensures that mutation callback wasn't triggered after an ajax call changed the de-facto page type
  // caller should ensure that it's finalized
  isCompatibleUrl: function(parsedUrl) {
    if (!parsedUrl) { return false; }
    // see RECORDERFACTORY.getRecorder
    switch(parsedUrl.pageType) {
      case PAGETYPE.TWITTER.HOME:
      case PAGETYPE.TWITTER.SEARCH:
      case PAGETYPE.TWITTER.TWEETS:
        return true;
      default:
        return false;
    }
  },

  // in case page type changes during processing, we don't want the page to stay "stuck" until next refresh
  tweetMutationCallback: function(mutations) {
    try {
      NEETSREC.mutationCallbackWorker(mutations);
    }
    catch (ex) {
      console.log('Nitter recorder error');
      console.log(ex);
      console.trace();
    }
  },

  mutationCallbackWorker: function(mutations) {
    const parsedUrl = URLPARSE.parseUrl(document.location.href);
    if (NEETSREC.isCompatibleUrl(parsedUrl)) {
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
  },

  REPLY_GUY_FILTER: {
    // note that twitter operates on dom elements, whereas this filters tweets
    filter: function(tweets) {
      if (tweets.length == 0) { return tweets; }
      const shouldFilter = RECORDING.calcShouldMinRecordedReplies();
      if (!shouldFilter) { return tweets; }
      const keepers = [];
      // top-most tweet is used as basis for comparison (on author) with subsequent tweets
      const topTweet = tweets[0];
      const topElmAuthor = STR.getAuthorFromUrlKey(topTweet.urlKey);

      for (let i = 0; i < tweets.length; i++) {
        let tweet = tweets[i];
        let author = STR.getAuthorFromUrlKey(tweet.urlKey);
        if (STR.sameText(author, topElmAuthor)) {
          keepers.push(tweet);
        }
      }

      return keepers;
    }
  }
};