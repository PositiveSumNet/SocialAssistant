var URLPARSE = {

  equivalentUrl: function(url1, url2) {
    if (!url1 || !url2 || url1.length == 0 || url2.length == 0) { return false; }
    const parsedUrl1 = URLPARSE.parseUrl(url1);
    const parsedUrl2 = URLPARSE.parseUrl(url2);
    return URLPARSE.equivalentParsedUrl(parsedUrl1, parsedUrl2);
  },

  equivalentParsedUrl: function(parsedUrl1, parsedUrl2, relaxedOwnerCheck) {
    if (!parsedUrl1 || !parsedUrl2) { return false; }
    const draft = (parsedUrl1.site == parsedUrl2.site && parsedUrl1.pageType == parsedUrl2.pageType && (relaxedOwnerCheck == true || STR.sameText(parsedUrl1.owner, parsedUrl2.owner)));
    
    if (parsedUrl1.withReplies === true && parsedUrl2.withReplies === false || parsedUrl1.withReplies === false && parsedUrl2.withReplies === true) {
      // when user clicks to resume auto-recording and we switch to that tab,
      // we'd rather launch a new window 'with_replies' (for a recording of tweets situation) than to reuse 
      // a window that lacks 'with_replies' (since the default tweets list doesn't go back all the way in time)
      return false;
    }
    else {
      return draft;
    }
  },

  buildUrl: function(parsedUrl, nitterDomain) {
    const site = parsedUrl.site || PAGETYPE.getSite(parsedUrl.pageType);
    const owner = parsedUrl.owner;
    let baseUrl = 'https://twitter.com';

    switch (site) {
      case SITE.NITTER:
        baseUrl = `https://${nitterDomain}`;
        break;
      default:
        break;
    }

    // note that there is no nitter following/follwers
    switch (parsedUrl.pageType) {
      case PAGETYPE.TWITTER.FOLLOWING:
        return `${baseUrl}/${owner}/following`;

      case PAGETYPE.TWITTER.FOLLOWERS:
        return `${baseUrl}/${owner}/followers`;

      case PAGETYPE.TWITTER.PROFILE:
      case PAGETYPE.TWITTER.TWEETS:
        // unless we say 'with_replies' the infinite scroll doesn't go back all the way (empirically)
        return `${baseUrl}/${owner}/with_replies`;
    
      default:
        return undefined;
    }
  },

  parseUrl: function(url) {

    if (!url || url.length == 0) { return undefined; }

    let pageType;
    let site;
    let owner;
    let threadDetailId;
    
    url = STR.stripUrlHashSuffix(url);
    url = STR.stripQueryString(url);
    url = STR.stripSuffix(url, '/');
    url = STR.stripHttpWwwPrefix(url);
    url = url.replace('mobile.', '');

    const parts = url.split('/');
    const domain = parts[0];
    if (STR.sameText(domain, 'twitter.com') == true)  {
      site = SITE.TWITTER;
    }
    else if (SETTINGS.NITTER.isNitterDomain(domain)) {
      site = SITE.NITTER;
    }
    else {
      return undefined;
    }

    let withReplies = false;
    if (parts.length == 2) {
      switch (parts[1].toLowerCase()) {
        case 'home':
          return {
            pageType: PAGETYPE.TWITTER.HOME,
            site: site
          };
        case 'explore':
        case 'notifications':
        case 'messages':
        case 'about':
        case 'settings':
        case 'search':
          return undefined;
        default:
          break;
      }
      
      owner = parts[1];
      pageType = PAGETYPE.TWITTER.TWEETS;
    }
    else if (parts.length == 3) {
      owner = parts[1];
      switch (parts[2].toLowerCase()) {
        case 'followers':
        case 'followers_you_follow':
          pageType = PAGETYPE.TWITTER.FOLLOWERS;
          break;
        case 'following':
          pageType = PAGETYPE.TWITTER.FOLLOWING;
          break;
        case 'with_replies':
          pageType = PAGETYPE.TWITTER.TWEETS;
          withReplies = true;
          break;
        default:
          // unknown  
          return undefined;
      }
    }
    else if (parts.length == 4 && STR.sameText(parts[2], 'status')) {
      // twitter.com/username/status/12345
      owner = parts[1];
      pageType = PAGETYPE.TWITTER.TWEETS;
      threadDetailId = parts[3];
    }
    
    return {
      pageType: pageType,
      site: site,
      owner: owner,
      withReplies: withReplies,
      threadDetailId: threadDetailId
    };
  },

  parsedUrlMatchesBgScrapeKey: function(bgScrapeKey, parsedUrl) {
    if (!bgScrapeKey || !parsedUrl) { return false; }
    const parts = bgScrapeKey.split(SETTINGS.BG_SCRAPE.DELIMITER);
    if (parts.length < 1) { return false; }
    const bgPageType = parts[0];
    const record = parts[1];
    if (bgPageType != parsedUrl.pageType) { return false; }

    switch (bgPageType) {
      case PAGETYPE.TWITTER.PROFILE:
        // record is owner handle
        return STR.sameText(parsedUrl.owner, record);
      case PAGETYPE.TWITTER.TWEETS:
        // record is urlKey
        const urlKey = STR.makeTweetRelativeUrl(parsedUrl.owner, parsedUrl.threadDetailId);
        return STR.sameText(urlKey, record);
      default:
        return false;
    }
  },

  // see usages of SETTINGS.BG_SCRAPE.SCRAPE_KEYS
  currentPageIsBackgroundRecordingUrl: function(bgScrapeKeys) {
    if (!bgScrapeKeys || bgScrapeKeys.length == 0) { return false; }
    const currentParsedUrl = URLPARSE.parseUrl(document.location.href);
    
    for (let i = 0; i < bgScrapeKeys.length; i++) {
      let bgScrapeKey = bgScrapeKeys[i];
      if (URLPARSE.parsedUrlMatchesBgScrapeKey(bgScrapeKey, currentParsedUrl) == true) {
        return true;
      }
    }

    return false;
  }
    
};