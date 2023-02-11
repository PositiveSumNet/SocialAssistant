chrome.runtime.onMessage.addListener( function(request, sender, sendResponse)
{
  switch (request.actionType)
  {
    case 'save':
      switch (request.pageType) {
        case 'followingOnTwitter':
          console.log(request.owner + ' is following...');
          console.table(request.payload);
          break;
        case 'followersOnTwitter':
          console.log(request.owner + ' is followed by...');
          console.table(request.payload);
          break;
        default:
          return;
      }
      
      sendResponse({saved: request.payload, success: true});
      break;
    case 'setBadge':
      chrome.action.setBadgeText({text: request.badgeText});
      break;
  }
  
  return true;
});