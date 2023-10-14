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

  SYNCFLOW: {

    // so that we offer a chance to retry after e.g. a connectivity error
    AUTO_PAUSE_SECONDS_POST_ERROR: 15,
    
    CONFIG: {
      SETTING_NAME: 'syncConfiguration',
      WITH_FAVORITES: 'withFavorites',
      WITH_PROFILES: 'withProfiles',
      WITH_AVATARS: 'withAvatars',
      WITH_NETWORKS: 'withNetworks',
      WITH_TOPICS: 'withTopics',
      WITH_POSTS: 'withPosts',
      WITH_POST_IMAGES: 'withPostImages',
      DO_TWITTER: 'doTwitter',
      DO_MASTODON: 'doMastodon',
      AUTHOR_FILTER: 'authorFilter',
      POSTED_FROM: 'postedFrom',
      POSTED_UNTIL: 'postedUntil'
    },
    
    getConfig: function(direction) {
      switch (direction) {
        case SYNCFLOW.DIRECTION.BACKUP:
          return SETTINGS.SYNCFLOW.BACKUP.getExportConfig();
        case SYNCFLOW.DIRECTION.RESTORE:
          throw('TODO - restore config');
        default:
          throw('unexpected sync config direction');
      }
    },

    BACKUP: {
      SHOULD_RUN: 'backupShouldRun',
      LAST_STEP_TYPE: 'backupLastType',
      LAST_NETWORK: 'backupLastNetwork',
      MARKER: 'backupMarker',
      COMPLETED_STEP_OK: 'backupCompletedStepOk',
      COMPLETED_RUN_OK: 'backupCompletedRunOk',
      STUCK_LAST_ERROR_MSG: 'backupStuckLastErrorMsg',
      STUCK_LAST_ERROR_WHEN: 'backupStuckLastErrorWhen',

      saveExportConfig: function(config) {
        const json = JSON.stringify(config);
        localStorage.setItem(SETTINGS.SYNCFLOW.CONFIG.SETTING_NAME, json);
      },

      getExportConfig: function() {
        let config = {};
        const configJson = localStorage.getItem(SETTINGS.SYNCFLOW.CONFIG.SETTING_NAME);
        if (STR.hasLen(configJson)) {
          config = JSON.parse(configJson);
        }
        else {
          // defaults
          const ns = SETTINGS.SYNCFLOW.CONFIG;
          config[ns.WITH_FAVORITES] = true;
          config[ns.WITH_PROFILES] = true;
          config[ns.WITH_AVATARS] = true;
          config[ns.WITH_NETWORKS] = true;
          config[ns.WITH_TOPICS] = true;
          config[ns.WITH_POSTS] = true;
          config[ns.WITH_POST_IMAGES] = true;
          config[ns.DO_TWITTER] = true;
          config[ns.DO_MASTODON] = true;
        }

        return config;
      }
    },
    
    RESTORE: {
      SHOULD_RUN: 'restoreShouldRun',
      LAST_STEP_TYPE: 'restoreLastType',
      LAST_NETWORK: 'restoreLastNetwork',
      MARKER: 'restoreMarker',
      COMPLETED_STEP_OK: 'backupCompletedStepOk',
      COMPLETED_RUN_OK: 'backupCompletedRunOk',
      STUCK_LAST_ERROR_MSG: 'restoreStuckLastErrorMsg',
      STUCK_LAST_ERROR_WHEN: 'restoreStuckLastErrorWhen',
    },
    
    // context for this is index.js so simple localStorage is fine
    getShouldRun: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.SHOULD_RUN : SETTINGS.SYNCFLOW.RESTORE.SHOULD_RUN;
      return STR.isTruthy(localStorage.getItem(settingName));
    },

    setShouldRun: function(direction, should) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.SHOULD_RUN : SETTINGS.SYNCFLOW.RESTORE.SHOULD_RUN;
      localStorage.setItem(settingName, should);
    },

    getLastStepType: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_STEP_TYPE : SETTINGS.SYNCFLOW.RESTORE.LAST_STEP_TYPE;
      return localStorage.getItem(settingName);
    },

    setLastStepType: function(direction, stepType) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_STEP_TYPE : SETTINGS.SYNCFLOW.RESTORE.LAST_STEP_TYPE;
      localStorage.setItem(settingName, stepType);
    },

    getLastNetwork: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_NETWORK : SETTINGS.SYNCFLOW.RESTORE.LAST_NETWORK;
      return localStorage.getItem(settingName);
    },

    setLastNetwork: function(direction, network) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_NETWORK : SETTINGS.SYNCFLOW.RESTORE.LAST_NETWORK;
      localStorage.setItem(settingName, network);
    },

    getMarker: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.MARKER : SETTINGS.SYNCFLOW.RESTORE.MARKER;
      return localStorage.getItem(settingName);
    },

    setMarker: function(direction, marker) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.MARKER : SETTINGS.SYNCFLOW.RESTORE.MARKER;
      localStorage.setItem(settingName, marker || '');
    },

    getCompletedStepOk: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_STEP_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_STEP_OK;
      const dt = localStorage.getItem(settingName);
      if (!parseInt(dt)) { return null; }
      return new Date(parseInt(dt));
    },

    setCompletedStepOk: function(direction) {
      const completedOkSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_STEP_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_STEP_OK;
      const lastErrorWhenSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_WHEN : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_WHEN;
      const lastErrorMsgSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_MSG : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_MSG;

      localStorage.setItem(completedOkSetting, Date.now());
      localStorage.removeItem(lastErrorWhenSetting);
      localStorage.removeItem(lastErrorMsgSetting);
    },

    getCompletedRunOk: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_RUN_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_RUN_OK;
      const dt = localStorage.getItem(settingName);
      if (!parseInt(dt)) { return null; }
      return new Date(parseInt(dt));
    },

    setCompletedRunOk: function(direction) {
      const completedOkSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_RUN_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_RUN_OK;
      const lastErrorWhenSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_WHEN : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_WHEN;
      const lastErrorMsgSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_MSG : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_MSG;

      localStorage.setItem(completedOkSetting, Date.now());
      localStorage.removeItem(lastErrorWhenSetting);
      localStorage.removeItem(lastErrorMsgSetting);
    },

    getStuckLastErrorMsg: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_MSG : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_MSG;
      return localStorage.getItem(settingName);
    },

    getStuckLastErrorWhen: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_WHEN : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_WHEN;
      const dt = localStorage.getItem(settingName);
      if (!parseInt(dt)) { return null; }
      return new Date(parseInt(dt));
    },

    getSecondsToPauseAfterRecentError: function(direction, secondsDeemedRecent) {
      const when = SETTINGS.SYNCFLOW.getStuckLastErrorWhen(direction);
      if (!when || !secondsDeemedRecent) { return 0; }
      const secondsSinceLastError = (Date.now() - when) / 1000;
      if (secondsSinceLastError > secondsDeemedRecent) {
        return 0;
      }

      return parseInt(secondsDeemedRecent - secondsSinceLastError);
    },

    setStuckLastError: function(direction, msg) {
      const completedStepOkSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_STEP_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_STEP_OK;
      const completedRunOkSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_RUN_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_RUN_OK;
      const lastErrorWhenSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_WHEN : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_WHEN;
      const lastErrorMsgSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_MSG : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_MSG;

      localStorage.setItem(lastErrorWhenSetting, Date.now());
      localStorage.setItem(lastErrorMsgSetting, msg);
      localStorage.removeItem(completedStepOkSetting);
      localStorage.removeItem(completedRunOkSetting);
    },

    resetLastOkLastErr: function(direction) {
      const completedStepOkSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_STEP_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_STEP_OK;
      const completedRunOkSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.COMPLETED_RUN_OK : SETTINGS.SYNCFLOW.RESTORE.COMPLETED_RUN_OK;
      const lastErrorWhenSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_WHEN : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_WHEN;
      const lastErrorMsgSetting = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.STUCK_LAST_ERROR_MSG : SETTINGS.SYNCFLOW.RESTORE.STUCK_LAST_ERROR_MSG;

      localStorage.removeItem(lastErrorWhenSetting);
      localStorage.removeItem(lastErrorMsgSetting);
      localStorage.removeItem(completedStepOkSetting);
      localStorage.removeItem(completedRunOkSetting);
    }
  },

  GITHUB: {
    USERNAME: 'githubUserName',
    USER_AVATAR_URL: 'githubUserAvatarUrl',
    SYNC_REPO: 'githubSyncRepo',
    SYNC_REPO_PUBLIC: 'githubSyncRepoPublic',
    SYNC_TOKEN: 'githubSyncToken',
    SYNC_CONN_LAST_OK: 'githubSyncConnLastOk',

    saveSyncToken: async function(token) {
      await chrome.storage.local.set({ [SETTINGS.GITHUB.SYNC_TOKEN]: token });
    },

    getSyncToken: async function() {
      return await SETTINGS.getStorageValue(SETTINGS.GITHUB.SYNC_TOKEN);
    },

    hasSyncToken: async function() {
      const token = await SETTINGS.GITHUB.getSyncToken();
      return STR.hasLen(token);
    },

    removeSyncToken: async function() {
      const key = SETTINGS.GITHUB.SYNC_TOKEN;
      await chrome.storage.local.remove(key);
    },

    getUserName: async function() {
      return await SETTINGS.getStorageValue(SETTINGS.GITHUB.USERNAME);
    },

    saveUserName: async function(username) {
      await chrome.storage.local.set({ [SETTINGS.GITHUB.USERNAME]: username });
    },

    removeSyncUserName: async function() {
      const key = SETTINGS.GITHUB.USERNAME;
      await chrome.storage.local.remove(key);
    },

    getSyncRepoIsPublic: async function() {
      const result = await SETTINGS.getStorageValue(SETTINGS.GITHUB.SYNC_REPO_PUBLIC);
      return STR.isTruthy(result);
    },

    saveSyncRepoIsPublic: async function(isPublic) {
      const value = STR.isTruthy(isPublic);
      await chrome.storage.local.set({ [SETTINGS.GITHUB.SYNC_REPO_PUBLIC]: value });
    },

    removeSyncRepoIsPublic: async function() {
      const key = SETTINGS.GITHUB.SYNC_REPO_PUBLIC;
      await chrome.storage.local.remove(key);
    },

    getAvatarUrl: async function() {
      return await SETTINGS.getStorageValue(SETTINGS.GITHUB.USER_AVATAR_URL);
    },

    saveAvatarUrl: async function(avatarUrl) {
      await chrome.storage.local.set({ [SETTINGS.GITHUB.USER_AVATAR_URL]: avatarUrl });
    },

    removeAvatarUrl: async function() {
      const key = SETTINGS.GITHUB.USER_AVATAR_URL;
      await chrome.storage.local.remove(key);
    },

    getSyncConnLastOk: async function() {
      return await SETTINGS.getStorageValue(SETTINGS.GITHUB.SYNC_CONN_LAST_OK);
    },

    saveSyncConnLastOkNow: async function() {
      await chrome.storage.local.set({ [SETTINGS.GITHUB.SYNC_CONN_LAST_OK]: Date.now() });
    },

    recordSyncConnFail: async function() {
      await SETTINGS.GITHUB.removeSyncLastOk();
    },

    removeSyncLastOk: async function() {
      const key = SETTINGS.GITHUB.SYNC_CONN_LAST_OK;
      await chrome.storage.local.remove(key);
    },

    getSyncRepoName: async function() {
      let repo = await SETTINGS.getStorageValue(SETTINGS.GITHUB.SYNC_REPO);
      if (!STR.hasLen(repo)) {
        repo = GITHUB.DEFAULT_SYNC_REPO_NAME;
      }

      return repo;
    },

    saveSyncRepoName: async function(name) {
      await chrome.storage.local.set({ [SETTINGS.GITHUB.SYNC_REPO]: name });
    },

    removeSyncRepoName: async function() {
      const key = SETTINGS.GITHUB.SYNC_REPO;
      await chrome.storage.local.remove(key);
    }
  },

  RECORDING: {
    CONTEXT: 'recordingContext',
    LAST_PARSED_URL: 'lastParsedUrl',
    DEFAULT_MANUAL_SECONDS: 600,
    BOOST_MANUAL_SECONDS: 300,
    AUTHOR_FILTER: 'authorFilter',
    STATE: {
      OFF: 'notRecording',
      MANUAL: 'manuallyRecording',
      AUTO_SCROLL: 'autoScrollRecording'
    },

    getAuthorFilter: function() {
      return localStorage.getItem(SETTINGS.RECORDING.AUTHOR_FILTER) || '';
    },

    setAuthorFilter: function(author) {
      if (STR.hasLen) {
        author = STR.stripPrefix(author, '@');
        localStorage.setItem(SETTINGS.RECORDING.AUTHOR_FILTER, author);
      }
      else {
        localStorage.removeItem(SETTINGS.RECORDING.AUTHOR_FILTER);
      }
    },

    VIDEO_EXTRACTION: {
      getEmbeddedVideoUrlKeys: async function(take, skip, owner) {
        return await SETTINGS.RECORDING.getPrefixedCacheValues(STORAGE_PREFIX.EMBEDDED_VIDEO_URLKEY, take, skip, owner);
      },

      isUrlKeyMarkedForRecording: async function(urlKey) {
        if (!STR.hasLen(urlKey)) { return false; }
        const cacheKey = SETTINGS.RECORDING.EMBEDDED_VIDEO_URLKEY.getVideoUrlCacheKey(urlKey);
        const result = await SETTINGS.getStorageValue(cacheKey);
        return STR.hasLen(result);
      },

      getVideoUrlCacheKey: function(urlKey) {
        return `${STORAGE_PREFIX.EMBEDDED_VIDEO_URLKEY}${urlKey}`;
      },
  
      saveVideoUrlKey: async function(urlKey) {
        if (urlKey) {
          const key = `${STORAGE_PREFIX.EMBEDDED_VIDEO_URLKEY}${urlKey}`;
          await chrome.storage.local.set({ [key]: urlKey });
        }
      },
  
      removeVideoUrlKey: async function(urlKey) {
        if (urlKey) {
          const key = `${STORAGE_PREFIX.EMBEDDED_VIDEO_URLKEY}${urlKey}`;
          // if already not there, it's harmless to call again
          await chrome.storage.local.remove(key);
        }
      },

      getPreferredVideoRes: function() {
        return localStorage.getItem('videores') || VIDEO_RES.HIGH;
      },
  
      setPreferredVideoRes: function(res) {
        localStorage.setItem('videores', res);
      }  
    },

    THREAD_EXPANSION: {
      getExpandThreadUrlKeys: async function(take, skip, owner) {
        return await SETTINGS.RECORDING.getPrefixedCacheValues(STORAGE_PREFIX.THREAD_EXPANSION_URLKEY, take, skip, owner);
      },
  
      isUrlKeyMarkedForRecording: async function(urlKey) {
        if (!STR.hasLen(urlKey)) { return false; }
        const cacheKey = SETTINGS.RECORDING.THREAD_EXPANSION.getThreadExpansionCacheKey(urlKey);
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
      }
    },

    getPrefixedCacheValues: async function(prefix, take, skip, owner) {
      const all = await chrome.storage.local.get();
      const entries = Object.entries(all);
      const matches = [];
      let hitCtr = 0;
    
      for (const [key, val] of entries) {
        if (key.startsWith(prefix)) {
          if (skip && skip > 0 && hitCtr < skip) {
            // skip it
          }
          else if (STR.hasLen(val)) {
            if (!STR.hasLen(owner) || val.toLowerCase().startsWith(`/${owner}/status`.toLowerCase())) {
              matches.push(val);
            }
          }
    
          if (take && take > 0 && matches.length >= take) {
            break;
          }
    
          hitCtr++;
        }
      }
    
      return matches;
    },

    getNavxPreferredDomain: function() {
      return localStorage.getItem('xthreadsite') || 'x.com';
    },

    setNavxPreferredDomain: function(domain) {
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
        case SITE.GITHUB:
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