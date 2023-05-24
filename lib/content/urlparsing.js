var URLPARSE = {

  getParsedUrl: function() {
    return URLPARSE.parseUrl(window.location.href);
  },


  // the storage value is updated when the background frame is navigated to
  isBackgroundScrapeUrl: function(url) {
    if (!url) { 
      url = URLPARSE.getParsedUrl();
    }
    
    const bgScrapeUrl = localStorage.getItem(url);
    if (!bgScrapeUrl) { return false; }
    const parsedBgScrapeUrl = URLPARSE.parseUrl(bgScrapeUrl);
    const parsedRequestUrl = URLPARSE.parseUrl(url);
    return URLPARSE.urlsAreEquivalent(parsedBgScrapeUrl, parsedRequestUrl);
  },

  urlsAreEquivalent: function(parsedUrl1, parsedUrl2) {
    if (!parsedUrl1 || !parsedUrl2) { return false; }
    return (parsedUrl1.pageType == parsedUrl2.pageType && parsedUrl1.site == parsedUrl2.site && parsedUrl1.owner == parsedUrl2.owner);
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
    else if (url && SETTINGS.NITTER.isValidNitterPage(url) == true) {
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