const getParsedUrl = function() {
  return parseUrl(window.location.href);
}

const parseUrl = function(url) {

  var pageType;
  var site;
  
  if (url && url.replace("mobile.", "").startsWith('https://twitter.com/')) {
    if (url.endsWith('/following')) {
      pageType = 'followingOnTwitter';
      site = SITE_TWITTER;
    }
    else if (url.endsWith('/followers')) { 
      pageType = 'followersOnTwitter';
      site = SITE_TWITTER;
    }
  }
  
  if (pageType == 'followingOnTwitter' || pageType == 'followersOnTwitter') {
    const urlParts = url.split('/');
    const owner = urlParts[urlParts.length - 2];
    
    return {
      pageType: pageType,
      site: site,
      owner: owner
    };
  }
  else {
    return null;
  }
}
