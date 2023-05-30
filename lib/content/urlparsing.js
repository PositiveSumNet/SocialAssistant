var URLPARSE = {

  getParsedUrl: function() {
    return URLPARSE.parseUrl(window.location.href);
  },

  equivalentParsedUrl: function(parsedUrl1, parsedUrl2) {
    if (!parsedUrl1 || !parsedUrl2) { return false; }
    return parsedUrl1.pageType == parsedUrl2.pageType && STR.sameText(parsedUrl1.owner, parsedUrl2.owner);
  },

  // buildUrl: function(parsedUrl) {
  //   const site = parsedUrl.site || PAGETYPE.getSite(parsedUrl.pageType);
  //   const owner = STR.stripPrefix(parsedUrl.owner, '@');
    
  //   switch (parsedUrl.pageType) {
  //     case PAGETYPE.TWITTER.FOLLOWING:
  //     case PAGETYPE.NITTER.FOLLOWING:
      
  //     case PAGETYPE.TWITTER.FOLLOWERS:
  //     case PAGETYPE.NITTER.FOLLOWERS:

  //     case PAGETYPE.TWITTER.PROFILE:
  //     case PAGETYPE.NITTER.PROFILE:
  //   }
  // },

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

        // re isBackground: could later append query string to offline urls or use other means like 
        // storing the frame url (though keep in mind localStorage isn't shared across frames).
        // for now, isBackground is true for nitter always
        return {
          pageType: PAGETYPE.NITTER.PROFILE,
          site: site,
          owner: owner,
          isBackground: true
        };
      }
    }
    else {
      return null;
    }
  }
  
};