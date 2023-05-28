var SETTINGS = {
  
  // setting names
  AGREED_TO_TERMS: 'agreedToTerms',
  ASKED: {
    MDON_SERVER: 'askedMdonServer',
    MDON_EXPLAINED_OAUTH: 'explainedMdonOauth'
  },
  MDON_SERVER: 'mdonServer',
  NITTER_SERVER: 'nitterServer',
  PAGING: {
    PAGE_SIZE: 'pageSize'
  },
  PAGE_CONTEXT: {
    NETWORK_OWNER: 'networkOwner',
    PAGE_TYPE: 'pageType',
    SITE: 'site'
  },
  DOWNLOADED_OK: {
    MASTODON: 'downloadedMdonOk'
  },
  POWER_USER_MODE: 'powerUserMode',
  SCORES: {
    PROFILE_FETCH_SCORE_CUTOFF: 'minScoreProfileFetch',
    DEFAULT_CUTOFF: 10
  },

  RECORDING: {
    CONTEXT: 'recordingContext',
    LAST_PARSED_URL: 'lastParsedUrl',
    DEFAULT_MANUAL_SECONDS: 600,
    BOOST_MANUAL_SECONDS: 300,
    STATE: {
      OFF: 'notRecording',
      MANUAL: 'manuallyRecording',
      AUTO_SCROLL: 'autoScrollRecording'
    },

    getLastParsedUrl() {
      const json = localStorage.getItem(SETTINGS.RECORDING.LAST_PARSED_URL);
      return json && json.length > 0 ? JSON.parse(json) : undefined;
    },

    setLastParsedUrl(parsedUrl) {
      return localStorage.setItem(SETTINGS.RECORDING.LAST_PARSED_URL, JSON.stringify(parsedUrl));
    },

    getAutoViaNitter: function(context) {
      if (!context || !context.auto || !context.auto.site) {
        return undefined;
      }
      else {
        return context.auto.site == SITE.NITTER;
      }
    },

    getAutoRecordPageType: function(context) {
      if (!context || !context.auto || context.auto.pageType) {
        return PAGETYPE.TWITTER.FOLLOWING;
      }
      else {
        return context.auto.pageType;
      }
    },

    getAutoRecordsTweets: function(context) {
      return (context && context.auto && context.auto.recordsTweets == true);
    },

    getAutoRecordsTweetImages: function(context) {
      return (context && context.auto && context.auto.recordsTweetImages == true);
    },

    getAutoRecordResolvesThreads: function(context) {
      return (context && context.auto && context.auto.resolvesThreads == true);
    },

    getManualRecordsFollows: function(context) {
      // default to true
      return (!context || !context.manual || context.manual.recordsFollows != false);
    },

    getManualRecordsTweets: function(context) {
      return (context && context.manual && context.manual.recordsTweets == true);
    },

    getManualRecordsTweetImages: function(context) {
      return (context && context.manual && context.manual.recordsTweetImages == true);
    },

    getManualSecondsRemaining: function(context) {
      context = context ?? SETTINGS.RECORDING.getContext();
      if (context.state != SETTINGS.RECORDING.STATE.MANUAL || !context.manual || !context.manual.timeoutAt) {
        return 0;
      }
      else if (context.manualTimeoutAt > Date.now()) {
        return 0;
      }
      else {
        return Date.now() - context.manual.timeoutAt;
      }
    },  

    saveContext: function(context) {
      localStorage.setItem(SETTINGS.RECORDING.CONTEXT, JSON.stringify(context));
    },

    getContext: function() {
      const contextJson = localStorage.getItem(SETTINGS.RECORDING.CONTEXT);
      let context = contextJson && contextJson.length > 0 ? JSON.parse(contextJson) : undefined;
      const emptyOff = { state: SETTINGS.RECORDING.STATE.OFF };

      if (!context || !context.state || context.state == SETTINGS.RECORDING.STATE.OFF) {
        return emptyOff;
      }
      else if (context.state == SETTINGS.RECORDING.STATE.MANUAL) {
        // see if expired
        const remaining = SETTINGS.RECORDING.getManualSecondsRemaining(context);
        return (remaining > 0) ? context : emptyOff;
      }
      else {
        return context;
      }
    }
  },

  NITTER: {

    getNitterUrl: function() {
      return `https://${SETTINGS.NITTER.getNitterDomain()}`;
    },
  
    getNitterDomain: function() {
      let domain = localStorage.getItem(SETTINGS.NITTER_SERVER);
  
      if (domain && SETTINGS.NITTER.isValidNitterDomain(domain)) {
        return domain;
      }
      else {
        return SETTINGS.NITTER.getNitterDomains()[0];
      }
    },
  
    setNitterDomain: function(domain) {
      if (SETTINGS.NITTER.isValidNitterDomain(domain)) {
        localStorage.setItem(SETTINGS.NITTER_SERVER, domain);
      }
    },
  
    isValidNitterPage: function(url) {
      if (!url) { return false; }
      const strippedUrl = STR.stripHttpWwwPrefix(url).toLowerCase();
      const valids = SETTINGS.NITTER.getNitterDomains();
      for (let i = 0; i < valids.length; i++) {
        let valid = valids[i];
        if (strippedUrl.startsWith(valid.toLowerCase())) {
          return true;
        }
      }

      return false;
    },

    isValidNitterDomain: function(domain) {
      const valids = SETTINGS.NITTER.getNitterDomains();
      const found = valids.find(function(x) { return STR.sameText(x, domain); });
      return found && found.length > 0;
    },
  
    // selected a few EU domains from github.com/zedeus/nitter/wiki/Instances
    // If this list is extended, also update manifest and background.js
    getNitterDomains: function() {
      return [
        'nitter.net',
        'nitter.nl',
        'nitter.at',
        'nitter.it',
        'nitter.one'
      ];
    }
  },

  BG_SCRAPE: {
    SCRAPE_URL: 'bgScrapeUrl'
  },

  // aids the power-user feature of importing scored handles for automated profile scraping
  getMinProfileFetchScore: function() {
    const val = localStorage.getItem(SETTINGS.SCORES.PROFILE_FETCH_SCORE_CUTOFF);
    if (val && val.length > 0) {
      return parseInt(val);
    }
    else {
      return SETTINGS.SCORES.DEFAULT_CUTOFF;
    }
  },

  getPowerUserMode: function() {
    return localStorage.getItem(SETTINGS.POWER_USER_MODE);
  },

  setPowerUserMode: function(activatePowerUserMode) {
    return localStorage.setItem(SETTINGS.POWER_USER_MODE, activatePowerUserMode);
  },

  getMdonServer: function() {
    return localStorage.getItem(SETTINGS.MDON_SERVER);
  },
  
  getAskedMdonServer: function() {
    return localStorage.getItem(SETTINGS.ASKED.MDON_SERVER);
  },
  
  getExplainedMdonOauth: function() {
    return localStorage.getItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH);
  },
  
  setExplainedMdonOauth: function() {
    localStorage.setItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH, true);
  },
  
  clearExplainedMdonOauth: function() {
    localStorage.removeItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH);
  },
  
  hadSuccessfulMdonDownload: function() {
    return localStorage.getItem(SETTINGS.DOWNLOADED_OK.MASTODON);
  },

  markMdonDownloadSuccess: function() {
    localStorage.setItem(SETTINGS.DOWNLOADED_OK.MASTODON, true);
  },

  getPageSize: function() {
    let size = parseInt(localStorage.getItem(SETTINGS.PAGING.PAGE_SIZE));
    if (isNaN(size)) { size = 50 };
    return size;
  },

  ownerCacheKey: function(site) {
    if (site) {
      return `${SETTINGS.PAGE_CONTEXT.NETWORK_OWNER}-${site}`;
    }
    else {
      // legacy (before we cached it per-site)
      return SETTINGS.PAGE_CONTEXT.NETWORK_OWNER;
    }
  },

  pageTypeCacheKey: function(site) {
    if (site) {
      return `${SETTINGS.PAGE_CONTEXT.PAGE_TYPE}-${site}`;
    }
    else {
      // legacy (before we cached it per-site)
      return SETTINGS.PAGE_CONTEXT.PAGE_TYPE;
    }
  },

  getCachedOwner: function() {
    const site = SETTINGS.getCachedSite();
    // backward compatibility
    return localStorage.getItem(SETTINGS.ownerCacheKey(site)) || 
      (site === SITE.TWITTER ? localStorage.getItem(SETTINGS.ownerCacheKey()) : '');
  },

  getCachedPageType: function(site) {
    if (!site) {
      site = SETTINGS.getCachedSite();
    }
    // backward compatibility
    return localStorage.getItem(SETTINGS.pageTypeCacheKey(site)) || 
            (site === SITE.TWITTER ? localStorage.getItem(SETTINGS.pageTypeCacheKey()) : '');
  },

  getCachedSite: function() {
    return localStorage.getItem(SETTINGS.PAGE_CONTEXT.SITE) || SITE.TWITTER;
  },

  cacheSite: function(site) {
    localStorage.setItem(SETTINGS.PAGE_CONTEXT.SITE, site);
  },

  cacheOwner: function(site, owner) {
    const cacheKey = SETTINGS.ownerCacheKey(site);
    localStorage.setItem(cacheKey, owner);
  },

  cachePageState: function(msg) {
    if (!msg) { return; }
    
    if (msg.site) {
      SETTINGS.cacheSite(msg.site);
    }
    
    if (msg.networkOwner) {
      const cacheKey = SETTINGS.ownerCacheKey(msg.site);
      localStorage.setItem(cacheKey, msg.networkOwner);
    }
    
    if (msg.pageType) {
      const cacheKey = SETTINGS.pageTypeCacheKey(msg.site);
      localStorage.setItem(cacheKey, msg.pageType);
    }
  },

  isFollowRequestCacheKey: function(key, site) {
    return key && key.startsWith(`requestedFollow-${site}-`);
  },

  getFollowRequestedCacheKey: function(site, handle) {
    return `requestedFollow-${site}-${handle.toLowerCase()}`;
  },
  
  getPendingFollowAppearsAccepted: function(site, handle) {
    const cacheKey = SETTINGS.getFollowRequestedCacheKey(site, handle);
    const cacheValue = localStorage.getItem(cacheKey);
    if (cacheValue) {
      return cacheValue.toString() == "true";
    }
    else {
      return undefined;
    }
  },

  cacheFollowRequestMade: function(site, handle, appearsAccepted) {
    if (!site || !handle) { return; }
    const cacheKey = SETTINGS.getFollowRequestedCacheKey(site, handle);
    // set a boolean value for whether the follow request appears accepted
    localStorage.setItem(cacheKey, appearsAccepted);
  },

  clearFollowRequestedsCache: function(site) {
    console.log('Clearing requestedFollow cache');
    const keysToClear = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      let key = localStorage.key(i);
      if (SETTINGS.isFollowRequestCacheKey(key, site)) {
        keysToClear.push(key);
      }
    }

    for (let i = 0; i < keysToClear.length; i++) {
      localStorage.removeItem(keysToClear[i]);
    }
  }
  
};