/*
returns:

IRecorder {
  void pollForRecording();
  bool shouldAvoidScrollIfHidden();
  void kickoffRecording();
  bool isThrottled();
  void tryUnthrottle();
}

*/

var RECORDERFACTORY = {
  
  getRecorder: function(parsedUrl) {
    switch(parsedUrl.pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return TFOLLOWREC;
      case PAGETYPE.TWITTER.TWEETS:
        switch (parsedUrl.site) {
          case SITE.NITTER:
            return NEETREC;
          default:
            return TWEETREC;
        }
      default:
        return undefined;
    }
  }
};