chrome.runtime.onMessage.addListener( function(request, sender, sendResponse)
{
  switch (request.actionType)
  {
    case 'save':
      switch (request.pageType) {
        case 'followingOnTwitter':
        case 'followersOnTwitter':
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
  
  return true;
});

// caches what we'll want to persist to the sqlitedb when we get the chance
const saveToTempStorage = function(request) {
  // the 'fordb-' prefix is how we find all such pending batches
  const key = 'fordb-' + Date.now().toString();
  chrome.storage.local.set({ key: request });
}