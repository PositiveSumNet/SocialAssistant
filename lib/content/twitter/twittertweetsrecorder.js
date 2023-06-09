// see IRecorder defined at recorderfactory
// see state variables at recordinglib

// specific observers are held in _observers and also referenced by specific recorders
var _tweetObserver;

var TWEETSREC = {
  
  // IRecorder
  pollForRecording: async function() {
    const mainColumn = TPARSE.getTwitterMainColumn();
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

    const mainColumn = TPARSE.getTwitterMainColumn();
    if (!mainColumn) {
      return;
    }
    
    // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
    // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
    _recording = true;
    _autoScroll = _recordingContext.state == SETTINGS.RECORDING.STATE.AUTO_SCROLL;
    _tweetObserver = new MutationObserver(TWEETSREC.tweetMutationCallback);
    _observers.push(_tweetObserver);
    const observerSettings = { attributes: false, childList: true, subtree: true };
    // process nodes that are already there
    TWEETSREC.processForNodeScope(mainColumn);
    // record more nodes that get added
    _tweetObserver.observe(mainColumn, observerSettings);
    
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    const avoidScrollIfHidden = TWEETSREC.shouldAvoidScrollIfHidden(SITE.TWITTER);
    RECORDING.scrollAsNeeded(avoidScrollIfHidden);
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

  // see TWEET_CARD_ATTR
  processTweetCards: function(imgElms) {
    const cards = [];
    for (let i = 0; i < imgElms.length; i++) {
      let imgElm = imgElms[i];
      let card = TWEETPARSE.buildTweetCard(imgElm);
      cards.push(card);
    }

    //console.log(cards);
    // todo: saving
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

    // console.log(infos);
    // todo: saving
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

    // saving...
    console.log(infos);
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

    // TODO... saving
    //console.log(handleUrlPairs);
  },

  // see SAVABLE_TWEET_ATTR
  processTweets: function(tweetElms) {
    const tweets = [];
    for (let i = 0; i < tweetElms.length; i++) {
      let tweetElm = tweetElms[i];
      let tweet = TWEETPARSE.buildTweetFromElm(tweetElm);
      if (tweet) {
        tweets.push(tweet);
      }
    }

    if (tweets.length > 0) {
      for (let i = 0; i < tweets.length; i++) {
        let item = tweets[i];
        let key = `twitterTweet:${item.urlKey}`.toLowerCase();
        item.key = key;
        if (!_savableKeySet.has(key) && !_savedKeySet.has(key)) {
          // add newly found handles to what we want to save
          _savables.push(item);
          _savableKeySet.add(key);
          _lastDiscoveryTime = Date.now();
        }
      }
    }

  },
  
  processForNodeScope: function(node) {
    if (!ES6.isElementNode(node)) { return; }

    // tweets
    let tweetElms = TPARSE.getTweetElms(node);
    if (tweetElms && tweetElms.length > 0) {
      TWEETSREC.processTweets(tweetElms);
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
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          TWEETSREC.processForNodeScope(node);
        }
      }
    }
  }
  
};