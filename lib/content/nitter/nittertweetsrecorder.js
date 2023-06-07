// see IRecorder defined at recorderfactory
// see state variables at recordinglib
var NEETREC = {
  
  // IRecorder
  pollForRecording: async function() {
    console.log('poll nitter');
    // const mainColumn = TPARSE.getTwitterMainColumn();
    // let polledContextOk = undefined;  // see ES6.tryCureInvalidatedContext
    // if (mainColumn) {
      // polledContextOk = await RECORDING.pollContext();
      // if (polledContextOk == true) {
        // const shouldRecord = RECORDING.shouldRecord();

        // if (shouldRecord == false && _recording == true) {
          // // need to stop recording
          // RECORDING.stopRecording('');
        // }
        // else if (shouldRecord == true && _recording == false) {
          // // need to start recording
          // TWEETSREC.kickoffRecording();
        // }
      // }
    // }

    // if (polledContextOk != false) {
      // setTimeout(() => {
        // TWEETSREC.pollForRecording();
      // }, 2000);
    // }
  },
  
  // IRecorder
  kickoffRecording: function() {

    // const mainColumn = TPARSE.getTwitterMainColumn();
    // if (!mainColumn) {
      // return;
    // }
    
    // // stackoverflow.com/questions/57468727/when-to-disconnect-mutationobserver-in-chrome-web-extension
    // // www.smashingmagazine.com/2019/04/mutationobserver-api-guide/
    // _recording = true;
    // _autoScroll = _recordingContext.state == SETTINGS.RECORDING.STATE.AUTO_SCROLL;
    // _observer = new MutationObserver(TWEETSREC.tweetMutationCallback);
    // _observerSettings = { attributes: false, childList: true, subtree: true };
    // _observer.observe(mainColumn, _observerSettings);
    // TWEETSREC.processTweets(mainColumn);
    
    // // periodically check for collected items to save
    // RECORDING.setSaveTimer();
    // // periodically scroll (if autoScroll is on)
    // const avoidScrollIfHidden = TWEETSREC.shouldAvoidScrollIfHidden(SITE.TWITTER);
    // RECORDING.scrollAsNeeded(avoidScrollIfHidden);
  },
  
  // IRecorder
  shouldAvoidScrollIfHidden: function() {
//    return true;
  },
  
  // IRecorder
  isThrottled: function() {
  //  return TPARSE.isThrottled();
  },

  tryUnthrottle: function() {
    // const retryBtn = TPARSE.getThrottledRetryElem();
    // if (retryBtn) {
      // retryBtn.click();
    // }
  },

  processTweets: function(scopeElm) {
    // const parsedUrl = URLPARSE.getParsedUrl();
    // //const photos = TPARSE.getTwitterProfilePhotos(scopeElm);
    // // const ppl = [];
    
    // // for (let i = 0; i < photos.length; i++) {
    // //   let photo = photos[i];
    // //   let per = TFOLLOWPARSE.buildTwitterFollowFromPhoto(photo, parsedUrl);
    // //   ppl.push(per);
    // // }
    
    // // if (ppl.length > 0) {
    // //   for (let i = 0; i < ppl.length; i++) {
    // //     let item = ppl[i];
    // //     let key = `${item.handle}-${item.owner}-${item.pageType}`.toLowerCase();
    // //     if (!_savableKeySet.has(key) && !_savedKeySet.has(key)) {
    // //       // add newly found handles to what we want to save
    // //       _savables.push(item);
    // //       _savableKeySet.add(key);
    // //       _lastDiscoveryTime = Date.now();
    // //     }
    // //   }
    // // }
  },
  
  tweetMutationCallback: function(mutations) {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          
          // if (TPARSE.isTwitterProfilePhoto(node)) {
          //   TWEETSREC.processTweets(node);
          // }
        }
      }
    }
  }
  
};