// a note on scraping (legal standing):
// cpomagazine.com/data-privacy/what-the-hiq-vs-linkedin-case-means-for-automated-web-scraping/

/*
  APPLICATION FLOW:
  
  On Startup
    tryRecordAsNeeded() if cached setting suggests we should
  
  On click 'record' or stop recording from the popup
    timer checks for updated recordingContext

  When we're recording, a MutationObserver looks for newly added nodes (plus when turned on, finds relevant ones that are already there)
  and converts them to the savable records. Every 5 seconds, these are saved to localStorage (using background.js) thanks to RECORDING.setSaveTimer. 
  When the DB UI is opened, records are flushed from localStorage to the SQLite database.
  
*/

var _shuntRecorder = false;
var _recorder = null;

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

// scenario 2) on startup, see if it's a SPECIAL matched background scrape request
// (special in that we don't want recorder to do its thing; this is really just a story for uploaded profile scrape requests, for now)
chrome.storage.local.get([SETTINGS.BG_SCRAPE.SCRAPE_URL], function(result) {
  const bgUrl = result[SETTINGS.BG_SCRAPE.SCRAPE_URL];

  if (bgUrl) {
    _isBackgroundRecordingUrl = STR.sameText(STR.getUrlSansHashAndQueryString(document.location.href), STR.getUrlSansHashAndQueryString(bgUrl));
    const bgParsedUrl = URLPARSE.parseUrl(bgUrl);
    const thisDocParsedUrl = URLPARSE.getParsedUrl();
    if (thisDocParsedUrl && URLPARSE.equivalentParsedUrl(bgParsedUrl, thisDocParsedUrl)) {
      switch (thisDocParsedUrl.pageType) {
        case PAGETYPE.TWITTER.PROFILE:
          _shuntRecorder = true;
          NITTER_PROFILE_PARSER.parseToTempStorage();
          break;
        // note that TWITTER.TWEETS falls through b/c the recorder is relevant instead
        default:
          break;
      }
    }
  }
});

// scenario 3) adjust nitter settings (once)
window.onload = function() {
  const href = document.location.href;
  // https://nitter.one/settings?reason=clearAltUrls
  if (href.indexOf('https://nitter') > -1 && href.indexOf('/settings') > -1 && href.indexOf(REASON_CLEAR_ALT_URLS) > -1) {
    // remove the query string parm so the refresh excludes it
    window.history.pushState({}, "", href.split("?")[0]);
    document.querySelector('input[name="replaceTwitter"]').value = '';
    document.querySelector('input[name="replaceYouTube"]').value = '';
    document.querySelector('input[name="replaceReddit"]').value = '';
    document.querySelector('button[type="submit"]').click();
    const domain = STR.extractDomain(href);
    const key = `${SETTINGS.FIXED_SETTINGS_PREFIX}${domain}`;
    chrome.storage.local.set({ [key]: true });
  }
};

// main scenario: recording
const kickoffPollForRecording = async function() {
  if (_shuntRecorder == true) {
    return;
  }
  
  _recorder = RECORDING.getRecorder();
  if (_recorder) {
    await _recorder.pollForRecording();
  }
  else {
    // not every twitter page is meant to get recorded
  }
}

kickoffPollForRecording();
