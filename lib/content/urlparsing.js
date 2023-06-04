var URLPARSE = {

  getParsedUrl: function() {
    return URLPARSE.parseUrl(window.location.href);
  },

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
      case PAGETYPE.NITTER.TWEETS:
      case PAGETYPE.NITTER.PROFILE:
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
        case 'explore':
        case 'notifications':
        case 'messages':
        case 'about':
        case 'settings':
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

    return {
      pageType: pageType,
      site: site,
      owner: owner,
      withReplies: withReplies
    };
  }
};