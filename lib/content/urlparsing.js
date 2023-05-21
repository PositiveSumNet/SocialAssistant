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
    else if (url && url.startsWith('https://nitter.net')) {
      site = SITE.NITTER;
    }
    
    if (pageType == PAGETYPE.TWITTER.FOLLOWING || pageType == PAGETYPE.TWITTER.FOLLOWERS) {
      const urlParts = url.split('/');
      const owner = urlParts[urlParts.length - 2];
      
      return {
        pageType: pageType,
        site: site,
        owner: owner
      };
    }
    else if (site == SITE.NITTER) {
      const urlParts = STR.stripHttpWwwPrefix(url).split('/');
      
      if (urlParts.length == 2) {
        const owner = urlParts[1];

        return {
          pageType: PAGETYPE.NITTER.PROFILE,
          site: site,
          owner: owner
        };
      }
    }
    else {
      return null;
    }
  }
  
};