chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.actionType)
    {
      case 'save':
        const saveResponse = await processSave(request.payload);
        sendResponse(saveResponse);
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
      item.img64Url = await getImageBase64(item.imgCdnUrl);
    }
  }
}

// caches what we'll want to persist to the sqlitedb when we get the chance
const saveToTempStorage = function(records) {
  // the 'fordb-' prefix is how we find all such pending batches
  const key = 'fordb-' + Date.now().toString();
  chrome.storage.local.set({ [key]: records });
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
