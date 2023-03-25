var URLPARSE = {

  getParsedUrl: function() {
    return URLPARSE.parseUrl(window.location.href);
  },

  parseUrl: function(url) {

    var pageType;
    var site;
    
    url = STR.stripSuffix(url, '/');
    
    if (url && url.replace("mobile.", "").startsWith('https://twitter.com/')) {
      if (url.endsWith('/following')) {
        pageType = PAGETYPE.TWITTER.FOLLOWING;
        site = SITE.TWITTER;
      }
      else if (url.endsWith('/followers') || url.endsWith('/followers_you_follow')) { 
        pageType = PAGETYPE.TWITTER.FOLLOWERS;
        site = SITE.TWITTER;
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
  
}