var URLPARSE = {

  getQueryParms: function() {
    const rawParams = new URLSearchParams(location.search);
    const parms = {};
    for (const [key, value] of rawParams) {
      parms[key] = value;
    }
    return parms;
  },
  
  getQueryParm: function(key) {
    const parms = URLPARSE.getQueryParms();
    return parms[key];
  },

  equivalentUrl: function(url1, url2) {
    if (!url1 || !url2 || url1.length == 0 || url2.length == 0) { return false; }
    const parsedUrl1 = URLPARSE.parseUrl(url1);
    const parsedUrl2 = URLPARSE.parseUrl(url2);
    return URLPARSE.equivalentParsedUrl(parsedUrl1, parsedUrl2);
  },

  equivalentParsedUrl: function(parsedUrl1, parsedUrl2, relaxedOwnerCheck) {
    if (!parsedUrl1 || !parsedUrl2) { return false; }
    const pageType1 = URLPARSE.finalizePageType(parsedUrl1.pageType);
    const pageType2 = URLPARSE.finalizePageType(parsedUrl2.pageType);
    const draft = (parsedUrl1.site == parsedUrl2.site && pageType1 == pageType2 && (relaxedOwnerCheck == true || STR.sameText(parsedUrl1.owner, parsedUrl2.owner)));
    
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
    let baseUrl = 'https://x.com';

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

  finalizePageType: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.HOME:
      case PAGETYPE.TWITTER.SEARCH:
        return PAGETYPE.TWITTER.TWEETS;
      default:
        return pageType;
    }
  },

  getActivePageOwner: function() {
    const parsedUrl = URLPARSE.parseUrl(document.location.href);
    if (!parsedUrl) { return null; }
    return parsedUrl.owner;
  },

  parseUrl: function(url) {
    let fullUrl = url;
    if (!url || url.length == 0) { return undefined; }

    let pageType;
    let site;
    let owner;
    let threadDetailId;
    let bookmarked;
    
    url = STR.stripUrlHashSuffix(url);
    url = STR.stripQueryString(url);
    url = STR.stripSuffix(url, '/');
    url = STR.stripHttpWwwPrefix(url);
    url = url.replace('mobile.', '');

    const parts = url.split('/');
    const domain = parts[0];
    if (STR.sameText(domain, 'twitter.com') == true || STR.sameText(domain, 'x.com') == true)  {
      site = SITE.TWITTER;
    }
    else if (SETTINGS.NITTER.isNitterDomain(domain)) {
      site = SITE.NITTER;
    }
    else {
      // for now we only know how to parse twitter and nitter urls
      return undefined;
    }

    let withReplies = false;
    if (parts.length == 1 && site == SITE.TWITTER) {
      return {
        pageType: PAGETYPE.TWITTER.HOME,
        site: site
      };
    }
    else if (parts.length == 2) {
      switch (parts[1].toLowerCase()) {
        case 'home':
          return {
            pageType: PAGETYPE.TWITTER.HOME,
            site: site
          };
        case 'search':
          const searchOwner = URLPARSE.getTwitterSearchPageHandle(fullUrl);
          return {
            pageType: PAGETYPE.TWITTER.SEARCH,
            site: site,
            owner: searchOwner
          };
        case 'explore':
        case 'notifications':
        case 'messages':
        case 'about':
        case 'settings':
          return null;
        default:
          // continue (presumably it's e.g. 'x.com/scafaria')
          pageType = PAGETYPE.TWITTER.TWEETS;
          owner = parts[1];
          withReplies = false;
          break;
      }
      
    }
    else if (parts.length == 3) {
      owner = parts[1];
      switch (parts[2].toLowerCase()) {
        case 'followers':
        case 'followers_you_follow':
        case 'verified_followers':
          pageType = PAGETYPE.TWITTER.FOLLOWERS;
          break;
        case 'following':
          pageType = PAGETYPE.TWITTER.FOLLOWING;
          break;
        case 'with_replies':
          pageType = PAGETYPE.TWITTER.TWEETS;
          withReplies = true;
          break;
        case 'bookmarks':
          bookmarked = true;
        case 'likes':
        case 'media':
          pageType = PAGETYPE.TWITTER.TWEETS;
          withReplies = false;
          break;
        default:
          // unknown  
          return undefined;
      }
    }
    else if (parts.length == 4 && STR.sameText(parts[2], 'status')) {
      // x.com/username/status/12345
      owner = parts[1];
      pageType = PAGETYPE.TWITTER.TWEETS;
      threadDetailId = parts[3];
    }
    else if (parts.length == 4 && STR.sameText(parts[2], 'lists')) {
      // x.com/i/lists/0000000000000000123
      owner = parts[1];
      pageType = PAGETYPE.TWITTER.TWEETS;
    }
    
    // special case happens with twitter bookmarks and one's own lists
    if (owner == 'i') {
      owner = ES6.SPECIAL.getTwitterHomePageOwnerHandle();
    }

    return {
      pageType: pageType,
      site: site,
      owner: owner,
      withReplies: withReplies,
      threadDetailId: threadDetailId,
      bookmarked: bookmarked
    };
  },

  // https://twitter.com/search?q=from%3A%40positivesumnet%20until%3A2023-03-01&src=typed_query&f=live
  getTwitterSearchPageHandle: function(url) {
    url = url || document.location.href;
    const splat = url.split('?');
    if (splat.length < 2) { return null; }
    const qParms = splat[1].split('&');
    const qParm = qParms.find(function(q) { return q.startsWith('q'); });
    const qSplat = qParm.split('=');
    if (qSplat.length < 2) { return null; }
    let qParmVal = qSplat[1];
    if (!STR.hasLen(qParmVal)) {
      return null;
    }
    else {
      qParmVal = qParmVal.replaceAll('%20', ' ').replaceAll('+', ' ').replaceAll('%40', '@').replaceAll('from:', '').replaceAll('from%3A', '');
      const parts = qParmVal.split(' ');
      const ownerPart = parts.find(function(p) { return p.startsWith('@'); });
      if (STR.hasLen(ownerPart)) {
        return STR.stripPrefix(ownerPart, '@');
      }
      else {
        return null;
      }
    }
  },
  
  // twitter doesn't always surface the urlKey of the quote tweet
  buildVirtualQuoteUrlKey: function(tweetUrlKey) {
    return `${tweetUrlKey}${QUOTED_SUFFIX}`;
  },

  isVirtualQuoteUrlKey: function(urlKey) {
    return urlKey && urlKey.endsWith(QUOTED_SUFFIX);
  }
    
};