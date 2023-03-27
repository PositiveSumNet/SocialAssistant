// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

// manifest shows other included files
// also see lib/recordinglib.js (including for public variables)

/*
  APPLICATION FLOW:
  
  On Startup
    startRecording() if cached setting suggests we should
  
  On click 'record' or stop recording from the popup
    listenForRecordingToggle() starts/stops recording and auto-scroll

  When we're recording, a MutationObserver looks for newly added nodes (plus when turned on, finds relevant ones that are already there)
  and converts them to the savable records. Every 5 seconds, these are saved to localStorage (using background.js) thanks to RECORDING.setSaveTimer. 
  When the DB UI is opened, records are flushed from localStorage to the SQLite database.
  
*/

// on startup, see if supposed to already be recording
chrome.storage.local.get(['recording'], function(result) {
  if (result.recording === true) {
    // here at startup, extension is in a 'load if we can' state
    const recorder = RECORDING.getRecorder();

    if (recorder) {
      recorder.startRecording();
    }
  }
});

// toggle recording and auto-scroll on/off
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  const recorder = RECORDING.getRecorder();
  
  if (recorder) {
    recorder.listenForRecordingToggle(request, sender, sendResponse);
  }
});
