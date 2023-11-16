// see IRecorder defined at recorderfactory
// see state variables at recordinglib

// specific observers are held in _observers and also referenced by specific recorders
var _tweetObserver;

// as a detail page loads, we learn the threadId
var _threadDetailInfo = {
  threadDetailId: '',
  threadUrlKey: '',
  authorHandle: ''
};

var TWEETSREC = {
  
  clearThreadDetailCache: function() {
    _threadDetailInfo = {
      threadDetailId: '',
      threadUrlKey: '',
      authorHandle: ''
    };
  },

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
          TWEETSREC.kickoffRecording();
        }
      }
    }

    if (polledContextOk != false) {
      setTimeout(() => {
        TWEETSREC.pollForRecording();
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
    _tweetObserver = new MutationObserver(TWEETSREC.tweetMutationCallback);
    _observers.push(_tweetObserver);
    const observerSettings = { attributes: false, childList: true, subtree: true };
    // process nodes that are already there
    const parsedUrl = RECORDING.getParsedUrl();
    TWEETSREC.processForNodeScope(mainColumn, parsedUrl);
    // record more nodes that get added
    // use of 'body' is because main column can change during non-reload page update
    _tweetObserver.observe(document.body, observerSettings);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    const avoidScrollIfHidden = TWEETSREC.shouldAvoidScrollIfHidden(SITE.TWITTER);
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

  getMaxEmptyScrolls: function() {
    return 10;
  },

  ensureLastItemInView: function() {
    const items = Array.from(document.querySelectorAll('article'));
    if (items.length == 0) { return; }
    const lastElm = items[items.length - 1];
    lastElm.scrollIntoView(true);
  },

  // IRecorder
  finalizeParsedUrl: function(parsedUrl) {
    if (parsedUrl.pageType == PAGETYPE.TWITTER.HOME) {
      parsedUrl.originalPageType = parsedUrl.pageType;
      parsedUrl.pageType = PAGETYPE.TWITTER.TWEETS;
      parsedUrl.owner = TPARSE.getHomePageOwnerHandle();
    }
    else if (parsedUrl.pageType == PAGETYPE.TWITTER.SEARCH) {
      parsedUrl.originalPageType = parsedUrl.pageType;
      parsedUrl.pageType = PAGETYPE.TWITTER.TWEETS;
      parsedUrl.owner = URLPARSE.getTwitterSearchPageHandle() || TPARSE.getHomePageOwnerHandle();
    }
  },

  tryUnthrottle: function() {
    const retryBtn = TPARSE.getThrottledRetryElem();
    if (retryBtn) {
      retryBtn.click();
    }
  },

  // see TWEET_CARD_ATTR
  processTweetCards: function(imgElms, hasGoodImage) {
    const cards = [];
    for (let i = 0; i < imgElms.length; i++) {
      let imgElm = imgElms[i];
      let card = TWEETPARSE.buildTweetCard(imgElm);
      if (card) {
        cards.push(card);
      }
      else {
        console.log('skipping card for:');
        console.log(imgElm.outerHTML.substring(0, 300));
      }
    }

    const prefix = (hasGoodImage) ? 'card:' : 'card-img:';
    if (cards.length > 0) {
      for (let i = 0; i < cards.length; i++) {
        let item = cards[i];
        let key = `${prefix}${item.urlKey}`.toLowerCase();
        RECORDING.pushSavable(item, key);
      }
    }
  },

  processTweetPostImages: function(imgElms) {
    const infos = [];
    for (let i = 0; i < imgElms.length; i++) {
      let imgElm = imgElms[i];
      let imgInfo = TWEETPARSE.buildTweetPostImgInfo(imgElm);
      if (imgInfo) {
        infos.push(imgInfo);
      }
    }

    if (infos.length > 0) {
      for (let i = 0; i < infos.length; i++) {
        let item = infos[i];
        let key = `staticImg:${item.urlKey}-${item.imgCdnUrl}`.toLowerCase();
        RECORDING.pushSavable(item, key);
      }
    }
  },

  processTweetPostEmbeddedVideos: function(videoElms) {
    const infos = [];
    for (let i = 0; i < videoElms.length; i++) {
      let videoElm = videoElms[i];
      let videoInfo = TWEETPARSE.buildTweetPostEmbeddedVideoInfo(videoElm);
      if (videoInfo) {
        infos.push(videoInfo);
      }
    }

    if (infos.length > 0) {
      for (let i = 0; i < infos.length; i++) {
        let item = infos[i];
        let key = `embVideo:${item.urlKey}-${item.imgCdnUrl}`.toLowerCase();
        if (RECORDING.pushSavable(item, key) == true) {
          RECORDING.storeExtractableVideoUrlKeyAsNeeded(item);
        }
      }
    }
  },

  processAuthorImages: function(imgElms) {
    const handleUrlPairs = [];
    for (let i = 0; i < imgElms.length; i++) {
      let imgElm = imgElms[i];
      let pair = TWEETPARSE.buildAuthorCdnUrlPair(imgElm);
      if (pair) {
        handleUrlPairs.push(pair);
      }
    }

    if (handleUrlPairs.length > 0) {
      for (let i = 0; i < handleUrlPairs.length; i++) {
        let item = handleUrlPairs[i];
        let key = `authorPhoto:${item.handle}-${item.imgCdnUrl}`.toLowerCase();
        RECORDING.pushSavable(item, key);
      }
    }
  },

  // see SAVABLE_TWEET_ATTR
  processTweets: function(tweetElms, parsedUrl) {
    const threadUrlKey = (STR.hasLen(parsedUrl.threadDetailId) && parsedUrl.threadDetailId == _threadDetailInfo.threadDetailId)
      ? _threadDetailInfo.threadUrlKey
      : null;
    
    const tweets = [];
    for (let i = 0; i < tweetElms.length; i++) {
      let tweetElm = tweetElms[i];

      let tweet = TWEETPARSE.buildTweetFromElm(tweetElm, parsedUrl, threadUrlKey);
      if (tweet) {
        tweets.push(tweet);
      }
    }

    if (tweets.length > 0) {
      for (let i = 0; i < tweets.length; i++) {
        let item = tweets[i];
        let key = `twitterTweet:${item.urlKey}`.toLowerCase();
        if (RECORDING.pushSavable(item, key) == true) {
          // mark for follow-on processing
          RECORDING.storeThreadExpansionUrlKeyAsNeeded(item);
          RECORDING.storeExtractableVideoUrlKeyAsNeeded(item);
        }
      }
    }
  },

  cacheThreadDetailUrlKey: function(parsedUrl) {
    if (!STR.hasLen(parsedUrl.threadDetailId)) {
      // we're not on a thread detail page
      TWEETSREC.clearThreadDetailCache();
      return;
    }

    if (parsedUrl.threadDetailId != _threadDetailInfo.threadDetailId) {
      TWEETSREC.clearThreadDetailCache();
    }

    if (_threadDetailInfo.threadDetailId == parsedUrl.threadDetailId && STR.hasLen(_threadDetailInfo.threadUrlKey)) {
      // already set (and setting it again risks a bad reset if X removes dom elements)
      return;
    }

    const threadUrlKey = TWEETPARSE.getFirstPostUrlKey();
    if (!STR.hasLen(threadUrlKey)) { return; }

    _threadDetailInfo.threadDetailId = parsedUrl.threadDetailId;
    _threadDetailInfo.threadUrlKey = threadUrlKey;
    _threadDetailInfo.authorHandle = STR.getAuthorFromUrlKey(threadUrlKey);
  },
  
  processForNodeScope: function(node, parsedUrl) {
    if (!ES6.isElementNode(node)) { return; }
    const shouldFilter = RECORDING.calcShouldMinRecordedReplies();
    TWEETSREC.cacheThreadDetailUrlKey(parsedUrl);
    // we only need firstAuthor when we're filtering to avoid reply-guys
    const firstAuthor = (shouldFilter) ? _threadDetailInfo.authorHandle : null;
    // tweets
    let tweetElms = TWEETPARSE.getTweetElms(node);
    if (shouldFilter) { tweetElms = TWEETSREC.REPLY_GUY_FILTER.filter(tweetElms, firstAuthor); }
    if (tweetElms && tweetElms.length > 0) {
      TWEETSREC.processTweets(tweetElms, parsedUrl);
    }

    // author img urls
    let authorImgElms = TPARSE.getTweetAuthorImgElms(node);
    if (shouldFilter) { authorImgElms = TWEETSREC.REPLY_GUY_FILTER.filter(authorImgElms, firstAuthor); }
    if (authorImgElms && authorImgElms.length > 0) {
      TWEETSREC.processAuthorImages(authorImgElms);
    }

    // tweet post img urls
    let tweetPostImgElms = TPARSE.getTweetPostImgElms(node);
    if (shouldFilter) { tweetPostImgElms = TWEETSREC.REPLY_GUY_FILTER.filter(tweetPostImgElms, firstAuthor); }
    if (tweetPostImgElms && tweetPostImgElms.length > 0) {
      TWEETSREC.processTweetPostImages(tweetPostImgElms);
    }
    
    // tweet post video urls
    let tweetPostEmbeddedVideoElms = TPARSE.getTweetPostEmbeddedVideoElms(node);
    if (shouldFilter) { tweetPostEmbeddedVideoElms = TWEETSREC.REPLY_GUY_FILTER.filter(tweetPostEmbeddedVideoElms, firstAuthor); }
    if (tweetPostEmbeddedVideoElms && tweetPostEmbeddedVideoElms.length > 0) {
      TWEETSREC.processTweetPostEmbeddedVideos(tweetPostEmbeddedVideoElms);
    }
    
    // tweet article cards with image
    let tweetCardImgElms = TPARSE.getTweetCardImgElms(node);
    if (shouldFilter) { tweetCardImgElms = TWEETSREC.REPLY_GUY_FILTER.filter(tweetCardImgElms, firstAuthor); }
    if (tweetCardImgElms && tweetCardImgElms.length > 0) {
      TWEETSREC.processTweetCards(tweetCardImgElms, true);
    }

    // tweet article cards sans image
    let tweetCardSvgElms = TPARSE.getTweetCardSvgElms(node);
    if (shouldFilter) { tweetCardSvgElms = TWEETSREC.REPLY_GUY_FILTER.filter(tweetCardSvgElms, firstAuthor); }
    if (tweetCardSvgElms && tweetCardSvgElms.length > 0) {
      TWEETSREC.processTweetCards(tweetCardSvgElms, false);
    }
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

  tweetMutationCallback: function(mutations) {
    try {
      TWEETSREC.mutationCallbackWorker(mutations);
    }
    catch (ex) {
      console.log('Tweets recorder error');
      console.log(ex);
      console.trace();
    }
  },

  mutationCallbackWorker: function(mutations) {
    const parsedUrl = RECORDING.getParsedUrl();
    // if e.g. the page context changed to 'notifications' (and had been recording), we will end up with an undefined parsedUrl and should exit
    if (TWEETSREC.isCompatibleUrl(parsedUrl)) {
      const mainColumn = TPARSE.getMainColumn();
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          let nodes = mutation.addedNodes;
          for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            if (ES6.isElmaWithinElmB(node, mainColumn) == true) {
              TWEETSREC.processForNodeScope(node, parsedUrl);
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
    filter: function(elms, firstAuthor) {
      if (!STR.hasLen(firstAuthor)) { return elms; }
      if (elms.length == 0) { return elms; }
      const shouldFilter = RECORDING.calcShouldMinRecordedReplies();
      if (!shouldFilter) { return elms; }
      const keepers = [];
      
      for (let i = 0; i < elms.length; i++) {
        let elm = elms[i];
        let shouldKeep = TWEETSREC.REPLY_GUY_FILTER.shouldKeep(elm, firstAuthor);
        if (shouldKeep) {
          keepers.push(elm);
        }
      }

      return keepers;
    },

    shouldKeep: function(elm, firstAuthor) {
      let tweetElm;
      if (TPARSE.isTweetElm(elm)) {
        tweetElm = elm;
      }
      else {
        const elmInfo = TWEETPARSE.getParentTweetElmInfo(elm);
        if (!elmInfo) {
          // caller will filter it out (but we don't need to filter it out on the basis of being a reply-guy)
          return true;
        }
        else if (elmInfo.quoted == true) {
          // keep all quote tweets
          return true;
        }
        else {
          tweetElm = elmInfo.elm;
        }
      }

      const elmUrlKey = TWEETPARSE.getTweetUrlKeyDirectly(tweetElm);
      const elmAuthor = STR.getAuthorFromUrlKey(elmUrlKey);
      return STR.sameText(elmAuthor, firstAuthor);
    }
  }
};