const parseUrl = function(url) {

  var pageType;
  
  if (url && url.replace("mobile.", "").startsWith('https://twitter.com/')) {
    if (url.endsWith('/following')) {
      pageType = 'followingOnTwitter';
    }
    else if (url.endsWith('/followers')) { 
      pageType = 'followersOnTwitter';
    }
  }
  
  if (pageType == 'followingOnTwitter' || pageType == 'followersOnTwitter') {
    const urlParts = url.split('/');
    const owner = urlParts[urlParts.length - 2];
    
    return {
      pageType: pageType,
      owner: owner
    };
  }
  else {
    return null;
  }
}