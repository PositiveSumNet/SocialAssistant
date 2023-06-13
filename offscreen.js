/*******************************************************************************************************/
// SCRAPING FLOW
// Use Case #1) power-user upload of PSN-scored handles 
// (index.js processUpload() with UPLOAD_CONTEXT.TWITTER_PROFILES_TO_SCRAPE)
// * BGFETCH_REQUEST.cacheTwitterHandlesForProfileScrape() caches to 
//    storage.local an array of handles with a cacheKey starting with STORAGE_PREFIX.BG_SCRAPE
// NEXT (including for future use cases...)
// 1) fire a message MSGTYPE.TOBACKGROUND.LETS_SCRAPE
//   (to make sure the background worker knows we want it to look for scrape requests, if it wasn't already)
// 2) background.js hears the message and calls ensureQueuedScrapeRequests()
//   a) if _bgScrapeProcessing is true, we exit (finish processing existing requests before loading more)
//   b) grab the first local.storage starting with with STORAGE_PREFIX.BG_SCRAPE (others can wait)
//   c) set _bgScrapeProcessing to true
//   d) push to _bgScrapeRequests [] for each item contained in the storage item 
//   e) scrapeNext() - Kick off _bgScrapeRequests[0]
//      determine the offscreen document to load (the url) and sendMessage 
// 3) This offscreen.js hears the message and navigates the offscreen page frame to the url 
// 4) content.js wakes up for the nitter url and calls e.g. NITTER_PROFILE_PARSER.parseToTempStorage()
/*******************************************************************************************************/

// loading page to scrape into an offscreen document iframe
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  switch (message.actionType) {
    case MSGTYPE.TO_OFFSCREEN.NAV_FRAME_URLS:
      await navFrameUrls(message);
      break;
    case MSGTYPE.TO_OFFSCREEN.NAV_FRAME_URL:
      await navFrameUrl(message);
      break;
    default:
      break;
  }
}

async function navFrameUrls(message) {
  removeFrames();
  for (let i = 0; i < message.urls.length; i++) {
    let url = message.urls[i];
    attachFrameUrl(url);
  }
}

async function navFrameUrl(message) {
  removeFrames();
  attachFrameUrl(message.url);
}

function attachFrameUrl(url) {
  const newFrame = document.createElement('iframe');
  newFrame.src = url;
  document.body.appendChild(newFrame);
}

function removeFrames() {
  document.querySelectorAll('iframe').forEach(function(fram) {
    fram.parentElement.removeChild(fram);
  });
}