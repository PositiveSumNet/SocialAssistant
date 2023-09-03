// background scraping
var _bgScrapeRequests = [];
var _bgDequeuedSet = new Set();
var _bgInProcessSet = new Set();  // built using buildScrapeRequestKeyFromRecord
var _bgLastKickoff;
var _lastSetBadgeText;
var _badgeSetCounter = 0;
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

const _nitterDomains = [
  'nitter.net',
  'nitter.at',
  'nitter.one',
  'nitter.cz'
];

/**************************/
// ON-INSTALL
/**************************/
// todo: consider using 'module' approach that allows background to include library scripts
// stackoverflow.com/questions/2399389/detect-chrome-extension-first-run-update
chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;
  const previousVersion = details.previousVersion;
  const reason = details.reason;
  
  if (previousVersion != currentVersion) {
    console.log(`Previous Version: ${previousVersion }`);
    console.log(`Current Version: ${currentVersion }`);
  }
  
  switch (reason) {
    case 'install':
      console.log('New User installed the extension.');
      chrome.tabs.create({ url: 'welcome.html' });
      break;
    case 'update':
      if (previousVersion != currentVersion) {
        console.log('User has updated their extension.');
        if (previousVersion === "1.0.4") {
          chrome.tabs.create({ url: 'whatsnew105.html' });
        }
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
        const saveResponse = await processSave(request);
        sendResponse(saveResponse);
        return returnsData;
      case 'setBadge':
        fancySetBadge(request.badgeText);
        return returnsData;
      case 'nitterSpeedTest':
        await kickoffNitterSpeedTestAsNeeded();
        return returnsData;
      case 'letsScrape':
        await ensureQueuedScrapeRequests(request.lastScrapedParsedUrl);
        return returnsData;
      case 'logMe':
        console.log(request.data);
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
      requestDomains: _nitterDomains,
      resourceTypes: ['sub_frame'],
    },
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        {header: 'X-Frame-Options', operation: 'remove'},
        {header: 'Content-Security-Policy', operation: 'set', value: ''},
        {header: 'Cross-Origin-Resource-Policy', operation: 'set', value: 'cross-origin'},
        {header: 'Cross-Origin-Embedder-Policy', operation: 'set', value: 'require-corp'}
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

const processSave = async function(request) {
  const records = request.payload;
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
    if (!item.skipImg64) {
      // a) the first way we can inject is simplest (by convention, imgCdnUrl gets an img64Url companion property)
      if (item.imgCdnUrl) {
        item.img64Url = await getImageBase64(item.imgCdnUrl);
      }

      // b) the other way we can inject is setting the img64Url companion property from RECORDING.infuseImgCdns
      // (so that background.js can avoid knowledge of specific savable entities... especially since we don't yet use 'module' approach)
      if (item.imgInfos && item.imgInfos.length > 0) {
        for (let j = 0; j < item.imgInfos.length; j++) {
          let imgInfo = item.imgInfos[j];
          if (imgInfo.imgCdnUrl) {
            imgInfo.img64Url = await getImageBase64(imgInfo.imgCdnUrl);
          }
        }
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
  try {
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
  catch(err) {
    console.log(`img64err: ${err}`);
    return undefined;
  }
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

const scrapeRequestMatchesParsedUrl = function(request, parsedUrl) {

  if (request.pageType != parsedUrl.pageType) {
    return false;
  }
  
  switch (request.pageType) {
    case 'twitterProfile':
      // request.record is a handle
      return handlesMatch(request.record, parsedUrl.owner);
    case 'tweets':
      // request.record is an urlKey, i.e. '/username/status/12345'
      return tweetUrlsMatch(request.record, parsedUrl);
    default:
      return false;
  }
}

const makeTweetUrlKey = function(parsedUrl) {
  const owner = parsedUrl.owner.replace('@', '');
  return `/${owner}/status/${parsedUrl.threadDetailId}`.toLowerCase();
}

const tweetUrlsMatch = function(urlKey, parsedUrl) {
  // construct urlKey for a tweet thread
  if (!urlKey || !parsedUrl || !parsedUrl.owner || !parsedUrl.threadDetailId) {
    return false;
  }

  const urlKey2 = makeTweetUrlKey(parsedUrl);
  return urlKey.toLowerCase() == urlKey2;
}

const handlesMatch = function(h1, h2) {
  if (!h1 || !h2) {return false;}

  if (!h1.startsWith('@')) {
    h1 = '@' + h1;
  }
  if (!h2.startsWith('@')) {
    h2 = '@' + h2;
  }

  return h1.toLowerCase() == h2.toLowerCase();
}

// pull the last scrape out of the in-memory variable
// and if it was the last one, remove the cacheKey holding its batch
const processLastScrape = async function(lastScrapedParsedUrl) {
  if (!lastScrapedParsedUrl) { return; }

  // if the dequeued list has gotten absurdly large, can clear it (causing more harm than good if huge; no big deal if we waste time on already-covered ground)
  if (_bgDequeuedSet.length > 1000) {
    _bgDequeuedSet = new Set();
  }

  let lastScrapedRequestKey = buildScrapeRequestKeyFromParsedUrl(lastScrapedParsedUrl);
  if (_bgInProcessSet.has(lastScrapedRequestKey)) {
    _bgInProcessSet.delete(lastScrapedRequestKey);
  }

  let removalCacheKey = '';
  for (let i = 0; i < _bgScrapeRequests.length; i++) {
    let request = _bgScrapeRequests[i];
    if (scrapeRequestMatchesParsedUrl(request, lastScrapedParsedUrl) == true) {
      _bgScrapeRequests.splice(i, 1);
      removalCacheKey = request.cacheKey;
      break;
    }
  }

  // if we've now processed the last item, that storage item can be removed
  if (_bgScrapeRequests.length == 0 && removalCacheKey.length > 0) {
    await chrome.storage.local.remove(removalCacheKey);
  }

  // tell listeners we just scraped this
  chrome.runtime.sendMessage(
    {
      actionType: 'bgScraped',
      parsedUrl: lastScrapedParsedUrl
    });
}

const ensureQueuedScrapeRequests = async function(lastScrapedParsedUrl) {
  const context = await chrome.storage.local.get('recordingContext');
  if (!context || !context.recordingContext || !context.recordingContext.auto) { 
    // they never did auto-recording
    return; 
  }
  // if "resolve full threads" is false, then don't do this
  if (context.recordingContext.auto.resolvesThreads === false) {
    return;
  }
  
  // if we weren't passed a lastScrapedParsedUrl and there are _bgInProcessSet records,
  // then let's finish processing them first (abandoning hope on completion after 5 seconds)
  if (!lastScrapedParsedUrl && _bgInProcessSet.length > 0 && _bgLastKickoff && (Date.now() - _bgLastKickoff > 5000)) {
    console.log('cannot Q a new one yet');
    return;
  }

  // pull the last scrape out of the in-memory variable
  // and if it was the last one, remove the cacheKey holding its batch
  if (lastScrapedParsedUrl) {
    await processLastScrape(lastScrapedParsedUrl);
  }

  if (_bgScrapeRequests.length > 0) { 
    // if there are more items already in the in-memory-queue to process, then we can just kick off the next one
    await scrapeNext();
  }
  else {
    const all = await chrome.storage.local.get();
    const entries = Object.entries(all);
  
    for (const [key, val] of entries) {
      // i.e. STORAGE_PREFIX.BG_SCRAPE
      if (key.startsWith('bgscrape-')) {
        // we only want to kick off one set at a time, so... add to queue
        enqueueScrapeRequests(val.records, val.pageType, key);
        // kick off first scrape and
        await scrapeNext();
        // exit without looping further
        return;
      }
    }
  }
  //console.log('Done queueing background scrape requests');
}

// for now, the background scrape request always provides a set of handles as its data payload
// if this changes, we'll build a switch statement on pageType
const enqueueScrapeRequests = function(records, pageType, cacheKey) {
  for (let i = 0; i < records.length; i++) {
    _bgScrapeRequests.push({pageType: pageType, record: records[i], cacheKey: cacheKey});
  }
}

const buildScrapeRequestKeyFromParsedUrl = function(parsedUrl) {
  if (!parsedUrl) { return null; }
  let record;

  switch (parsedUrl.pageType) {
    case 'tweets':
      record = makeTweetUrlKey(parsedUrl);
      break;
    case 'twitterProfile':
      record = parsedUrl.owner;
      break;
    default:
      return null;
  }

  return buildScrapeRequestKeyFromRecord(parsedUrl.pageType, record);
}

const buildScrapeRequestKeyFromRecord = function(pageType, record) {
  if (!pageType) { return null; }
  // record is a string, e.g. a handle (for profile scraping) or a tweet thread urlKey
  // content.js needs to use same approach when it checks for BG_SCRAPE.SCRAPE_KEYS
  // chose a unique delimiter (BG_SCRAPE.DELIMITER)
  return `${pageType}::${record}`.toLowerCase();
}

const scrapeNext = async function() {
  if (_bgScrapeRequests.length === 0) {
    //console.log('Done processing scrape queue for now');
    return;
  }

  // find the first one not already dequeued
  const request = _bgScrapeRequests.find(function(r) {
    let key = buildScrapeRequestKeyFromRecord(r.pageType, r.record);
    return !_bgDequeuedSet.has(key);
  });

  if (!request) { return; }

  switch (request.pageType) {
    case 'twitterProfile':
      await scrapeTwitterProfile(request);
      break;
    case 'tweets':
      await scrapeTweetThread(request);
      break;
    default:
      break;
  }
}

const shouldRunSpeedTest = async function() {
  const speedTestSetting = await getStorageValue('nitterSpeedTest');

  if (!speedTestSetting || !speedTestSetting['end']) {
    return true;
  }

  const lastEnd = parseInt(speedTestSetting['end']);
  return Date.now() - lastEnd > 30000;  // re-check every 30 seconds
}

const getNitterDomainsNeedingSettingsFix = async function() {
  const needingFixDomains = [];
  for (let i = 0; i < _nitterDomains.length; i++) {
    let nitterDomain = _nitterDomains[i];
    // SETTINGS.FIXED_SETTINGS_PREFIX:
    let settingName = `fixedSettings-${nitterDomain}`;
    let setting = await chrome.storage.local.get(settingName);
    if (!setting || !setting[settingName]) {
      needingFixDomains.push(nitterDomain);
    }
  }

  return needingFixDomains;
}

const getNitterSettingFixUrls = async function() {
  const domains = await getNitterDomainsNeedingSettingsFix();
  // see REASON_CLEAR_ALT_URLS
  const fixUrls = domains.map(function(domain) { return `https://${domain}/settings?reason=clearAltUrls`; });
  return fixUrls;
}

// to help subsequent nitter calls to know which server is best to use
const kickoffNitterSpeedTestAsNeeded = async function() {
  if (_bgInProcessSet.size == 0) {
    // to get the storage key (our way of communicating with content.js) to be in line with our empty in-memory variable
    // instead of holding over from the last session... and since it's async, we didn't have an easy opportunity "on startup" of background.js
    await chrome.storage.local.remove('bgScrapeKeys');
  }

  await ensureOffscreenDocument();

  const needSpeedTest = await shouldRunSpeedTest();
  if (needSpeedTest == true) {
    // see SETTINGS.NITTER.SPEED_TEST
    await chrome.storage.local.set({'nitterSpeedTest': { 'start': Date.now() }});
    const testUrls = _nitterDomains.map(function(domain) { return `https://${domain}/jack/with_replies`; });
    const settingFixUrls = await getNitterSettingFixUrls();
    testUrls.push(...settingFixUrls);
    
    chrome.runtime.sendMessage({
      actionType: 'navFrameUrls',
      urls: testUrls
    });
  }
}

const ensureOffscreenDocument = async function() {
  const hasDoc = await hasDocument();
  if (hasDoc == true) { return; }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: 'Parse requested file in the background'
  });
}

const navigateOffscreenDocument = async function(url) {
  
  console.log('in-process');
  console.log(..._bgInProcessSet);
  await ensureOffscreenDocument();

  // this will help the content.js to know it's a background scrape request
  // caller already added key to the set
  await chrome.storage.local.set({ ['bgScrapeKeys']: Array.from(_bgInProcessSet) });

  // send a message to be picked up by offscreen.js
  // and provided that the url is recognized by the manifest, 
  // the content script (parser) should get loaded
  chrome.runtime.sendMessage({
    actionType: 'navFrameUrl',
    url: url
  });
}

// repeated at settingslib.js (not ready for background to be a 'module', so not DRY yet)
const getNitterDomain = async function() {
  const defaultDomain = 'nitter.net';

  // see if a speed-test has happened
  const speedTestSetting = await getStorageValue('nitterSpeedTest');
  
  if (!speedTestSetting || !speedTestSetting['winner']) {
    // surprising, since we run speed test
    console.log('Default for nitter');
    return defaultDomain;
  }

  return speedTestSetting['winner'];
}

// see notes at offscreen.js
// request.record is an urlKey e.g. '/username/status/12345'
const scrapeTweetThread = async function(request) {
  const bgKey = buildScrapeRequestKeyFromRecord('tweets', request.record);
  if (_bgDequeuedSet.has(bgKey)) {
    return;
  }
  _bgDequeuedSet.add(bgKey);
  _bgInProcessSet.add(bgKey);
  _bgLastKickoff = Date.now();
  const nitterDomain = await getNitterDomain();
  // request.record is tweet urlKey
  const url = `https://${nitterDomain}${request.record}`;
  console.log(`nav-offscreen: ${url}`);
  await navigateOffscreenDocument(url);
}

// see notes at offscreen.js
const scrapeTwitterProfile = async function(request) {
  const bgKey = buildScrapeRequestKeyFromRecord('twitterProfile', request.record);
  if (_bgDequeuedSet.has(bgKey)) {
    return;
  }
  _bgDequeuedSet.add(bgKey);
  _bgInProcessSet.add(bgKey);
  _bgLastKickoff = Date.now();
  const nitterDomain = await getNitterDomain();
  const handleOnly = request.record.substring(1); // sans-@
  const url = `https://${nitterDomain}/${handleOnly}`;
  await navigateOffscreenDocument(url);
}

const fancySetBadge = function(text) {
  chrome.action.setBadgeText({text: text});
  
  _badgeSetCounter++;
  const isEven = (_badgeSetCounter % 2) == 0;
  // toggle color
  if (isEven == true || text == 'DONE') {
    chrome.action.setBadgeBackgroundColor({color: "#1A73E8" });
  }
  else {
    chrome.action.setBadgeBackgroundColor({color: "#216CB1" });
  }
  _lastSetBadgeText = Date.now();
}

const checkIfShouldAssumeDone = function() {

  chrome.action.getBadgeText({}, function(result) {
    if (result && result.startsWith('+') && _lastSetBadgeText && (Date.now() -_lastSetBadgeText) > 8000) {
      fancySetBadge('DONE');
    }
  });
  
  // a long enough time period that we can really believe it's done
  setTimeout(() => {
    checkIfShouldAssumeDone();
  }, 10000);  
}
checkIfShouldAssumeDone();

const getStorageValue = async function(key) {
  const setting = await chrome.storage.local.get(key);
  if (!setting) { return null; }
  return setting[key];
}