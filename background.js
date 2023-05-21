// background scraping
var _bgScrapeRequests = [];
var _bgScrapeProcessing = false;
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

/**************************/
// ON-INSTALL
/**************************/
// todo: consider using 'module' approach that allows background to include library scripts
// stackoverflow.com/questions/2399389/detect-chrome-extension-first-run-update
chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;
  const previousVersion = details.previousVersion;
  const reason = details.reason;
  
  console.log(`Previous Version: ${previousVersion }`);
  console.log(`Current Version: ${currentVersion }`);

  switch (reason) {
     case 'install':
        console.log('New User installed the extension.');
        chrome.tabs.create({ url: 'welcome.html' });
        break;
     case 'update':
        console.log('User has updated their extension.');
        if (previousVersion === "1.0.4") {
          chrome.tabs.create({ url: 'whatsnew105.html' });
        }
        break;
     case 'chrome_update':
     case 'shared_module_update':
     default:
        console.log('Other install events within the browser');
        break;
  }
});

/**************************/
// LISTEN FOR MESSAGES
/**************************/
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // stackoverflow.com/a/73836810
  let returnsData = false;
  switch (request.actionType) {
    case 'save':
      returnsData = true;
      break;
    default:
      break;
  }

  (async () => {
    switch (request.actionType) {
      case 'save':
        const saveResponse = await processSave(request.payload);
        sendResponse(saveResponse);
        return returnsData;
      case 'setBadge':
        chrome.action.setBadgeText({text: request.badgeText});
        return returnsData;
      case 'letsScrape':
        await ensureQueuedScrapeRequests();
        return returnsData;
      default:
        return returnsData;
    }
  })();
  return returnsData;
});

/******************************/
// CSP HEADER STRIPPING
/******************************/
chrome.runtime.onInstalled.addListener(() => {
  
  // developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
  const RULE = {
    id: 1,
    condition: {
      initiatorDomains: [chrome.runtime.id],
      requestDomains: [
        'nitter.net',
      ],
      resourceTypes: ['sub_frame'],
    },
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        {header: 'X-Frame-Options', operation: 'remove'},
        {header: 'Content-Security-Policy', operation: 'set', value: ''},
        {header: 'Cross-Origin-Resource-Policy', operation: 'set', value: 'cross-origin'},
        {header: 'Cross-Origin-Embedder-Policy', operation: 'set', value: 'credentialless'}
      ],
    },
  };
  
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE.id],
    addRules: [RULE],
  });
});

/**************************/
// SAVING
/**************************/

const processSave = async function(records) {
  await injectImageBase64s(records);
  saveToTempStorage(records);
  return {saved: records, success: true};
}

// TODO: Parallel tasks like one of these
// bytelimes.com/batch-async-tasks-with-async-generators/
// stackoverflow.com/questions/35612428/call-async-await-functions-in-parallel
const injectImageBase64s = async function(records) {
  for (let i = 0; i < records.length; i++) {
    let item = records[i];
    if (item.imgCdnUrl) {
      try {
        item.img64Url = await getImageBase64(item.imgCdnUrl);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

// caches what we'll want to persist to the sqlitedb when we get the chance
const saveToTempStorage = function(records) {
  // the 'fordb-' prefix is how we find all such pending batches (see STORAGE_PREFIX.FOR_DB)
  const key = `fordb-${Date.now().toString()}`;
  chrome.storage.local.set({ [key]: records });
}

/**************************/
// BG IMAGE FETCH
/**************************/

// stackoverflow.com/questions/57346889/how-to-return-base64-data-from-a-fetch-promise
const getImageBase64 = async function(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const reader = new FileReader();
  await new Promise((resolve, reject) => {
    reader.onload = resolve;
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return reader.result.replace(/^data:.+;base64,/, '')
}

/******************************************/
// OFFSCREEN SCRAPING
// groups.google.com/a/chromium.org/g/chromium-extensions/c/v0srmN-1hg0/m/QB7Hv74zAAAJ
/******************************************/

const hasDocument = async function() {
  // Check all windows controlled by the service worker if one of them is the offscreen document
  const matchedClients = await clients.matchAll();
  for (const client of matchedClients) {
    if (client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
      return true;
    }
  }
  return false;
}

const ensureQueuedScrapeRequests = async function() {
  console.log('checking scrape queue');
  if (_bgScrapeProcessing === true) { return; }
  
  const all = await chrome.storage.local.get();
  const entries = Object.entries(all);

  for (const [key, val] of entries) {
    // i.e. STORAGE_PREFIX.BG_SCRAPE
    if (key.startsWith('bgscrape-')) {
      // apply a lock and 
      _bgScrapeProcessing = true;
      // see BG_SCRAPE_TYPE
      switch (val.type) {
        case 'twitterProfile':
          // we only want to kick off one set of handles at a time, so...
          // add handles to queue
          enqueueHandleScrapeRequests(val.data, val.type, key);
          // kick off first scrape and
          await scrapeNext();
          // exit without looping further
          return;
        default:
          break;
      }
    }
  }

  //console.log('Done queueing background scrape requests');
}

const enqueueHandleScrapeRequests = function(handles, type, cacheKey) {
  for (let i = 0; i < handles.length; i++) {
    _bgScrapeRequests.push({type: type, handle: handles[i], cacheKey: cacheKey});
  }
}

const scrapeNext = async function() {
  if (_bgScrapeRequests.length === 0) {
    _bgScrapeProcessing = false;
    //console.log('Done processing scrape queue for now');
    return;
  }

  const request = _bgScrapeRequests[0];
  
  switch (request.type) {
    case 'twitterProfile':
      await scrapeTwitterProfile(request);
      break;
    default:
      break;
  }
}

const ensureOffscreenDocument = async function() {

  if (hasDocument() == true) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: 'Parse requested file in the background'
  });
}

const navigateOffscreenDocument = async function(url) {
  
  await ensureOffscreenDocument();

  // send a message to be picked up by offscreen.js
  // and provided that the url is recognized by the manifest, 
  // the content script (parser) should get loaded
  chrome.runtime.sendMessage({
    actionType: 'navFrameUrl',
    url: url
  });
}

const scrapeTwitterProfile = async function(request) {
  const handleOnly = request.handle.substring(1);
  const url = `https://nitter.net/${handleOnly}`;
  await navigateOffscreenDocument(url);
}
