// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

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

let _bgOnly = false;
// on startup, see if it's a background scrape request
chrome.storage.local.get([SETTINGS.BG_SCRAPE.SCRAPE_URL], function(result) {
  const bgUrl = result[SETTINGS.BG_SCRAPE.SCRAPE_URL];

  if (bgUrl && STR.sameText(bgUrl, document.location.href)) {
    const parsedUrl = URLPARSE.getParsedUrl();
    if (parsedUrl) {
      switch (parsedUrl.pageType) {
        // background processing
        case PAGETYPE.NITTER.PROFILE:
          _bgOnly = true;
          NITTER_PROFILE_PARSER.parseToTempStorage();
          break;
        default:
          break;
      }

      SETTINGS.RECORDING.setLastParsedUrl(parsedUrl);
    }
  }
});

// on startup, see if supposed to already be recording
chrome.storage.local.get([SETTINGS.RECORDING], function(result) {
  if (!_bgOnly && result.recording === true) {
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
  if (!_bgOnly && recorder) {
    recorder.listenForRecordingToggle(request, sender, sendResponse);
  }
});
