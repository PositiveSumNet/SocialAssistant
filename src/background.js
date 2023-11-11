var _lastSetBadgeText;
var _badgeSetCounter = 0;

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
        else if (previousVersion === "1.0.7") {
          chrome.tabs.create({ url: 'whatsnew108.html' });
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
      case 'logMe':
        console.log(request.data);
        return returnsData;
      case 'savedThreadToBg':
        await onSavedThread(request.threadUrlKeys);
        return returnsData;
      case 'foundPartialThread':
        await saveThreadExpansionUrlKey(request.threadUrlKey);
        return returnsData;
      case 'foundEmbeddedVideo':
        await saveEmbeddedVideoUrlKey(request.urlKey);
        return returnsData;
      default:
        return returnsData;
    }
  })();
  return returnsData;
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

      // b1) though I'd rather not have knowledge here of quoteTweet.postImgs (domain-specific), 
      // background.js isn't using modules yet, so...
      let imgInfos = [];
      if (item.quoteTweet && item.quoteTweet.postImgs && item.quoteTweet.postImgs.length > 0) {
        imgInfos.push(...item.quoteTweet.postImgs);
      }
      // b2) the other way we can inject is setting the img64Url companion property from RECORDING.infuseImgCdns
      if (item.imgInfos && item.imgInfos.length > 0) {
        imgInfos.push(...item.imgInfos);
      }

      for (let j = 0; j < imgInfos.length; j++) {
        let imgInfo = imgInfos[j];
        if (imgInfo.imgCdnUrl) {
          imgInfo.img64Url = await getImageBase64(imgInfo.imgCdnUrl);
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

/**************************/
// EMBEDDED VIDEOS
/**************************/

const saveEmbeddedVideoUrlKey = async function(urlKey) {
  const EMBEDDED_VIDEO_URLKEY = 'embVideo-';
  if (urlKey) {
    const key = `${EMBEDDED_VIDEO_URLKEY}${urlKey}`;
    await chrome.storage.local.set({ [key]: urlKey });
  }
}

/**************************/
// THREADS
/**************************/

// a clone of SETTINGs.RECORDING.removeThreadExpansionUrlKey
// until we use "modules" approach to background though, can't stay DRY
const saveThreadExpansionUrlKey = async function(threadUrlKey) {
  const THREAD_EXPANSION_URLKEY = 'threadMore-';
  if (threadUrlKey) {
    const key = `${THREAD_EXPANSION_URLKEY}${threadUrlKey}`;
    await chrome.storage.local.set({ [key]: threadUrlKey });
  }
}

// a clone of SETTINGs.RECORDING.removeThreadExpansionUrlKey
// until we use "modules" approach to background though, can't stay DRY
const onSavedThread = async function(threadUrlKeys) {

  for (let i = 0; i < threadUrlKeys.length; i++) {
    let threadUrlKey = threadUrlKeys[i];
    // this gives the user time to plunk around with the page
    // i.e. in case they're scrolling through it etc. while reviewing threads to expand
    // (and where not already recording manually)
    // this is part of the popup's threaa expansion flow
    setTimeout(async () => {
      const THREAD_EXPANSION_URLKEY = 'threadMore-';
      const key = `${THREAD_EXPANSION_URLKEY}${threadUrlKey}`;
      await chrome.storage.local.remove(key);
    }, 10000);
  }
}

/**************************/
// MISC
/**************************/

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

const getStorageValue = async function(key) {
  const setting = await chrome.storage.local.get(key);
  if (!setting) { return null; }
  return setting[key];
}

// ensure badge clears out 
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
