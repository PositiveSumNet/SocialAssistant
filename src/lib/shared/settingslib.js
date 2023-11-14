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

  // this wrapper is helpful because localStorage.setItem('foo', undefined) yields 'undefined' (as a string)
  localSet: function(key, value) {
    if (!STR.hasLen(value)) {
      localStorage.removeItem(key);
    }
    else {
      localStorage.setItem(key, value);
    }
  },

  TOPICS: {
    TOPICS: 'topics',
    HIDDEN_TOPIC_NAMES: 'hiddenTopicNames',
    HIDDEN_CONCAT_TOPIC_NAMES: 'hiddenConcatTopics',

    addTopic: function(topic) {
      let topics = SETTINGS.TOPICS.getLocalCacheTopics();
      topics.push(topic);
      topics = SETTINGS.TOPICS.dedupeTopics(topics);
      SETTINGS.TOPICS.saveTopicsToLocalCache(topics);
    },

    // knowing whether there are keyword "clues" helps us know whether "guess topics" will work
    hasKeywords: function(topicOrConcat) {
      if (!STR.hasLen(topicOrConcat)) { return false; }
      let topicName = topicOrConcat;
      let subtopicName = '';
      if (topicOrConcat.indexOf(TOPICS.TOPIC_SUBTOPIC_COLON) > -1) {
        const parts = topicOrConcat.split(TOPICS.TOPIC_SUBTOPIC_COLON);
        topicName = parts[0];
        subtopicName = parts[1];
      }

      const topics = SETTINGS.TOPICS.getLocalCacheTopics();
      const topic = topics.find(function(t) { return STR.sameText(t.Name, topicName); });
      if (!topic || !topic.Subtopics) { return false; }
      for (let i = 0; i < topic.Subtopics.length; i++) {
        let subtopic = topic.Subtopics[i];
        if (!STR.hasLen(subtopicName) || STR.sameText(subtopic.Name, subtopicName)) {
          // relevant subtopic
          if (subtopic.Keywords && subtopic.Keywords.length > 0) {
            return true;
          }
        }
      }

      return false;
    },

    saveTopicsToLocalCache: function(topics) {
      SETTINGS.localSet(SETTINGS.TOPICS.TOPICS, JSON.stringify(topics));
    },

    getLocalCacheTopics: function(includeHiddens) {
      const json = localStorage.getItem(SETTINGS.TOPICS.TOPICS);
      if (!STR.hasLen(json)) { return []; }
      let topics = JSON.parse(json);
      // alphabetize
      topics = ES6.sortBy(topics, 'Name');
      if (includeHiddens != true) {
        topics = SETTINGS.TOPICS.filterOutHiddens(topics);
      }
      topics = SETTINGS.TOPICS.dedupeTopics(topics);
      for (let i = 0; i < topics.length; i++) {
        let topic = topics[i];
        topic.Subtopics = ES6.sortBy(topic.Subtopics, 'Name');
      }
      return topics;
    },

    // can't just call distinctify because we also want to merge (sans dupes) the subtopics
    dedupeTopics: function(topics) {
      let keepers = [];
      let topicNames = new Set();
      for (let t = 0; t < topics.length; t++) {
        let topic = topics[t];
        if (!topicNames.has(topic.Name)) {
          keepers.push(topic);
          topicNames.add(topic.Name);
        }
        else {
          // merge subtopics
          let keeper = keepers.find(function(k) {
            return STR.sameText(k.Name, topic.Name);
          });
          let ksubNames = new Set(keeper.Subtopics.map(function(s) { return s.Name; }));
          for (let s = 0; s < topic.Subtopics.length; s++) {
            let subtopic = topic.Subtopics[s];
            if (!ksubNames.has(subtopic.Name)) {
              keeper.Subtopics.push(subtopic);
            }
            else {
              // merge words too
              let ksubtopic = keeper.Subtopics.find(function(ks) { return STR.sameText(ks.Name, subtopic.Name); });
              ksubtopic.Keywords.push(...subtopic.Keywords);
              ksubtopic.Keywords = ES6.distinctify(ksubtopic.Keywords);
            }
          }
        }
      }

      return keepers;
    },

    filterOutHiddens: function(topics) {
      const hiddenTopicNames = new Set(SETTINGS.TOPICS.getHiddenTopicNames());
      const hiddenConcatNames = new Set(SETTINGS.TOPICS.getHiddenConcatNames());

      let keepers = [];
      for (let i = 0; i < topics.length; i++) {
        let topic = topics[i];
        if (!hiddenTopicNames.has(topic.Name)) {
          let subKeepers = [];
          for (let j = 0; j < topic.Subtopics.length; j++) {
            let subtopic = topic.Subtopics[j];
            let concat = TOPICS.concatTopicFullName(topic.Name, subtopic.Name);
            if (!hiddenConcatNames.has(concat)) {
              subKeepers.push(subtopic);
            }
          }
          topic.Subtopics = subKeepers;
          keepers.push(topic);
        }
      }

      return keepers;
    },

    getHiddenTopicNames: function() {
      const json = localStorage.getItem(SETTINGS.TOPICS.HIDDEN_TOPIC_NAMES);
      if (!STR.hasLen(json)) { return []; }
      let hiddens = JSON.parse(json);
      return hiddens;
    },

    saveHiddenTopicName: function(topicName) {
      const hiddens = SETTINGS.TOPICS.getHiddenTopicNames();
      hiddens.push(topicName);
      SETTINGS.localSet(SETTINGS.TOPICS.HIDDEN_TOPIC_NAMES, JSON.stringify(hiddens));
    },

    unhideTopicName: function(topicName) {
      const currentHiddens = SETTINGS.TOPICS.getHiddenTopicNames();
      const keeperHiddens = [];
      for (let i = 0; i < currentHiddens.length; i++) {
        let currentHidden = currentHiddens[i];
        if (!STR.sameText(currentHidden, topicName)) {
          keeperHiddens.push(currentHidden);
        }
      }
      SETTINGS.TOPICS.saveHiddenTopicNames(keeperHiddens);
    },

    saveHiddenTopicNames: function(topicNames) {
      SETTINGS.localSet(SETTINGS.TOPICS.HIDDEN_TOPIC_NAMES, JSON.stringify(topicNames));
    },

    getHiddenConcatNames: function() {
      const json = localStorage.getItem(SETTINGS.TOPICS.HIDDEN_CONCAT_TOPIC_NAMES);
      if (!STR.hasLen(json)) { return []; }
      let hiddens = JSON.parse(json);
      return hiddens;
    },

    saveHiddenConcatName: function(concatName) {
      const hiddens = SETTINGS.TOPICS.getHiddenConcatNames();
      hiddens.push(concatName);
      SETTINGS.localSet(SETTINGS.TOPICS.HIDDEN_CONCAT_TOPIC_NAMES, JSON.stringify(hiddens));
    },

    unhideConcatName: function(concatName) {
      const currentHiddens = SETTINGS.TOPICS.getHiddenConcatNames();
      const keeperHiddens = [];
      for (let i = 0; i < currentHiddens.length; i++) {
        let currentHidden = currentHiddens[i];
        if (!STR.sameText(currentHidden, concatName)) {
          keeperHiddens.push(currentHidden);
        }
      }
      SETTINGS.TOPICS.saveHiddenConcatNames(keeperHiddens);
    },

    saveHiddenConcatNames: function(concatNames) {
      SETTINGS.localSet(SETTINGS.TOPICS.HIDDEN_CONCAT_TOPIC_NAMES, JSON.stringify(concatNames));
    }
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
  DEMAND_QUALITY_POSTS: 'demandQualityPosts',

  SYNCFLOW: {

    // so that we offer a chance to retry after e.g. a connectivity error
    AUTO_PAUSE_SECONDS_POST_ERROR: 15,
    
    CONFIG: {
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
      POSTED_UNTIL: 'postedUntil',
      OVERWRITE: 'overwrite',
    
      getConfig: function(direction) {
        switch (direction) {
          case SYNCFLOW.DIRECTION.BACKUP:
            return SETTINGS.SYNCFLOW.BACKUP.getExportConfig();
          case SYNCFLOW.DIRECTION.RESTORE:
            return SETTINGS.SYNCFLOW.RESTORE.getImportConfig();
          default:
            throw('unexpected sync config direction');
        }
      },
  
      getDefaultConfig: function() {
        const config = {};
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
        config[ns.OVERWRITE] = false;
        return config;
      }
    },

    BACKUP: {
      SETTING_NAME: 'backupConfiguration',
      SHOULD_RUN: 'backupShouldRun',
      LAST_STEP_TYPE: 'backupLastType',
      LAST_NETWORK: 'backupLastNetwork',
      MARKER: 'backupMarker',
      NOOP: 'backupNoop',
      COMPLETED_STEP_OK: 'backupCompletedStepOk',
      COMPLETED_RUN_OK: 'backupCompletedRunOk',
      STUCK_LAST_ERROR_MSG: 'backupStuckLastErrorMsg',
      STUCK_LAST_ERROR_WHEN: 'backupStuckLastErrorWhen',

      saveExportConfig: function(config) {
        const json = JSON.stringify(config);
        SETTINGS.localSet(SETTINGS.SYNCFLOW.BACKUP.SETTING_NAME, json);
      },

      getExportConfig: function() {
        const configJson = localStorage.getItem(SETTINGS.SYNCFLOW.BACKUP.SETTING_NAME);
        if (STR.hasLen(configJson)) {
          return JSON.parse(configJson);
        }
        else {
          return SETTINGS.SYNCFLOW.CONFIG.getDefaultConfig();
        }
      }
    },
    
    RESTORE: {
      SETTING_NAME: 'restoreConfiguration',
      SHOULD_RUN: 'restoreShouldRun',
      LAST_STEP_TYPE: 'restoreLastType',
      LAST_NETWORK: 'restoreLastNetwork',
      MARKER: 'restoreMarker',
      NOOP: 'restoreNoop',
      COMPLETED_STEP_OK: 'restoreCompletedStepOk',
      COMPLETED_RUN_OK: 'restoreCompletedRunOk',
      STUCK_LAST_ERROR_MSG: 'restoreStuckLastErrorMsg',
      STUCK_LAST_ERROR_WHEN: 'restoreStuckLastErrorWhen',

      saveImportConfig: function(config) {
        const json = JSON.stringify(config);
        SETTINGS.localSet(SETTINGS.SYNCFLOW.RESTORE.SETTING_NAME, json);
      },

      getImportConfig: function() {
        const configJson = localStorage.getItem(SETTINGS.SYNCFLOW.RESTORE.SETTING_NAME);
        if (STR.hasLen(configJson)) {
          return JSON.parse(configJson);
        }
        else {
          return SETTINGS.SYNCFLOW.CONFIG.getDefaultConfig();
        }
      }
    },
    
    // context for this is index.js so simple localStorage is fine
    getShouldRun: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.SHOULD_RUN : SETTINGS.SYNCFLOW.RESTORE.SHOULD_RUN;
      return STR.isTruthy(localStorage.getItem(settingName));
    },

    setShouldRun: function(direction, should) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.SHOULD_RUN : SETTINGS.SYNCFLOW.RESTORE.SHOULD_RUN;
      SETTINGS.localSet(settingName, should);
    },

    getLastStepType: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_STEP_TYPE : SETTINGS.SYNCFLOW.RESTORE.LAST_STEP_TYPE;
      return localStorage.getItem(settingName);
    },

    setLastStepType: function(direction, stepType) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_STEP_TYPE : SETTINGS.SYNCFLOW.RESTORE.LAST_STEP_TYPE;
      SETTINGS.localSet(settingName, stepType);
    },

    getLastNetwork: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_NETWORK : SETTINGS.SYNCFLOW.RESTORE.LAST_NETWORK;
      return localStorage.getItem(settingName);
    },

    setLastNetwork: function(direction, network) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.LAST_NETWORK : SETTINGS.SYNCFLOW.RESTORE.LAST_NETWORK;
      SETTINGS.localSet(settingName, network);
    },

    getMarker: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.MARKER : SETTINGS.SYNCFLOW.RESTORE.MARKER;
      let marker = localStorage.getItem(settingName);
      if (!STR.hasLen(marker)) {
        marker = FIRST_TEXT_START;
      }
      return marker;
    },

    setMarker: function(direction, marker) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.MARKER : SETTINGS.SYNCFLOW.RESTORE.MARKER;
      if (STR.hasLen(marker)) {
        SETTINGS.localSet(settingName, marker);
      }
      else {
        localStorage.removeItem(settingName);
      }
    },

    getDidNoop: function(direction) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.NOOP : SETTINGS.SYNCFLOW.RESTORE.NOOP;
      return STR.isTruthy(localStorage.getItem(settingName));
    },

    setDidNoop: function(direction, noop) {
      const settingName = (direction == SYNCFLOW.DIRECTION.BACKUP) ? SETTINGS.SYNCFLOW.BACKUP.NOOP : SETTINGS.SYNCFLOW.RESTORE.NOOP;
      SETTINGS.localSet(settingName, noop);
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

      SETTINGS.localSet(completedOkSetting, Date.now());
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

      SETTINGS.localSet(completedOkSetting, Date.now());
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

      SETTINGS.localSet(lastErrorWhenSetting, Date.now());
      SETTINGS.localSet(lastErrorMsgSetting, msg);
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
    DISMISSED_MFA_NOTE: 'githubDismissedMfaNote',

    setDismissedMfaNote: function() {
      SETTINGS.localSet(SETTINGS.GITHUB.DISMISSED_MFA_NOTE, true);
    },

    getDismissedMfaNote: function() {
      return STR.isTruthy(localStorage.getItem(SETTINGS.GITHUB.DISMISSED_MFA_NOTE));
    },

    getTokenAlreadyInUseForOtherRepoMsg: async function(proposedToken, proposedRepoType) {
      const otherRepoType = (proposedRepoType == GITHUB.REPO_TYPE.VIDEOS) ? GITHUB.REPO_TYPE.DATA : GITHUB.REPO_TYPE.VIDEOS;
      const otherToken = await SETTINGS.GITHUB.getSyncToken(otherRepoType);
      if (STR.hasLen(otherToken) && otherToken == proposedToken) {
        return `That token is already in use for the ${otherRepoType} repository. Create a new ${proposedRepoType} repository and a separate token for it.`;
      }
      else {
        return null;
      }
    },

    finalizeSettingName: function(baseName, repoType) {
      repoType = repoType || GITHUB.REPO_TYPE.DATA;
      return `${baseName}_${repoType}`;
    },

    saveSyncToken: async function(token, repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_TOKEN, repoType);
      await chrome.storage.local.set({ [settingName]: token });
    },

    getSyncToken: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_TOKEN, repoType);
      return await SETTINGS.getStorageValue(settingName);
    },

    hasSyncToken: async function(repoType) {
      const token = await SETTINGS.GITHUB.getSyncToken(repoType);
      return STR.hasLen(token);
    },

    removeSyncToken: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_TOKEN, repoType);
      await chrome.storage.local.remove(settingName);
    },

    getUserName: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.USERNAME, repoType);
      return await SETTINGS.getStorageValue(settingName);
    },

    saveUserName: async function(username, repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.USERNAME, repoType);
      await chrome.storage.local.set({ [settingName]: username });
    },

    removeSyncUserName: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.USERNAME, repoType);
      await chrome.storage.local.remove(settingName);
    },

    getSyncRepoIsPublic: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_REPO_PUBLIC, repoType);
      const result = await SETTINGS.getStorageValue(settingName);
      return STR.isTruthy(result);
    },

    saveSyncRepoIsPublic: async function(isPublic, repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_REPO_PUBLIC, repoType);
      const value = STR.isTruthy(isPublic);
      await chrome.storage.local.set({ [settingName]: value });
    },

    removeSyncRepoIsPublic: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_REPO_PUBLIC, repoType);
      await chrome.storage.local.remove(settingName);
    },

    getAvatarUrl: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.USER_AVATAR_URL, repoType);
      return await SETTINGS.getStorageValue(settingName);
    },

    saveAvatarUrl: async function(avatarUrl, repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.USER_AVATAR_URL, repoType);
      await chrome.storage.local.set({ [settingName]: avatarUrl });
    },

    removeAvatarUrl: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.USER_AVATAR_URL, repoType);
      await chrome.storage.local.remove(settingName);
    },

    getSyncConnLastOk: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_CONN_LAST_OK, repoType);
      return await SETTINGS.getStorageValue(settingName);
    },

    saveSyncConnLastOkNow: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_CONN_LAST_OK, repoType);
      await chrome.storage.local.set({ [settingName]: Date.now() });
    },

    recordSyncConnFail: async function(repoType) {
      await SETTINGS.GITHUB.removeSyncLastOk(repoType);
    },

    removeSyncLastOk: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_CONN_LAST_OK, repoType);
      await chrome.storage.local.remove(settingName);
    },

    getDefaultRepoName: function(repoType) {
      return (repoType == GITHUB.REPO_TYPE.VIDEOS)
        ? GITHUB.DEFAULT_VIDEOS_SYNC_REPO_NAME 
        : GITHUB.DEFAULT_DATA_SYNC_REPO_NAME;
    },

    getSyncRepoName: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_REPO, repoType);
      let repo = await SETTINGS.getStorageValue(settingName);
      if (!STR.hasLen(repo)) {
        repo = SETTINGS.GITHUB.getDefaultRepoName(repoType);
      }

      return repo;
    },

    saveSyncRepoName: async function(name, repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_REPO, repoType);
      await chrome.storage.local.set({ [settingName]: name });
    },

    removeSyncRepoName: async function(repoType) {
      const settingName = SETTINGS.GITHUB.finalizeSettingName(SETTINGS.GITHUB.SYNC_REPO, repoType);
      await chrome.storage.local.remove(settingName);
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
        SETTINGS.localSet(SETTINGS.RECORDING.AUTHOR_FILTER, author);
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
        SETTINGS.localSet('videores', res);
      }  
    },

    THREAD_EXPANSION: {
      MIN_REPLY_RECORDING: 'threadExMinReplies',
      AUTO_ADVANCE: 'threadExAutoAdvance',
      
      getMinReplyRecording: async function() {
        const result = await SETTINGS.getStorageValue(SETTINGS.RECORDING.THREAD_EXPANSION.MIN_REPLY_RECORDING);
        return STR.isTruthy(result);
      },
      
      saveMinReplyRecording: async function(settingValue) {
        await chrome.storage.local.set({ [SETTINGS.RECORDING.THREAD_EXPANSION.MIN_REPLY_RECORDING]: settingValue });
      },
  
      getAutoAdvance: async function() {
        const result = await SETTINGS.getStorageValue(SETTINGS.RECORDING.THREAD_EXPANSION.AUTO_ADVANCE);
        return STR.isTruthy(result);
      },
      
      saveAutoAdvance: async function(settingValue) {
        await chrome.storage.local.set({ [SETTINGS.RECORDING.THREAD_EXPANSION.AUTO_ADVANCE]: settingValue });
      },
  
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
      SETTINGS.localSet('xthreadsite', domain);
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

    getAutoRecordPriorTo: function(context) {
      return (context && context.auto) ? context.auto.priorTo : null;
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
    SETTINGS.localSet(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH, true);
  },
  
  clearExplainedMdonOauth: function() {
    localStorage.removeItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH);
  },
  
  hadSuccessfulMdonDownload: function() {
    return localStorage.getItem(SETTINGS.DOWNLOADED_OK.MASTODON);
  },

  markMdonDownloadSuccess: function() {
    SETTINGS.localSet(SETTINGS.DOWNLOADED_OK.MASTODON, true);
  },

  getPageSize: function() {
    let size = parseInt(localStorage.getItem(SETTINGS.PAGING.PAGE_SIZE));
    if (isNaN(size)) { size = 25 };
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
      SETTINGS.localSet(SETTINGS.PAGE_CONTEXT.SITE, site);
    }
  },

  cacheOwner: function(site, owner) {
    const cacheKey = SETTINGS.ownerCacheKey(site);
    SETTINGS.localSet(cacheKey, owner);
  },

  cachePageState: function(msg) {
    if (!msg) { return; }
    
    if (msg.site) {
      SETTINGS.cacheSite(msg.site);
    }
    
    if (msg.networkOwner) {
      const cacheKey = SETTINGS.ownerCacheKey(msg.site);
      SETTINGS.localSet(cacheKey, msg.networkOwner);
    }
    
    if (msg.pageType) {
      const cacheKey = SETTINGS.pageTypeCacheKey(msg.site);
      SETTINGS.localSet(cacheKey, msg.pageType);
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
    SETTINGS.localSet(cacheKey, appearsAccepted);
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
      SETTINGS.localSet(SETTINGS.SORT_BY_STARS, true);
    }
    else {
      localStorage.removeItem(SETTINGS.SORT_BY_STARS);
    }
  },

  getDemandQualityPosts: function() {
    const setting = localStorage.getItem(SETTINGS.DEMAND_QUALITY_POSTS);
    return STR.isTruthy(setting);
  },

  setDemandQualityPosts: function(boolVal) {
    if (STR.isTruthy(boolVal)) {
      SETTINGS.localSet(SETTINGS.DEMAND_QUALITY_POSTS, true);
    }
    else {
      localStorage.removeItem(SETTINGS.DEMAND_QUALITY_POSTS);
    }
  }
};