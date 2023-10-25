/*
possumid.json
readme.md
sync
  profiles
    x
      x-list-favorites.json
      content
        x-profiles-a.json
      images
        x-avatars-a.json
  networks
    x
      following
        x-scafaria-following.json
      followers
        x-scafaria-followers.json
  posts (thread)
    x
      x-topic_sub_subtopic.json
      content
        x-scafaria_status_12345.json
      images (*note* -- card imgs plus regular ones)
        x-scafaria_status_12345-images.json
      videos
        x-scafaria_status_12345.mp4
*/

// this is just to help us understand if sync 'started' during our session (to help with rendering buttons on initial load)
// without this, if you start a backup and then hit reload page (F5), a pause button would appear and hang
var _backupStartedThisSession = false;
var _restoreStartedThisSession = false;

var SYNCFLOW = {
  
  START_MSG: 'Ready',

  DIRECTION: {
    BACKUP: 'backup',
    RESTORE: 'restore'
  },
  
  NETWORK: {
    x: 'x',
    mdon: 'mdon'
  },
  
  // note that videos are handled separately
  STEP_TYPE: {
    // PROFILES
    profileFavorites: 'profileFavorites',
    profiles: 'profiles',
    profileImgs: 'profileImgs',
    // NETWORKS
    networkFollowings: 'networkFollowings',
    networkFollowers: 'networkFollowers',
    // POSTS
    postTopicRatings: 'postTopicRatings',
    posts: 'posts',
    postImgs: 'postImgs',

    getAllStepTypes: function() {
      return [
        SYNCFLOW.STEP_TYPE.profileFavorites,
        SYNCFLOW.STEP_TYPE.profiles,
        SYNCFLOW.STEP_TYPE.profileImgs,
        SYNCFLOW.STEP_TYPE.networkFollowings,
        SYNCFLOW.STEP_TYPE.networkFollowers,
        SYNCFLOW.STEP_TYPE.postTopicRatings,
        SYNCFLOW.STEP_TYPE.posts,
        SYNCFLOW.STEP_TYPE.postImgs
      ];
    }
  },

  STEP: {
    type: 'type',
    network: 'network',
    marker: 'marker',
    config: 'config'
  },

  PULLABLE: {
    step: 'step',
    content: 'content',
    filePath: 'filePath',
    startMarker: 'startMarker',
    endMarker: 'endMarker'
  },

  PUSHABLE: {
    step: 'step',
    content: 'content',
    filePath: 'filePath',
    startMarker: 'startMarker',
    endMarker: 'endMarker',
    dontPush: 'dontPush',
    repoType: 'repoType'
  },

  STEP_SECONDS_AGO_DEEMED_RUNNING: 5,

  // todo: decouple this from index.js
  UI: {
    logStatus: function(direction, status) {
      switch (direction) {
        case SYNCFLOW.DIRECTION.BACKUP:
          GHBACKUP_UI.renderSyncBackupStatus(status);
          break;
        case SYNCFLOW.DIRECTION.RESTORE:
          GHRESTORE_UI.renderSyncRestoreStatus(status);
          break;
        default:
          break;
      }
    }
  },

  writePushFailureMsg: function(pushFailureResult) {
    return `Failed to push ${pushFailureResult.pushable.filePath}. Consider waiting and retrying. If this problem persists, contact ${SUPPORT_EMAIL}.`;
  },

  // { ok: boolean, msg: msg }
  buildStatus: function(direction) {
    let lastType = SETTINGS.SYNCFLOW.getLastStepType(direction);
    let lastNetwork = SETTINGS.SYNCFLOW.getLastNetwork(direction);
    let marker = SETTINGS.SYNCFLOW.getMarker(direction) || '';
    const lastRunOk = SETTINGS.SYNCFLOW.getCompletedRunOk(direction);
    const lastStepOk = SETTINGS.SYNCFLOW.getCompletedStepOk(direction);
    const lastStuckWhen = SETTINGS.SYNCFLOW.getStuckLastErrorWhen(direction);
    const lastStuckMsg = SETTINGS.SYNCFLOW.getStuckLastErrorMsg(direction);

    if (lastRunOk) {
      return {
        ok: true,
        msg: lastRunOk.toString()
      }
    }
    else if (lastStuckWhen) {
      return {
        ok: false,
        msg: lastStuckMsg
      }
    }
    else if (!STR.hasLen(lastType)) {
      // leave 'ok' undefined (we're not planning to show OK nor Fail icon)
      return {
        msg: SYNCFLOW.START_MSG
      };
    }
    else {
      lastType = SYNCFLOW.toFriendlyStepType(lastType);
      lastNetwork = SYNCFLOW.toFriendlyNetwork(lastNetwork);
      marker = SYNCFLOW.toFriendlyMarker(marker);
      const properDirection = (direction == SYNCFLOW.DIRECTION.BACKUP) ? 'Backup' : 'Restore';
      const logMsg = `${properDirection} for ${lastNetwork} ${lastType}... ${marker}`;

      const shouldRun = SETTINGS.SYNCFLOW.getShouldRun(direction);
      let running;
      if (shouldRun == true) {
        const secondsAgoStepOk = STR.secondsAgo(lastStepOk);
        const secondsAgoStepStuck = STR.secondsAgo(lastStuckWhen);
        let secondsAgo = secondsAgoStepOk;
        if (secondsAgo === null || (secondsAgoStepStuck && secondsAgoStepStuck < secondsAgo)) {
          secondsAgo = secondsAgoStepStuck;
        }

        running = secondsAgo != null && secondsAgo < SYNCFLOW.STEP_SECONDS_AGO_DEEMED_RUNNING;
      }

      // leave 'ok' undefined (we're not planning to show OK nor Fail icon)
      return {
        msg: logMsg,
        running: running
      };
    }
  },

  toFriendlyMarker: function(marker) {
    return marker == LAST_TEXT ? '' : marker;
  },

  toFriendlyNetwork: function(network) {
    switch (network) {
      case SYNCFLOW.NETWORK.x:
        return 'Twitter/X';
      case SYNCFLOW.NETWORK.mdon:
        return 'Mastodon';
      default:
        return '';
    }
  },

  toFriendlyStepType: function(stepType) {
    switch (stepType) {
      case SYNCFLOW.STEP_TYPE.profileFavorites:
        return 'Favorite accounts';
      case SYNCFLOW.STEP_TYPE.profiles:
        return 'Profiles';
      case SYNCFLOW.STEP_TYPE.profileImgs:
        return 'Profile photos';
      case SYNCFLOW.STEP_TYPE.networkFollowings:
        return 'Networks: following';
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return 'Networks: followers';
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
        return 'Rated posts';
      case SYNCFLOW.STEP_TYPE.posts:
        return 'Posts';
      case SYNCFLOW.STEP_TYPE.postImgs:
        return 'Post images';
      default:
        return '';
    }
  },

  getNetworks: function(config) {
    const networks = [];
    const ns = SETTINGS.SYNCFLOW.CONFIG;
    // ordered
    if (STR.isTruthy(config[ns.DO_TWITTER])) {
      networks.push(SYNCFLOW.NETWORK.x);
    }
    if (STR.isTruthy(config[ns.DO_MASTODON])) {
      networks.push(SYNCFLOW.NETWORK.mdon);
    }

    return networks;
  },

  getStepTypes: function(config) {
    const types = [];
    const ns = SETTINGS.SYNCFLOW.CONFIG;
    // ordered
    if (STR.isTruthy(config[ns.WITH_FAVORITES])) {
      types.push(SYNCFLOW.STEP_TYPE.profileFavorites);
    }
    if (STR.isTruthy(config[ns.WITH_PROFILES])) {
      types.push(SYNCFLOW.STEP_TYPE.profiles);
    }
    if (STR.isTruthy(config[ns.WITH_AVATARS])) {
      types.push(SYNCFLOW.STEP_TYPE.profileImgs);
    }
    if (STR.isTruthy(config[ns.WITH_NETWORKS])) {
      types.push(SYNCFLOW.STEP_TYPE.networkFollowings);
      types.push(SYNCFLOW.STEP_TYPE.networkFollowers);
    }
    if (STR.isTruthy(config[ns.WITH_TOPICS])) {
      types.push(SYNCFLOW.STEP_TYPE.postTopicRatings);
    }
    if (STR.isTruthy(config[ns.WITH_POSTS])) {
      types.push(SYNCFLOW.STEP_TYPE.posts);
    }
    if (STR.isTruthy(config[ns.WITH_POST_IMAGES])) {
      types.push(SYNCFLOW.STEP_TYPE.postImgs);
    }

    return types;
  },

  // note: when marker was saved at the end of the prior step run, we recorded the *end* marker.
  getStepToRun: function(lastType, lastNetwork, marker, config) {
    const syncStepTypes = SYNCFLOW.getStepTypes(config);
    const syncNetworks = SYNCFLOW.getNetworks(config);

    if (!STR.hasLen(lastNetwork)) {
      lastNetwork = syncNetworks[0];
    }
    
    const finalStepType = syncStepTypes[syncStepTypes.length - 1];
    const finalNetwork = syncNetworks[syncNetworks.length - 1];
    
    let step = {};
    step[SYNCFLOW.STEP.config] = config;

    if (!STR.hasLen(lastType)) {
      // at the beginning
      step[SYNCFLOW.STEP.type] = syncStepTypes[0];
      step[SYNCFLOW.STEP.network] = syncNetworks[0];
      step[SYNCFLOW.STEP.marker] = '';
      return step;
    }
    else if (lastType == finalStepType && marker == LAST_TEXT) {
      if (lastNetwork == finalNetwork) {
        // entirely done!
        return null;
      }
      else {
        // start of next network
        step[SYNCFLOW.STEP.type] = syncStepTypes[0];
        step[SYNCFLOW.STEP.network] = ES6.getNext(syncNetworks, lastNetwork);
        step[SYNCFLOW.STEP.marker] = '';
        return step;
      }
    }
    else if (marker != LAST_TEXT) {
      // fetch next page with same type and same network (note: marker is ending marker from last time)
      step[SYNCFLOW.STEP.type] = lastType;
      step[SYNCFLOW.STEP.network] = lastNetwork;
      step[SYNCFLOW.STEP.marker] = marker;
      return step;
    }
    else {
      // increment the step and reset the marker
      step[SYNCFLOW.STEP.type] = ES6.getNext(syncStepTypes, lastType);
      step[SYNCFLOW.STEP.network] = lastNetwork;
      step[SYNCFLOW.STEP.marker] = '';
      return step;
    }
  },

  pauseSync: function(direction) {
    SETTINGS.SYNCFLOW.setShouldRun(direction, false);
  },

  startOverSync: async function(direction) {
    SETTINGS.SYNCFLOW.setLastStepType(direction, '');
    SETTINGS.SYNCFLOW.setMarker(direction, '');
    SETTINGS.SYNCFLOW.setLastNetwork(direction, '');
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    await SYNCFLOW.resumeSync(direction);
  },

  resumeSync: async function(direction) {
    if (SETTINGS.SYNCFLOW.getCompletedRunOk(direction) || SETTINGS.SYNCFLOW.getStuckLastErrorWhen(direction)) {
      SETTINGS.SYNCFLOW.setLastStepType(direction, '');
      SETTINGS.SYNCFLOW.setMarker(direction, '');
      SETTINGS.SYNCFLOW.setLastNetwork(direction, '');
    }
    
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    const config = SETTINGS.SYNCFLOW.CONFIG.getConfig(direction);
    GITHUB.TREES.clearInMemoryCache(GITHUB.REPO_TYPE.DATA);
    await SYNCFLOW.runSyncFlowWorker(direction, config);
  },

  // resumes where left off
  runSyncFlowWorker: async function(direction, config) {
    const shouldRun = SETTINGS.SYNCFLOW.getShouldRun(direction);
    if (!shouldRun) {
      console.log('sync is off; exiting');
      SYNCFLOW.UI.logStatus(direction);
      return;
    }
    
    const retryInSeconds = SETTINGS.SYNCFLOW.getSecondsToPauseAfterRecentError(direction);
    if (retryInSeconds > 0) {
      const status = {msg: `Retrying in ${retryInSeconds} seconds`, running: true};
      console.log('sync retrying soon...');
      SYNCFLOW.UI.logStatus(direction, status);

      // clear error first
      SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
      
      setTimeout(async () => {
        await SYNCFLOW.runSyncFlowWorker(direction, config);
      }, retryInSeconds * 1000);

      return;
    }

    const lastType = SETTINGS.SYNCFLOW.getLastStepType(direction);
    const lastNetwork = SETTINGS.SYNCFLOW.getLastNetwork(direction);
    const marker = SETTINGS.SYNCFLOW.getMarker(direction);
    const step = SYNCFLOW.getStepToRun(lastType, lastNetwork, marker, config);

    if (step == null) {
      // DONE!
      SETTINGS.SYNCFLOW.setCompletedStepOk(direction);
      SETTINGS.SYNCFLOW.setCompletedRunOk(direction);
      console.log('push done!');
      SYNCFLOW.UI.logStatus(direction);
      return;
    }
    
    // logs info about the prior step
    SYNCFLOW.UI.logStatus(direction);

    await SYNCFLOW.kickoffSyncStep(direction, step);
  },

  kickoffSyncStep: async function(direction, step) {
    switch (direction) {
      case SYNCFLOW.DIRECTION.BACKUP:
        _backupStartedThisSession = true;
        _worker.postMessage({
          actionType: MSGTYPE.TODB.FETCH_FOR_BACKUP,
          step: step
        });
        break;
      case SYNCFLOW.DIRECTION.RESTORE:
        _restoreStartedThisSession = true;
        await SYNCFLOW.PULL_EXEC.kickoffRestoreStep(step);
        break;
      default:
        console.log('not implemented');
        break;
    }
  },

  recordExecutionStep: function(direction, ranThisStep, reachedThisMarker) {
    SETTINGS.SYNCFLOW.setLastStepType(direction, ranThisStep[SYNCFLOW.STEP.type]);
    SETTINGS.SYNCFLOW.setLastNetwork(direction, ranThisStep[SYNCFLOW.STEP.network]);
    SETTINGS.SYNCFLOW.setMarker(direction, reachedThisMarker);
    SETTINGS.SYNCFLOW.setCompletedStepOk(direction);
  },

  calcCompletedFullRun: function(step) {
    const config = step[SYNCFLOW.STEP.config];
    const syncStepTypes = SYNCFLOW.getStepTypes(config);
    const syncNetworks = SYNCFLOW.getNetworks(config);

    const finalType = syncStepTypes[syncStepTypes.length - 1];
    const finalNetwork = syncNetworks[syncNetworks.length - 1];
    
    const completedFullRun = step && 
              step[SYNCFLOW.STEP.marker] == LAST_TEXT && 
              step[SYNCFLOW.STEP.type] == finalType && 
              step[SYNCFLOW.STEP.network] == finalNetwork;

    return completedFullRun;
  },

  getConnDirection: function(step) {
    switch (step.type) {
      case SYNCFLOW.STEP_TYPE.networkFollowings:
        return CONN_DIRECTION.FOLLOWING;
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return CONN_DIRECTION.FOLLOWERS;
      default:
    }
  },

  getSite: function(network) {
    switch (network) {
      case SYNCFLOW.NETWORK.x:
        return SITE.TWITTER;
      case SYNCFLOW.NETWORK.mdon:
        return SITE.MASTODON;
      default:
        return null;
    }
  },

  PUSH_EXEC: {
    onGithubPushedOk: function(result) {
      GHCONFIG_UI.setGithubConnFailureMsg('');
  
      const rateLimit = result.rateLimit;
      const pushable = result.pushable;
      const step = pushable[SYNCFLOW.PUSHABLE.step];
      const config = step[SYNCFLOW.STEP.config];
      const direction = SYNCFLOW.DIRECTION.BACKUP;
  
      GHCONFIG_UI.renderRateLimit(rateLimit);
  
      SYNCFLOW.recordExecutionStep(direction, step, pushable.endMarker);
  
      const completedFullRun = SYNCFLOW.calcCompletedFullRun(step);
      if (completedFullRun == true) {
        SETTINGS.SYNCFLOW.setCompletedRunOk(direction);
        console.log('full push run ok');
        SYNCFLOW.UI.logStatus(direction);
      }
      else {
        // pause a bit to breathe, then try for next step (which will exit instead if done)
        setTimeout(async () => {
          await SYNCFLOW.runSyncFlowWorker(direction, config);
        }, 25);
      }
    },
  
    // called back by _worker with content needed for backup
    onFetchedForBackup: async function(pushable) {
      // now actually push it!
      await GITHUB.SYNC.BACKUP.upsertPushable(pushable, SYNCFLOW.PUSH_EXEC.onGithubPushedOk, GHCONFIG_UI.onGithubFailure);
    },
  
    buildPushable: function(step) {
      const stepType = step[SYNCFLOW.STEP.type];
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return SYNCFLOW.PUSHABLE_BUILDER.buildProfileFavorites(step);
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.PUSHABLE_BUILDER.buildProfiles(step);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.PUSHABLE_BUILDER.buildProfileImgs(step);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.PUSHABLE_BUILDER.buildNetworkConns(step);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNCFLOW.PUSHABLE_BUILDER.buildPostTopicRatings(step);
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.PUSHABLE_BUILDER.buildPosts(step);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.PUSHABLE_BUILDER.buildPostImgs(step);
        default:
          console.log('Unhandled backup type');
          SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.BACKUP, 'Unhandled backup type');
          return null;
      }
    }
  },

  PULL_EXEC: {
    buildPullable: function(step) {
      const stepType = step[SYNCFLOW.STEP.type];
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return SYNCFLOW.PULLABLE_BUILDER.buildProfileFavorites(step);
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.PULLABLE_BUILDER.buildProfiles(step);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.PULLABLE_BUILDER.buildProfileImgs(step);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.PULLABLE_BUILDER.buildNetworkConns(step);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNCFLOW.PULLABLE_BUILDER.buildPostTopicRatings(step);
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.PULLABLE_BUILDER.buildPosts(step);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.PULLABLE_BUILDER.buildPostImgs(step);
        default:
          console.log('Unhandled restore type');
          SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.RESTORE, 'Unhandled restore type');
          return null;
      }
    },

    kickoffRestoreStep: async function(step) {
      console.log(step);
    }
  },

  FILE_NAMER: {
    DELIM: '-',
    
    EXT: {
      txt: 'txt',
      json: 'json',
      mp4: 'mp4'
    },

    PATH_PART: {
      sync: 'sync',
      profiles: 'profiles',
      networks: 'networks',
      posts: 'posts',
      following: 'following',
      followers: 'followers',
      topics: 'topics',
      content: 'content',
      images: 'images',
      avatars: 'avatars',
      videos: 'videos'
    },

    getProfileFavoritesFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${DATATYPES.LIST_NAME}${delim}${LIST_FAVORITES}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${fileName}`;
      return fullPath.toLowerCase();
    },

    getProfilesFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}${delim}${step.marker}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.content}/${fileName}`;
      return fullPath.toLowerCase();
    },

    getProfileImgsFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.avatars}${delim}${step.marker}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.images}/${fileName}`;
      return fullPath.toLowerCase();
    },

    // the file name is the handle of the network owner. It's via the endMarker (the startMarker is the prior handle or '').
    getNetworkFilePath: function(step, endMarker) {
      if (endMarker == LAST_TEXT) { return null; }
      const network = step.network;
      const direction = SYNCFLOW.getConnDirection(step);
      const followPathPart = direction == CONN_DIRECTION.FOLLOWING ? SYNCFLOW.FILE_NAMER.PATH_PART.following : SYNCFLOW.FILE_NAMER.PATH_PART.followers;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${endMarker}${delim}${followPathPart}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.networks}/${network}/${followPathPart}/${fileName}`;
      return fullPath.toLowerCase();
    },

    getPostTopicRatingsFilePath: function(step, endMarker) {
      if (endMarker == LAST_TEXT) { return null; }
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      endMarker = endMarker.replace(TOPICS.TOPIC_SUBTOPIC_COLON, TOPICS.TOPIC_SUBTOPIC_FOR_FILE);
      const fileName = `${network}${delim}${endMarker}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.posts}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.topics}/${fileName}`;
      return fullPath.toLowerCase();
    },

    getPostsFilePath: function(step, endMarker) {
      if (endMarker == LAST_TEXT) { return null; }
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      endMarker = endMarker.replaceAll('/', '_');
      const fileName = `${network}${delim}${endMarker}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.posts}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.content}/${fileName}`;
      return fullPath.toLowerCase();
    },

    getPostImgsFilePath: function(step, endMarker) {
      if (endMarker == LAST_TEXT) { return null; }
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      endMarker = endMarker.replaceAll('/', '_');
      const fileName = `${network}${delim}${endMarker}-${SYNCFLOW.FILE_NAMER.PATH_PART.images}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.posts}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.images}/${fileName}`;
      return fullPath.toLowerCase();
    }
  },

  PUSH_WRITER: {
    // used when writing a line of text...
    appendTimestamp: function(str, timestamp) {
      const dt = (timestamp && !isNaN(parseInt(timestamp))) ? new Date(parseInt(timestamp)) : null;
      return dt ? `${str}${FLAT_RDF_TIME_DELIM}${dt.toISOString()}` : str;
    },
    
    asJson: function(rows) {
      if (!rows || rows.length == 0) { return null; }
      return JSON.stringify(rows, null, 2);
    },

    asText: function(rows, col, omitTimestamp) {
      let txt = '';
      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let value = row[col];
        let timestamp = row[SCHEMA_CONSTANTS.COLUMNS.Timestamp];
        if (omitTimestamp != true && timestamp) {
          let line = SYNCFLOW.PUSH_WRITER.appendTimestamp(value, timestamp);
          txt = STR.appendLine(txt, line);
        }
        else {
          txt = STR.appendLine(txt, value);  
        }
      }

      return txt;
    },

    writeProfileFavorites: function(rows) {
      return SYNCFLOW.PUSH_WRITER.asJson(rows, SYNC_COL.FAVORITES.Handle);
    },

    writeNetwork: function(rows) {
      return SYNCFLOW.PUSH_WRITER.asJson(rows, SYNC_COL.NETWORK.Connection, true);
    }
  },

  END_MARKING: {
    calcAutoAdvanceEnd: function(step) {
      return LAST_TEXT;
    },

    calcNextAlpha: function(step) {
      return STR.nextAlphaMarker(step.marker).toLowerCase();
    },

    calcViaLastRow: function(step, rows, col) {
      if (!rows || rows.length === 0) {
        return LAST_TEXT;
      }
      else {
        const lastRow = rows[rows.length - 1];
        const lastVal = lastRow[col];
        return lastVal.toLowerCase();
      }
    },

    calcPostRatingsEndMarker: function(step, rows) {
      if (!rows || rows.length === 0) {
        return LAST_TEXT;
      }
      else {
        const row = rows[rows.length - 1];
        const topic = row[SYNC_COL.RATED_POST.Topic];
        const subtopic = row[SYNC_COL.RATED_POST.Subtopic];
        const concat = `${topic}${TOPICS.TOPIC_SUBTOPIC_COLON}${subtopic}`;
        return concat.toLowerCase();
      }
    }
  },

  PULLABLE_BUILDER: {
    buildProfileFavorites: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   CONNFETCHER.SYNC.getFavorites, 
      //   SYNCFLOW.PUSH_WRITER.writeProfileFavorites,
      //   SYNCFLOW.FILE_NAMER.getProfileFavoritesFilePath,
      //   SYNCFLOW.END_MARKING.calcAutoAdvanceEnd);

      // // console.log(pushable);
      // return pushable;
    },

    buildProfiles: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   CONNFETCHER.SYNC.getProfiles, 
      //   SYNCFLOW.PUSH_WRITER.asJson,
      //   SYNCFLOW.FILE_NAMER.getProfilesFilePath,
      //   SYNCFLOW.END_MARKING.calcNextAlpha);

      // // console.log(pushable);
      // return pushable;
    },

    buildProfileImgs: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   CONNFETCHER.SYNC.getProfileImgs,
      //   SYNCFLOW.PUSH_WRITER.asJson,
      //   SYNCFLOW.FILE_NAMER.getProfileImgsFilePath,
      //   SYNCFLOW.END_MARKING.calcNextAlpha);

      // // console.log(pushable);
      // return pushable;
    },

    buildNetworkConns: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   CONNFETCHER.SYNC.getNetworkConns,
      //   SYNCFLOW.PUSH_WRITER.writeNetwork,
      //   SYNCFLOW.FILE_NAMER.getNetworkFilePath,
      //   SYNCFLOW.END_MARKING.calcViaLastRow,
      //   SYNC_COL.NETWORK.Handle);

      // // console.log(pushable);
      // return pushable;
    },

    buildPostTopicRatings: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   POSTFETCHER.SYNC.getTopicRatings,
      //   SYNCFLOW.PUSH_WRITER.asJson,
      //   SYNCFLOW.FILE_NAMER.getPostTopicRatingsFilePath,
      //   SYNCFLOW.END_MARKING.calcPostRatingsEndMarker,
      //   SYNC_COL.NETWORK.Handle);

      // // console.log(pushable);
      // return pushable;
    },

    buildPosts: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   POSTFETCHER.SYNC.getPosts,
      //   SYNCFLOW.PUSH_WRITER.asJson,
      //   SYNCFLOW.FILE_NAMER.getPostsFilePath,
      //   SYNCFLOW.END_MARKING.calcViaLastRow,
      //   SYNC_COL.POSTS.MarkerUrlKey);

      // // console.log(pushable);
      // return pushable;
    },

    buildPostImgs: function(step) {
      // const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
      //   step, 
      //   POSTFETCHER.SYNC.getPostImgs,
      //   SYNCFLOW.PUSH_WRITER.asJson,
      //   SYNCFLOW.FILE_NAMER.getPostImgsFilePath,
      //   SYNCFLOW.END_MARKING.calcViaLastRow,
      //   SYNC_COL.POST_IMGS.MarkerUrlKey,
      //   SYNC_COL.POST_IMGS.Img);

      // // console.log(pushable);
      // return pushable;
    }
  },

  PUSHABLE_BUILDER: {
    // dontPush will be marked true if contentCheckCol is passed in and no rows are found with content in that column
    // the reason we don't just return a null pushable is that we want the markers to continue flowing in order anyway
    buildPushableWorker: function(step, fnDbQuery, fnWriter, fnFileNamer, fnEndMarkerCalcer, markerCol, contentCheckCol) {
      const rows = fnDbQuery(step);
      const content = fnWriter(rows);
      const endMarker = fnEndMarkerCalcer(step, rows, markerCol);
      const path = fnFileNamer(step, endMarker);
      var pushable = {};

      pushable[SYNCFLOW.PUSHABLE.step] = step;
      pushable[SYNCFLOW.PUSHABLE.content] = content;
      pushable[SYNCFLOW.PUSHABLE.filePath] = path;
      pushable[SYNCFLOW.PUSHABLE.startMarker] = step.marker;
      pushable[SYNCFLOW.PUSHABLE.endMarker] = endMarker;

      if (!STR.hasLen(path)) {
        pushable[SYNCFLOW.PUSHABLE.dontPush] = true;
      }
      else if (STR.hasLen(contentCheckCol)) {
        const found = rows.find(function(row) {
          return STR.hasLen(row[contentCheckCol]);
        });

        if (!found) {
          pushable[SYNCFLOW.PUSHABLE.dontPush] = true;
        }
      }

      return pushable;
    },
    
    buildProfileFavorites: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        CONNFETCHER.SYNC.getFavorites, 
        SYNCFLOW.PUSH_WRITER.writeProfileFavorites,
        SYNCFLOW.FILE_NAMER.getProfileFavoritesFilePath,
        SYNCFLOW.END_MARKING.calcAutoAdvanceEnd);

      // console.log(pushable);
      return pushable;
    },

    buildProfiles: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        CONNFETCHER.SYNC.getProfiles, 
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getProfilesFilePath,
        SYNCFLOW.END_MARKING.calcNextAlpha);

      // console.log(pushable);
      return pushable;
    },

    buildProfileImgs: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        CONNFETCHER.SYNC.getProfileImgs,
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getProfileImgsFilePath,
        SYNCFLOW.END_MARKING.calcNextAlpha);

      // console.log(pushable);
      return pushable;
    },

    buildNetworkConns: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        CONNFETCHER.SYNC.getNetworkConns,
        SYNCFLOW.PUSH_WRITER.writeNetwork,
        SYNCFLOW.FILE_NAMER.getNetworkFilePath,
        SYNCFLOW.END_MARKING.calcViaLastRow,
        SYNC_COL.NETWORK.Handle);

      // console.log(pushable);
      return pushable;
    },

    buildPostTopicRatings: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        POSTFETCHER.SYNC.getTopicRatings,
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getPostTopicRatingsFilePath,
        SYNCFLOW.END_MARKING.calcPostRatingsEndMarker,
        SYNC_COL.NETWORK.Handle);

      // console.log(pushable);
      return pushable;
    },

    buildPosts: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        POSTFETCHER.SYNC.getPosts,
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getPostsFilePath,
        SYNCFLOW.END_MARKING.calcViaLastRow,
        SYNC_COL.POSTS.MarkerUrlKey);

      // console.log(pushable);
      return pushable;
    },

    buildPostImgs: function(step) {
      const pushable = SYNCFLOW.PUSHABLE_BUILDER.buildPushableWorker(
        step, 
        POSTFETCHER.SYNC.getPostImgs,
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getPostImgsFilePath,
        SYNCFLOW.END_MARKING.calcViaLastRow,
        SYNC_COL.POST_IMGS.MarkerUrlKey,
        SYNC_COL.POST_IMGS.Img);

      // console.log(pushable);
      return pushable;
    }
  }
};
