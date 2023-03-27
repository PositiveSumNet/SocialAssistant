// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

// manifest shows other included files
// also see lib/recordinglib.js (including for public variables)

// on startup, see if supposed to already be recording
chrome.storage.local.get(['recording'], function(result) {
  if (result.recording === true) {
    // here at startup, extension is in a 'load if we can' state
    const parsedUrl = URLPARSE.getParsedUrl();
    
    if (parsedUrl) {
      const recorder = RECORDERFACTORY.getRecorder(parsedUrl.pageType);
      
      if (recorder) {
        recorder.startRecording();
      }
    }
  }
});

// toggle recording and auto-scroll on/off
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  const parsedUrl = URLPARSE.getParsedUrl();
  
  if (parsedUrl) {
    const recorder = RECORDERFACTORY.getRecorder(parsedUrl.pageType);
    
    if (recorder) {
      recorder.listenForRecordingToggle(request, sender, sendResponse);
    }
  }
});
