// see IRecorder defined at recorderfactory
// see state variables at recordinglib

// specific observers are held in _observers and also referenced by specific recorders
var _tweetObserver;

var TWEETSREC = {
  
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
  },

  tryUnthrottle: function() {
    const retryBtn = TPARSE.getThrottledRetryElem();
    if (retryBtn) {
      retryBtn.click();
    }
  },

  // see TWEET_CARD_ATTR
  processTweetCards: function(imgElms) {
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

    if (cards.length > 0) {
      for (let i = 0; i < cards.length; i++) {
        let item = cards[i];
        let key = `card:${item.urlKey}`.toLowerCase();
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
    const tweets = [];
    for (let i = 0; i < tweetElms.length; i++) {
      let tweetElm = tweetElms[i];

      let tweet = TWEETPARSE.buildTweetFromElm(tweetElm, parsedUrl);
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
  
  processForNodeScope: function(node, parsedUrl) {
    if (!ES6.isElementNode(node)) { return; }

    // tweets
    let tweetElms = TPARSE.getTweetElms(node);
    if (tweetElms && tweetElms.length > 0) {
      TWEETSREC.processTweets(tweetElms, parsedUrl);
    }

    // author img urls
    let authorImgElms = TPARSE.getTweetAuthorImgElms(node);
    if (authorImgElms && authorImgElms.length > 0) {
      TWEETSREC.processAuthorImages(authorImgElms);
    }

    // tweet post img urls
    let tweetPostImgElms = TPARSE.getTweetPostImgElms(node);
    if (tweetPostImgElms && tweetPostImgElms.length > 0) {
      TWEETSREC.processTweetPostImages(tweetPostImgElms);
    }
    
    // tweet post video urls
    let tweetPostEmbeddedVideoElms = TPARSE.getTweetPostEmbeddedVideoElms(node);
    if (tweetPostEmbeddedVideoElms && tweetPostEmbeddedVideoElms.length > 0) {
      TWEETSREC.processTweetPostEmbeddedVideos(tweetPostEmbeddedVideoElms);
    }
    
    // tweet article cards with image
    let tweetCardImgElms = TPARSE.getTweetCardImgElms(node);
    if (tweetCardImgElms && tweetCardImgElms.length > 0) {
      TWEETSREC.processTweetCards(tweetCardImgElms);
    }

    // tweet article cards sans image
    let tweetCardSvgElms = TPARSE.getTweetCardSvgElms(node);
    if (tweetCardSvgElms && tweetCardSvgElms.length > 0) {
      TWEETSREC.processTweetCards(tweetCardSvgElms);
    }
  },

  tweetMutationCallback: function(mutations) {
    const parsedUrl = RECORDING.getParsedUrl();
    // if e.g. the page context changed to 'notifications' (and had been recording), we will end up with an undefined parsedUrl and should exit
    if (parsedUrl) {
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
  }
};