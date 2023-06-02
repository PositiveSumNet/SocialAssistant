// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

/*
  APPLICATION FLOW:
  
  On Startup
    tryStartRecording() if cached setting suggests we should
  
  On click 'record' or stop recording from the popup
    timer checks for updated recordingContext

  When we're recording, a MutationObserver looks for newly added nodes (plus when turned on, finds relevant ones that are already there)
  and converts them to the savable records. Every 5 seconds, these are saved to localStorage (using background.js) thanks to RECORDING.setSaveTimer. 
  When the DB UI is opened, records are flushed from localStorage to the SQLite database.
  
*/

var _invalidatedContext = false;

// scenario 1) on startup, see if it's a speed-test situation
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
// scenario 2) on startup, see if it's a matched background scrape request
chrome.storage.local.get([SETTINGS.BG_SCRAPE.SCRAPE_URL], function(result) {
  const bgUrl = result[SETTINGS.BG_SCRAPE.SCRAPE_URL];

  if (bgUrl) {
    const bgParsedUrl = URLPARSE.parseUrl(bgUrl);
    const thisDocParsedUrl = URLPARSE.getParsedUrl();
    if (thisDocParsedUrl && URLPARSE.equivalentParsedUrl(bgParsedUrl, thisDocParsedUrl)) {
      switch (thisDocParsedUrl.pageType) {
        // todo: more bg types here
        case PAGETYPE.NITTER.PROFILE:
          _bgOnly = true;
          NITTER_PROFILE_PARSER.parseToTempStorage();
          break;
        default:
          break;
      }
    }
  }
});

let _recording = false;
// on startup, set up a timer to periodically check recordingContext
// records if we're in a scenario matching that context
const pollRecordingContext = async function() {
  if (_bgOnly == true) {
    // this polling is only meant for the primary focus recording tab.
    // background scraping is a separate story
    return;
  }
  
  // handle scenario of an old tab lying around post-update
  // stackoverflow.com/questions/53939205/how-to-avoid-extension-context-invalidated-errors-when-messaging-after-an-exte
  try {
    const recordingContext = await SETTINGS.RECORDING.getContext();
    const shouldRecord = RECORDING.shouldRecord(recordingContext);
    const recorder = RECORDING.getRecorder();
  
    if (recorder && _recording == true && shouldRecord == false) {
      console.log('STOP recording ' + document.location.href);
      _recording = false;
    }
    else if (recorder && _recording == false && shouldRecord == true) {
      console.log('START recording ' + document.location.href);
      //recorder.tryStartRecording();
      // const nitterDomain = await SETTINGS.NITTER.getNitterDomain();
      _recording = true;
    }
  
    setTimeout(async () => {
      if (_invalidatedContext == false) {
        await pollRecordingContext();
      }
    }, 1500);
  }
  catch(error) {
    if (error.toString().includes("Extension context invalidated")) {
      console.log('page refresh is required! disabling this tab for now...');
      _invalidatedContext = true;
    }
  }
}

// start listening...
pollRecordingContext();
