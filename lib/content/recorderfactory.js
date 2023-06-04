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
  
  getRecorder: function(pageType) {
    switch(pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return TFOLLOWREC;
      default:
        return undefined;
    }
  }
};