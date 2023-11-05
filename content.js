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
var _recorder = null;

// adjust nitter settings (once)
window.onload = function() {
  const href = document.location.href;
  const domain = STR.extractDomain(href);
  // https://nitter.one/settings?reason=clearAltUrls
  if (href.indexOf('https://nitter') > -1 && href.indexOf('/settings') > -1 && href.indexOf(REASON_CLEAR_ALT_URLS) > -1) {
    // remove the query string parm so the refresh excludes it
    window.history.pushState({}, "", href.split("?")[0]);
    // if the nitter instance is in an error state, we can't adjust settings
    const replaceTwitterElm = document.querySelector('input[name="replaceTwitter"]');
    if (replaceTwitterElm) {
      replaceTwitterElm.value = '';
      document.querySelector('input[name="replaceYouTube"]').value = '';
      document.querySelector('input[name="replaceReddit"]').value = '';
      document.querySelector('button[type="submit"]').click();
      const key = `${SETTINGS.FIXED_SETTINGS_PREFIX}${domain}`;
      chrome.storage.local.set({ [key]: true });
    }
  }
};

// main scenario: recording
const kickoffPollForRecording = async function() {
  _recorder = RECORDING.getRecorder();
  if (_recorder) {
    await _recorder.pollForRecording();
  }
  else {
    const href = document.location.href;
    if (href.indexOf('squidlr.com') > -1) {
      await SQUIDDY.pollForCaptureVideo();
    }
  }
}

kickoffPollForRecording();
