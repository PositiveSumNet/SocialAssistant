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
  FIXED_SETTINGS_PREFIX: 'fixedSettings-',

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

    getLastParsedUrl: async function() {
      const setting = await chrome.storage.local.get(SETTINGS.RECORDING.LAST_PARSED_URL);
      if (setting) {
        const json = setting[SETTINGS.RECORDING.LAST_PARSED_URL];
        var parsedUrl = json && json.length > 0 ? JSON.parse(json) : undefined;
        return parsedUrl;
      }
      else {
        return undefined;
      }
    },

    setLastParsedUrl: function(parsedUrl) {
      if (parsedUrl && parsedUrl.pageType) {
        chrome.storage.local.set({ [SETTINGS.RECORDING.LAST_PARSED_URL]: JSON.stringify(parsedUrl) });
      }
    },

    getAutoViaNitter: function(context) {
      if (!context || !context.auto || !context.auto.site) {
        return undefined;
      }
      else {
        return context.auto.site == SITE.NITTER;
      }
    },

    getAutoParsedUrl: function(context) {
      context = context || SETTINGS.RECORDING.getContext();
      if (!context.auto) { return undefined; }

      // we want to make sure of 'with replies', since the other one doesn't go back all the way in time.
      let withReplies = false;
      switch (context.auto.pageType) {
        case PAGETYPE.TWITTER.TWEETS:
        case PAGETYPE.NITTER.TWEETS:
          withReplies = true;
          break;
        default:
          break;
      }

      return {
        pageType: context.auto.pageType,
        site: context.auto.site,
        owner: STR.stripPrefix(context.auto.owner, '@'),
        withReplies: withReplies
      };
    },

    getAutoRecordsTweets: function(context) {
      return (context && context.auto && context.auto.recordsTweets == true);
    },

    getRecordsTweetImages: function(context) {
      return (context && context.recordsTweetImages != false);
    },

    getAutoRecordResolvesThreads: function(context) {
      return (context && context.auto && context.auto.resolvesThreads != false);
    },

    getManualRecordsFollows: function(context) {
      return (context && context.manual && context.manual.recordsFollows == true);
    },

    getManualRecordsTweets: function(context) {
      return (context && context.manual && context.manual.recordsTweets == true);
    },

    getManualSecondsRemaining: async function() {
      const context = await SETTINGS.RECORDING.getContext();
      if (context.state != SETTINGS.RECORDING.STATE.MANUAL || !context.manual || !context.manual.timeoutAt) {
        return 0;
      }
      else if (Date.now() > context.manual.timeoutAt) {
        return 0;
      }
      else {
        return (context.manual.timeoutAt - Date.now())/1000;  // milliseconds to seconds
      }
    },

    saveContext: async function(context) {
      await chrome.storage.local.set({[SETTINGS.RECORDING.CONTEXT]: JSON.stringify(context)});
    },

    isTimeExpiredManualContext: function(context) {
      if (context.state == SETTINGS.RECORDING.STATE.MANUAL && context.manual && !context.manual.timeoutAt) {
        return true;
      }
      
      if (context.state == SETTINGS.RECORDING.STATE.MANUAL && context.manual && context.manual.timeoutAt && Date.now() > context.manual.timeoutAt) {
        return true;
      }

      return false;
    },

    getContext: async function(contextJson) {
      if (!contextJson || contextJson.length == 0) {
        const contextJsonNode = await chrome.storage.local.get([SETTINGS.RECORDING.CONTEXT]);
        contextJson = contextJsonNode[SETTINGS.RECORDING.CONTEXT];
      }

      let context = (contextJson && contextJson.length > 0) ? JSON.parse(contextJson) : undefined;
      const emptyOff = { state: SETTINGS.RECORDING.STATE.OFF };

      if (!context || !context.state) {
        return emptyOff;
      }
      
      if (context.state == SETTINGS.RECORDING.STATE.MANUAL && context.manual && !context.manual.timeoutAt) {
        context.state = SETTINGS.RECORDING.STATE.OFF;
      }
      
      if (context.state == SETTINGS.RECORDING.STATE.MANUAL && context.manual && context.manual.timeoutAt && Date.now() > context.manual.timeoutAt) {
        context.state = SETTINGS.RECORDING.STATE.OFF;
      }
      
      return context;
    }
  },

  NITTER: {
    SPEED_TEST: {
      CACHE_KEY: 'nitterSpeedTest',
      START: 'start',
      END: 'end',
      WINNER: 'winner',
      URL_SUFFIX: '/search?f=users&q=jack'
    },
  
    // repeated at background.js (not ready for background to be a 'module', so not DRY yet)
    getNitterDomain: async function() {
      // see if a speed-test has happened
      const speedTestSetting = await chrome.storage.local.get([SETTINGS.NITTER.SPEED_TEST.CACHE_KEY]);
      const defaultDomain = SETTINGS.NITTER.getNitterDomain()[0];

      if (!speedTestSetting || speedTestSetting.length == 0) { 
        // surprising, since we run speed test
        console.log('Defaulting nitter');
        return defaultDomain; 
      }
      
      const speedTest = JSON.parse(speedTestSetting[SETTINGS.NITTER.SPEED_TEST.CACHE_KEY]);
      if (!speedTest || !speedTest[SETTINGS.NITTER.SPEED_TEST.WINNER]) {
        // surprising, since we run speed test
        console.log('Default for nitter');
        return defaultDomain;
      }

      return speedTest[SETTINGS.NITTER.SPEED_TEST.WINNER];
    },

    isNitterDomain: function(domain) {
      const valids = SETTINGS.NITTER.getNitterDomains();
      for (let i = 0; i < valids.length; i++) {
        let valid = valids[i];
        if (STR.sameText(valid, domain) == true) {
          return true;
        }
      }

      return false;
    },

    // selected a few EU domains from github.com/zedeus/nitter/wiki/Instances
    // If this list is extended, also update manifest and background.js
    getNitterDomains: function() {
      return [
        'nitter.net',
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
    if (!site || site.length == 0) {
      site = SETTINGS.getCachedSite();
    }
    // backward compatibility
    return localStorage.getItem(SETTINGS.pageTypeCacheKey(site)) || 
            (site === SITE.TWITTER ? localStorage.getItem(SETTINGS.pageTypeCacheKey()) : '');
  },

  getCachedSite: function() {
    let site = localStorage.getItem(SETTINGS.PAGE_CONTEXT.SITE);
    if (site && site.length > 0) {
      switch (site) {
        case SITE.NITTER:
        case SITE.TWITTER:
          return site;
        default:
          return SITE.TWITTER;
      }
    }
    else {
      return SITE.TWITTER;
    }
  },

  cacheSite: function(site) {
    if (site && site.length > 0) {
      localStorage.setItem(SETTINGS.PAGE_CONTEXT.SITE, site);
    }
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