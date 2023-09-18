var SETTINGS = {
  
  // setting names
  AGREED_TO_TERMS: 'agreedToTerms',
  REMOTE: {
    LAST_TOPICS_PULL_TRY: 'lastTopicsPullTry',
    LAST_TOPICS_PULL_SUCCESS: 'lastTopicsPullSuccess'
  },
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
  SCORES: {
    PROFILE_FETCH_SCORE_CUTOFF: 'minScoreProfileFetch',
    DEFAULT_CUTOFF: 10
  },
  FIXED_SETTINGS_PREFIX: 'fixedSettings-',
  SORT_BY_STARS: 'sortByStars',

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

    getExpandThreadUrlKeys: async function(take, skip) {
      const all = await chrome.storage.local.get();
      const entries = Object.entries(all);
      const threadUrlKeys = [];
      let hitCtr = 0;
    
      for (const [key, val] of entries) {
        if (key.startsWith(STORAGE_PREFIX.THREAD_EXPANSION_URLKEY)) {
          if (skip && skip > 0 && hitCtr < skip) {
            // skip it
          }
          else {
            threadUrlKeys.push(val);
          }
    
          if (take && take > 0 && threadUrlKeys.length >= take) {
            break;
          }
    
          hitCtr++;
        }
      }
    
      return threadUrlKeys;
    },

    isUrlKeyMarkedForRecording: async function(urlKey) {
      if (!STR.hasLen(urlKey)) { return false; }
      const cacheKey = SETTINGS.RECORDING.getThreadExpansionCacheKey(urlKey);
      const result = await SETTINGS.getStorageValue(cacheKey);
      return STR.hasLen(result);
    },

    getThreadExpansionCacheKey: function(threadUrlKey) {
      return `${STORAGE_PREFIX.THREAD_EXPANSION_URLKEY}${threadUrlKey}`;
    },

    saveThreadExpansionUrlKey: async function(threadUrlKey) {
      if (threadUrlKey) {
        const key = `${STORAGE_PREFIX.THREAD_EXPANSION_URLKEY}${threadUrlKey}`;
        await chrome.storage.local.set({ [key]: threadUrlKey });
      }
    },

    removeThreadExpansionUrlKey: async function(threadUrlKey) {
      if (threadUrlKey) {
        const key = `${STORAGE_PREFIX.THREAD_EXPANSION_URLKEY}${threadUrlKey}`;
        // if already not there, it's harmless to call again
        await chrome.storage.local.remove(key);
      }
    },

    getThreadExpansionPreferredDomain: function() {
      return localStorage.getItem('xthreadsite') || 'x.com';
    },

    setThreadExpansionPreferredDomain: function(domain) {
      localStorage.setItem('xthreadsite', domain);
    },

    getLastParsedUrl: async function() {
      return await SETTINGS.getStorageValue(SETTINGS.RECORDING.LAST_PARSED_URL);
    },

    setLastParsedUrl: function(parsedUrl) {
      if (parsedUrl && parsedUrl.pageType) {
        chrome.storage.local.set({ [SETTINGS.RECORDING.LAST_PARSED_URL]: parsedUrl });
      }
    },

    getAutoParsedUrl: function(context) {
      context = context || SETTINGS.RECORDING.getContext();
      if (!context.auto) { return undefined; }

      // we want to make sure of 'with replies', since the other one doesn't go back all the way in time.
      let withReplies = false;
      switch (context.auto.pageType) {
        case PAGETYPE.TWITTER.TWEETS:
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
      // default to true
      return (!context || context.recordsTweetImages != false);
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
      await chrome.storage.local.set({[SETTINGS.RECORDING.CONTEXT]: context});
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

    getContext: async function() {
      const emptyOff = { state: SETTINGS.RECORDING.STATE.OFF };
      let context = await SETTINGS.getStorageValue(SETTINGS.RECORDING.CONTEXT);

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
    // repeated at background.js (not ready for background to be a 'module', so not DRY yet)
    getNitterDomain: async function() {
      // TEMPORARY
      return 'nitter.net';
    },

    isNitterDomain: function(domain) {
      return domain.indexOf('nitter') > -1;
    }
  },

  getCacheKvps:  async function(keyPrefix, limit) {
    const all = await chrome.storage.local.get();
    const entries = Object.entries(all);
    const kvps = [];

    for (const [key, val] of entries) {
      if (key.startsWith(keyPrefix)) {
        kvps.push({key: key, val: val});
        if (limit && kvps.length >= limit) {
          break;
        }
      }
    }

    return kvps;
  },

  getStorageValue: async function(key) {
    const setting = await chrome.storage.local.get(key);
    if (!setting) { return null; }
    return setting[key];
  },

  getMinProfileFetchScore: function() {
    const val = localStorage.getItem(SETTINGS.SCORES.PROFILE_FETCH_SCORE_CUTOFF);
    if (val && val.length > 0) {
      return parseInt(val);
    }
    else {
      return SETTINGS.SCORES.DEFAULT_CUTOFF;
    }
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
    if (STR.hasLen(site)) {
      // this is just a safeguard to protect against a bad state (probably not needed)
      switch (site) {
        case SITE.NITTER:
        case SITE.TWITTER:
        case SITE.MASTODON:
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
  },

  // when saving Date.now() to the lastTry and lastSuccess settings
  shouldRetryNow: function(lastTrySettingName, lastSuccessSettingName, tryMsAgo, successMsAgo) {
    const lastTry = localStorage.getItem(lastTrySettingName);
    const lastSuccess = localStorage.getItem(lastSuccessSettingName);
    const lastTryMs = lastTry ? parseInt(lastTry) : null;
    const lastSuccessMs = lastSuccess ? parseInt(lastSuccess) : null;
    const lastTryMsAgo = (lastTryMs && !isNaN(lastTryMs)) ? (Date.now() - lastTryMs) : null;
    const lastSuccessMsAgo = (lastSuccessMs && !isNaN(lastSuccessMs)) ? (Date.now() - lastTryMs) : null;

    if (lastTryMs && lastTryMsAgo < tryMsAgo) {
      return false;
    }

    if (lastSuccessMsAgo && lastSuccessMsAgo < successMsAgo) {
      return false;
    }
    else {
      return true;
    }
  },

  getSortByStars: function() {
    const setting = localStorage.getItem(SETTINGS.SORT_BY_STARS);
    return STR.isTruthy(setting);
  },

  setSortByStars: function(boolVal) {
    if (STR.isTruthy(boolVal)) {
      localStorage.setItem(SETTINGS.SORT_BY_STARS, true);
    }
    else {
      localStorage.removeItem(SETTINGS.SORT_BY_STARS);
    }
  }
};