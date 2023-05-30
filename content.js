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

// on startup, see if it's a speed-test situation
chrome.storage.local.get([SETTINGS.NITTER.SPEED_TEST.CACHE_KEY], function(result) {
  const speedTest = result[SETTINGS.NITTER.SPEED_TEST.CACHE_KEY];
  if (document.location.href.indexOf(SETTINGS.NITTER.SPEED_TEST.URL_SUFFIX) > -1) {
    if (!speedTest[SETTINGS.NITTER.SPEED_TEST.END]) {
      // test isn't over yet; first to finish "wins"
      const start = parseInt(speedTest[SETTINGS.NITTER.SPEED_TEST.START]);
      if (Date.now() - start < 5000) {
        // valid if within 5 seconds
        speedTest[SETTINGS.NITTER.SPEED_TEST.END] = Date.now();
        const domain = STR.extractDomain(document.location.href);
        speedTest[SETTINGS.NITTER.SPEED_TEST.WINNER] = domain;
        chrome.storage.local.set({ [SETTINGS.NITTER.SPEED_TEST.CACHE_KEY]: JSON.stringify(speedTest) });
      }
    }
  }
});

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

const tryRecording = async function() {
  const nitterDomain = await SETTINGS.NITTER.getNitterDomain();
  const recorder = RECORDING.getRecorder();
  if (recorder) {
    console.log('record!');
    //recorder.startRecording();
  }
}

// toggle recording and auto-scroll on/off
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  const recorder = RECORDING.getRecorder();
  if (!_bgOnly && recorder) {
    recorder.listenForRecordingToggle(request, sender, sendResponse);
  }
});

// on startup, see if supposed to already be recording
chrome.storage.local.get([SETTINGS.RECORDING.CONTEXT], async function(result) {
  const context = JSON.parse(result[SETTINGS.RECORDING.CONTEXT]);
  console.log(context);
  // switch (_startupContext.state) {
  //   case SETTINGS.RECORDING.STATE.MANUAL:
  //     if (SETTINGS.RECORDING.getManualSecondsRemaining() > 0) {
  //       tryRecording();
  //     }
  //     break;
  //   case SETTINGS.RECORDING.STATE.AUTO_SCROLL:
  //     const currentParsedUrl = URLPARSE.getParsedUrl();
  //     const autoParsedUrl = SETTINGS.RECORDING.getAutoParsedUrl();
  //     if (URLPARSE.equivalentParsedUrl(currentParsedUrl, autoParsedUrl)) {
  //       tryRecording();
  //     }
  //     break;
  //   default:
  //     break;
  // }
});
