// see IRecorder defined at recorderfactory
// see state variables at recordinglib

var _nitterFullyLoaded = false;

window.onload = function() {
  _nitterFullyLoaded = true;
};

var NEETSREC = {
  
  // IRecorder
  pollForRecording: async function() {
    let polledContextOk = undefined;  // see ES6.tryCureInvalidatedContext
    if (_nitterFullyLoaded == true) {
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

    if (polledContextOk != false && _nitterFullyLoaded == false) {
      setTimeout(() => {
        NEETSREC.pollForRecording();
      }, 1000);
    }
  },
  
  // IRecorder
  kickoffRecording: function() {
    const mainColumn = NPARSE.getNitterTimelineColumn();
    if (!mainColumn) {
      return;
    }

    // there's no javascript on nitter, so we don't need to use the mutuation observer approach.
    // and 'scroll' is instead 'navigate to next'
    _recording = true;
    _autoScroll = _recordingContext.state == SETTINGS.RECORDING.STATE.AUTO_SCROLL;
    NEETSREC.processTweets(mainColumn);
    // periodically check for collected items to save
    RECORDING.setSaveTimer();
    // periodically scroll (if autoScroll is on)
    
    // TODO... auto-advance to next page
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
  }
  
};