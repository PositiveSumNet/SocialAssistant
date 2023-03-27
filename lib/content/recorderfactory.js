/*
returns:

IRecorder {
  void tryStartRecording();
  bool shouldAvoidScrollIfHidden();
  void startRecording();
  void listenForRecordingToggle();
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