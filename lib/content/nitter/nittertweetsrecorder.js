// see IRecorder defined at recorderfactory
// see state variables at recordinglib
var NEETREC = {
  
  // IRecorder
  pollForRecording: async function() {
    console.log('poll nitter');
    // todo...
  },
  
  // IRecorder
  kickoffRecording: function() {
    // todo...
  },
  
  // IRecorder
  shouldAvoidScrollIfHidden: function() {
    // todo...
  },
  
  // IRecorder
  isThrottled: function() {
    // todo...
  },

  tryUnthrottle: function() {
    // todo...
  },

  processTweets: function(scopeElm) {
    // todo...
  },
  
  tweetMutationCallback: function(mutations) {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        let nodes = mutation.addedNodes;
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          
          // todo...
        }
      }
    }
  }
  
};