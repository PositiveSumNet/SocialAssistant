chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.actionType)
    {
      case 'save':
        switch (request.pageType) {
          case 'followingOnTwitter':
          case 'followersOnTwitter':
            await injectImageBase64s(request);
            saveToTempStorage(request);
            break;
          default:
            return;
        }
        
        sendResponse({saved: request.payload, success: true});
        break;
      case 'setBadge':
        chrome.action.setBadgeText({text: request.badgeText});
        break;
      default:
        return;
    }
  })();
  return true;
});

// TODO: Parallel tasks like one of these
// bytelimes.com/batch-async-tasks-with-async-generators/
// stackoverflow.com/questions/35612428/call-async-await-functions-in-parallel
const injectImageBase64s = async function(request) {
  for (let i = 0; i < request.payload.length; i++) {
    let item = request.payload[i];
    if (item.imgCdnUrl) {
      item.img64Url = await getImageBase64(item.imgCdnUrl);
    }
  }
}

// caches what we'll want to persist to the sqlitedb when we get the chance
const saveToTempStorage = function(request) {
  // the 'fordb-' prefix is how we find all such pending batches
  const key = 'fordb-' + Date.now().toString();
  
  for (let i = 0; i < request.payload.length; i++) {
    let item = request.payload[i];
  }
  
  chrome.storage.local.set({ [key]: request });
}

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
