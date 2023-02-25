chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.actionType)
    {
      case 'save':
        switch (request.pageType) {
          case 'followingOnTwitter':
          case 'followersOnTwitter':
            saveToTempStorage(request);
            // TEMP TEST CODE RE THUMBNAILS
            let uri = await getImageBase64("https://pbs.twimg.com/profile_images/1467370965122306049/mrQQz5CA_x96.jpg");
            console.log(uri);
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

// caches what we'll want to persist to the sqlitedb when we get the chance
const saveToTempStorage = function(request) {
  // the 'fordb-' prefix is how we find all such pending batches
  const key = 'fordb-' + Date.now().toString();
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
