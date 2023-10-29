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

  SYNC_VERSION: 1,

  DATA_PART: {
    app: 'app',
    version: 'version',
    type: 'type',
    data: 'data'
  },

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
    config: 'config',
    exact: 'exact'
  },

  SYNCABLE: {
    step: 'step',
    content: 'content',
    filePath: 'filePath',
    startMarker: 'startMarker',
    endMarker: 'endMarker',
    dontSync: 'dontSync',
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
    return `Failed to push ${pushFailureResult.syncable.filePath}. Consider waiting and retrying. If this problem persists, contact ${SUPPORT_EMAIL}.`;
  },

  buildStatus: function(direction) {
    let lastType = SETTINGS.SYNCFLOW.getLastStepType(direction);
    let lastNetwork = SETTINGS.SYNCFLOW.getLastNetwork(direction);
    let marker = SETTINGS.SYNCFLOW.getMarker(direction) || '';
    const lastRunOk = SETTINGS.SYNCFLOW.getCompletedRunOk(direction);
    const lastStepOk = SETTINGS.SYNCFLOW.getCompletedStepOk(direction);
    const lastStuckWhen = SETTINGS.SYNCFLOW.getStuckLastErrorWhen(direction);
    const lastStuckMsg = SETTINGS.SYNCFLOW.getStuckLastErrorMsg(direction);
    const lastNoop = SETTINGS.SYNCFLOW.getDidNoop(direction);

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
        running: running,
        priorStepIdentical: lastNoop
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
    SETTINGS.SYNCFLOW.setDidNoop(direction, false);
    SETTINGS.SYNCFLOW.setLastNetwork(direction, '');
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    await SYNCFLOW.resumeSync(direction);
  },

  resumeSync: async function(direction) {
    if (SETTINGS.SYNCFLOW.getCompletedRunOk(direction) || SETTINGS.SYNCFLOW.getStuckLastErrorWhen(direction)) {
      SETTINGS.SYNCFLOW.setLastStepType(direction, '');
      SETTINGS.SYNCFLOW.setMarker(direction, '');
      SETTINGS.SYNCFLOW.setDidNoop(direction, false);
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

  recordExecutionStep: function(direction, ranThisStep, reachedThisMarker, noop) {
    SETTINGS.SYNCFLOW.setLastStepType(direction, ranThisStep[SYNCFLOW.STEP.type]);
    SETTINGS.SYNCFLOW.setLastNetwork(direction, ranThisStep[SYNCFLOW.STEP.network]);
    SETTINGS.SYNCFLOW.setMarker(direction, reachedThisMarker);
    SETTINGS.SYNCFLOW.setDidNoop(direction, noop);
    SETTINGS.SYNCFLOW.setCompletedStepOk(direction);
  },

  calcCompletedFullRun: function(step, reachedThisMarker) {
    const config = step[SYNCFLOW.STEP.config];
    const syncStepTypes = SYNCFLOW.getStepTypes(config);
    const syncNetworks = SYNCFLOW.getNetworks(config);

    const finalType = syncStepTypes[syncStepTypes.length - 1];
    const finalNetwork = syncNetworks[syncNetworks.length - 1];
    
    const completedFullRun = step && 
              (step[SYNCFLOW.STEP.marker] == LAST_TEXT || reachedThisMarker == LAST_TEXT) && 
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

  onGithubSyncStepOk: function(result, direction) {
    GHCONFIG_UI.setGithubConnFailureMsg('');

    const rateLimit = result.rateLimit;
    const syncable = result.syncable;
    const noop = syncable[SYNCFLOW.SYNCABLE.dontSync];
    
    const step = syncable[SYNCFLOW.SYNCABLE.step];
    const config = step[SYNCFLOW.STEP.config];

    GHCONFIG_UI.renderRateLimit(rateLimit);
    const reachedThisMarker = syncable[SYNCFLOW.SYNCABLE.endMarker];
    SYNCFLOW.recordExecutionStep(direction, step, reachedThisMarker, noop);

    const completedFullRun = SYNCFLOW.calcCompletedFullRun(step, reachedThisMarker);
    if (completedFullRun == true) {
      SETTINGS.SYNCFLOW.setCompletedRunOk(direction);
      console.log(`full ${direction} run ok`);
      SYNCFLOW.UI.logStatus(direction);
    }
    else {
      // pause a bit to breathe, then try for next step (which will exit instead if done)
      setTimeout(async () => {
        await SYNCFLOW.runSyncFlowWorker(direction, config);
      }, 25);
    }
  },

  PUSH_EXEC: {
    // called back by _worker with content needed for backup
    onFetchedForBackup: async function(syncable) {
      // now actually push it!
      await GITHUB.SYNC.BACKUP.upsertPushable(syncable, SYNCFLOW.onGithubSyncStepOk, GHCONFIG_UI.onGithubFailure);
    },
  
    buildPushable: function(step) {
      const stepType = step.type;
      const fnDbQuery = SYNCFLOW.PUSH_EXEC.getDbFetchFn(stepType);
      const rows = fnDbQuery(step);
      const content = SYNCFLOW.PUSH_WRITER.asJson(rows, stepType);
      const markerCol = SYNCFLOW.END_MARKING.getMarkerColName(stepType);
      const contentCheckCol = SYNCFLOW.PUSH_EXEC.getContentCheckColName(stepType);
      const endMarker = SYNCFLOW.END_MARKING.calcMarkerEnd(step, rows, markerCol);
      const path = SYNCFLOW.FILE_NAMER.getFilePath(step, endMarker);
      var syncable = {};

      syncable[SYNCFLOW.SYNCABLE.step] = step;
      syncable[SYNCFLOW.SYNCABLE.content] = content;
      syncable[SYNCFLOW.SYNCABLE.filePath] = path;
      syncable[SYNCFLOW.SYNCABLE.startMarker] = step.marker;
      syncable[SYNCFLOW.SYNCABLE.endMarker] = endMarker;

      // dontSync will be marked true if contentCheckCol is passed in and no rows are found with content in that column
      // the reason we don't just return a null syncable is that we want the markers to continue flowing in order anyway
      if (!STR.hasLen(path)) {
        syncable[SYNCFLOW.SYNCABLE.dontSync] = true;
      }
      else if (STR.hasLen(contentCheckCol)) {
        const found = rows.find(function(row) {
          return STR.hasLen(row[contentCheckCol]);
        });

        if (!found) {
          syncable[SYNCFLOW.SYNCABLE.dontSync] = true;
        }
      }

      return syncable;
    },

    getDbFetchFn: function(stepType) {
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return CONNFETCHER.SYNC.getFavorites;
        case SYNCFLOW.STEP_TYPE.profiles:
          return CONNFETCHER.SYNC.getProfiles;
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return CONNFETCHER.SYNC.getProfileImgs;
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return CONNFETCHER.SYNC.getNetworkConns;
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return POSTFETCHER.SYNC.getTopicRatings;
        case SYNCFLOW.STEP_TYPE.posts:
          return POSTFETCHER.SYNC.getPosts;
        case SYNCFLOW.STEP_TYPE.postImgs:
          return POSTFETCHER.SYNC.getPostImgs;
        default:
          console.log('Unhandled fetch step type');
          return null;
      }
    },

    getContentCheckColName: function(stepType) {
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
        case SYNCFLOW.STEP_TYPE.profiles:
        case SYNCFLOW.STEP_TYPE.profileImgs:
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
        case SYNCFLOW.STEP_TYPE.posts:
          return null;
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNC_COL.POST_IMGS.Img;
        default:
          console.log('Unhandled fetch step type');
          return null;
      }
    }
  },

  PULL_EXEC: {
    kickoffRestoreStep: async function(step) {
      const repoType = GITHUB.REPO_TYPE.DATA;
      const repoConnInfo = await GITHUB.SYNC.getRepoConnInfo(GHCONFIG_UI.onGithubFailure, repoType);
      if (!repoConnInfo) { return; }

      const rateLimit = await GITHUB.getRateLimit(repoConnInfo.token, repoType);
      if (GITHUB.SYNC.checkIfRateLimited(rateLimit, GHCONFIG_UI.onGithubFailure) == true) {
        return;
      }

      const remoteDir = SYNCFLOW.FILE_NAMER.getRemoteDir(step);

      // deliberately not using STR.hasLen here
      const marker = STR.hasLen(step.marker) ? step.marker : LAST_TEXT;
      const fileName = SYNCFLOW.FILE_NAMER.getFileName(step, marker);
      const nextRemoteFile = await GITHUB.TREES.getNextFile(remoteDir, repoConnInfo, repoType, fileName);

      if (!nextRemoteFile) {
        const result = SYNCFLOW.PULL_EXEC.buildNoMoreRemoteFilesResult(step, rateLimit);
        SYNCFLOW.onGithubSyncStepOk(result, SYNCFLOW.DIRECTION.RESTORE);
        return;
      }

      // Identify what we would have pushed for this file
      const pushStep = SYNCFLOW.PULL_EXEC.toPushStep(step, nextRemoteFile.path);
      // and then processing resumes using worker thread
      // then back to continueRestore below
      _worker.postMessage({
        actionType: MSGTYPE.TODB.FETCH_FOR_RESTORE,
        pullStep: step,
        pushStep: pushStep,
        remoteDir: remoteDir,
        remoteFileName: nextRemoteFile.path,
        remoteSha: nextRemoteFile.sha,
        rateLimit: rateLimit
      });
    },

    // wakes up when called back from worker
    // (here we're again on the main UI thread)
    continueRestore: async function(request, rows) {
      const pullStep = request.pullStep;
      const content = SYNCFLOW.PUSH_WRITER.asJson(rows, pullStep[SYNCFLOW.STEP.type]);
      
      // and compare its sha vs the file we're asked to pull.
      const dbSha = STR.hasLen(content) ? (await GITHUB.SHAS.calcTextContentSha(content)) : null;
      
      // Only pull from github if needed
      if (dbSha && dbSha == request.remoteSha) {
        // console.log('skipping identical pull of ' + request.remoteFileName);
        const pulledResult = SYNCFLOW.PULL_EXEC.buildPulledResult(pullStep, rows, request.rateLimit);
        pulledResult.syncable[SYNCFLOW.SYNCABLE.dontSync] = true;
        SYNCFLOW.onGithubSyncStepOk(pulledResult, SYNCFLOW.DIRECTION.RESTORE);
      }
      else {
        // pull the file from github
        const repoType = GITHUB.REPO_TYPE.DATA;
        const repoConnInfo = await GITHUB.SYNC.getRepoConnInfo(GHCONFIG_UI.onGithubFailure, repoType);
        const json = await GITHUB.getFileJson(request.remoteDir, request.remoteFileName, repoConnInfo);
        const parsed = STR.hasLen(json) ? JSON.parse(json) : null;

        _worker.postMessage({
          actionType: MSGTYPE.TODB.SAVE_FOR_RESTORE,
          step: request.pullStep,
          rateLimit: request.rateLimit,
          data: parsed
        });
      }
    },

    buildPulledResult: function(pullStep, rows, rateLimit) {
      const syncable = {};
      syncable[SYNCFLOW.SYNCABLE.step] = pullStep;
      const markerCol = SYNCFLOW.END_MARKING.getMarkerColName(pullStep.type);
      const endMarker = SYNCFLOW.END_MARKING.calcMarkerEnd(pullStep, rows, markerCol);
      syncable[SYNCFLOW.SYNCABLE.endMarker] = endMarker;

      return {
        syncable: syncable,
        rateLimit: rateLimit
      };
    },

    buildNoMoreRemoteFilesResult: function(step, rateLimit) {
      const syncable = {};
      syncable[SYNCFLOW.SYNCABLE.step] = step;
      syncable[SYNCFLOW.SYNCABLE.endMarker] = LAST_TEXT;

      return {
        syncable: syncable,
        rateLimit: rateLimit
      };
    },

    // Given a step expressed in "pull" terms and the remote file that we're trying to 
    // re-generate out of the DB (if available) -- for purposes of comparing its SHA to 
    // see if a pull is required at all -- convert it to a "step" that can make a syncable.
    // And that syncable can then be used to obtain the DB content.
    toPushStep: function(pullStep, remoteFileName) {
      const step = {};
      const type = pullStep[SYNCFLOW.STEP.type];
      step[SYNCFLOW.STEP.type] = type;
      step[SYNCFLOW.STEP.network] = pullStep[SYNCFLOW.STEP.network];
      step[SYNCFLOW.STEP.config] = pullStep[SYNCFLOW.STEP.config];
      step[SYNCFLOW.STEP.marker] = SYNCFLOW.FILE_NAMER.extractMarker(type, remoteFileName);
      step[SYNCFLOW.STEP.exact] = true;
      return step;
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

    getRemoteDir: function(step) {
      const stepType = step[SYNCFLOW.STEP.type];
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return SYNCFLOW.FILE_NAMER.getProfileFavoritesDir(step);
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.FILE_NAMER.getProfilesDir(step);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.FILE_NAMER.getProfileImgsDir(step);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.FILE_NAMER.getNetworkConnsDir(step);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNCFLOW.FILE_NAMER.getPostTopicRatingsDir(step);
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.FILE_NAMER.getPostsDir(step);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.FILE_NAMER.getPostImgsDir(step);
        default:
          console.log('Unhandled restore type');
          SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.RESTORE, 'Unhandled restore type');
          return null;
      }
    },

    extractMarker: function(type, fileName) {
      switch (type) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return '';  // we don't chunk out by marker
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.FILE_NAMER.getProfilesMarker(fileName);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.FILE_NAMER.getProfileImgsMarker(fileName);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.FILE_NAMER.getNetworkConnsMarker(fileName);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return '';  // we don't chunk out by marker
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.FILE_NAMER.getPostsMarker(fileName);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.FILE_NAMER.getPostImgsMarker(fileName);
        default:
          console.log('Unhandled restore type');
          SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.RESTORE, 'Unhandled restore type');
          return null;
      }
    },

    getFileName: function(step, relevantMarker) {
      const stepType = step[SYNCFLOW.STEP.type];
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return SYNCFLOW.FILE_NAMER.getProfileFavoritesFileName(step);
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.FILE_NAMER.getProfilesFileName(step);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.FILE_NAMER.getProfileImgsFileName(step);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.FILE_NAMER.getNetworkConnsFileName(step, relevantMarker);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNCFLOW.FILE_NAMER.getPostTopicRatingsFileName(step, relevantMarker);
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.FILE_NAMER.getPostsFileName(step, relevantMarker);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.FILE_NAMER.getPostImgsFileName(step, relevantMarker);
        default:
          console.log('Unhandled restore type');
          return null;
      }
    },

    getFilePath: function(step, relevantMarker) {
      const stepType = step[SYNCFLOW.STEP.type];
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return SYNCFLOW.FILE_NAMER.getProfileFavoritesFilePath(step);
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.FILE_NAMER.getProfilesFilePath(step);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.FILE_NAMER.getProfileImgsFilePath(step);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.FILE_NAMER.getNetworkConnsFilePath(step, relevantMarker);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNCFLOW.FILE_NAMER.getPostTopicRatingsFilePath(step, relevantMarker);
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.FILE_NAMER.getPostsFilePath(step, relevantMarker);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.FILE_NAMER.getPostImgsFilePath(step, relevantMarker);
        default:
          console.log('Unhandled restore type');
          return null;
      }
    },

    getProfileFavoritesDir: function(step) {
      const network = step.network;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}`.toLowerCase();
    },

    getProfileFavoritesFileName: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      return `${network}${delim}${DATATYPES.LIST_NAME}${delim}${LIST_FAVORITES}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getProfileFavoritesFilePath: function(step) {
      const fileName = SYNCFLOW.FILE_NAMER.getProfileFavoritesFileName(step);
      const dir = SYNCFLOW.FILE_NAMER.getProfileFavoritesDir(step);
      return `${dir}/${fileName}`;
    },

    getProfilesDir: function(step) {
      const network = step.network;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.content}`.toLowerCase();
    },

    getProfilesFileName: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const marker = STR.hasLen(step.marker) ? step.marker : FIRST_TEXT;
      return `${network}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}${delim}${marker}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getProfilesMarker: function(fileName) {
      return SYNCFLOW.FILE_NAMER.getMarkerAsLastFileNameSegment(fileName);
    },

    getProfilesFilePath: function(step) {
      const fileName = SYNCFLOW.FILE_NAMER.getProfilesFileName(step);
      const dir = SYNCFLOW.FILE_NAMER.getProfilesDir(step);
      return `${dir}/${fileName}`;
    },

    getProfileImgsDir: function(step) {
      const network = step.network;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.images}`.toLowerCase();
    },

    getProfileImgsFileName: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const marker = STR.hasLen(step.marker) ? step.marker : FIRST_TEXT;
      return `${network}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.avatars}${delim}${marker}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getProfileImgsMarker: function(fileName) {
      return SYNCFLOW.FILE_NAMER.getMarkerAsLastFileNameSegment(fileName);
    },

    getProfileImgsFilePath: function(step) {
      const fileName = SYNCFLOW.FILE_NAMER.getProfileImgsFileName(step);
      const dir = SYNCFLOW.FILE_NAMER.getProfileImgsDir(step);
      return `${dir}/${fileName}`;
    },

    getNetworkConnsDir: function(step) {
      const network = step.network;
      const direction = SYNCFLOW.getConnDirection(step);
      const followPathPart = direction == CONN_DIRECTION.FOLLOWING ? SYNCFLOW.FILE_NAMER.PATH_PART.following : SYNCFLOW.FILE_NAMER.PATH_PART.followers;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.networks}/${network}/${followPathPart}`.toLowerCase();
    },

    // the file name is the handle of the network owner. It's via the endMarker (the startMarker is the prior handle or '').
    getNetworkConnsFileName: function(step, relevantMarker) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const direction = SYNCFLOW.getConnDirection(step);
      const followPathPart = direction == CONN_DIRECTION.FOLLOWING ? SYNCFLOW.FILE_NAMER.PATH_PART.following : SYNCFLOW.FILE_NAMER.PATH_PART.followers;
      return `${network}${delim}${relevantMarker}${delim}${followPathPart}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getNetworkConnsMarker: function(fileName) {
      const sansExt = STR.stripSuffix(fileName, `.${SYNCFLOW.FILE_NAMER.EXT.json}`);
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const parts = sansExt.split(delim);
      const marker = parts[1];
      return marker;
    },

    getNetworkConnsFilePath: function(step, relevantMarker) {
      if (relevantMarker == LAST_TEXT) { return null; }
      const fileName = SYNCFLOW.FILE_NAMER.getNetworkConnsFileName(step, relevantMarker);
      const dir = SYNCFLOW.FILE_NAMER.getNetworkConnsDir(step);
      return `${dir}/${fileName}`;
    },

    getPostTopicRatingsDir: function(step) {
      const network = step.network;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.posts}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.topics}`.toLowerCase();
    },

    getPostTopicRatingsFileName: function(step, relevantMarker) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      relevantMarker = relevantMarker.replace(TOPICS.TOPIC_SUBTOPIC_COLON, TOPICS.TOPIC_SUBTOPIC_FOR_FILE);
      return `${network}${delim}${relevantMarker}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getPostTopicsMarker: function(fileName) {
      return SYNCFLOW.FILE_NAMER.getMarkerAsLastFileNameSegment(fileName);
    },

    getPostTopicRatingsFilePath: function(step, relevantMarker) {
      if (relevantMarker == LAST_TEXT) { return null; }
      const fileName = SYNCFLOW.FILE_NAMER.getPostTopicRatingsFileName(step, relevantMarker);
      const dir = SYNCFLOW.FILE_NAMER.getPostTopicRatingsDir(step);
      return `${dir}/${fileName}`;
    },

    getPostsDir: function(step) {
      const network = step.network;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.posts}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.content}`.toLowerCase();
    },

    getPostsFileName: function(step, relevantMarker) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      relevantMarker = relevantMarker.replaceAll('/', '_');
      return `${network}${delim}${relevantMarker}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getPostsMarker: function(fileName) {
      return SYNCFLOW.FILE_NAMER.getPostMarkerWorker(fileName);
    },

    getPostsFilePath: function(step, relevantMarker) {
      if (relevantMarker == LAST_TEXT) { return null; }
      const dir = SYNCFLOW.FILE_NAMER.getPostsDir(step);
      const fileName = SYNCFLOW.FILE_NAMER.getPostsFileName(step, relevantMarker);
      return `${dir}/${fileName}`;
    },

    getPostImgsDir: function(step) {
      const network = step.network;
      return `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.posts}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.images}`.toLowerCase();
    },

    getPostImgsFileName: function(step, relevantMarker) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      relevantMarker = relevantMarker.replaceAll('/', '_');
      return `${network}${delim}${relevantMarker}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.images}.${SYNCFLOW.FILE_NAMER.EXT.json}`.toLowerCase();
    },

    getPostImgsMarker: function(fileName) {
      return SYNCFLOW.FILE_NAMER.gegetPostMarkerWorker(fileName);
    },

    getPostImgsFilePath: function(step, relevantMarker) {
      if (relevantMarker == LAST_TEXT) { return null; }
      const fileName = SYNCFLOW.FILE_NAMER.getPostImgsFileName(step, relevantMarker);
      const dir = SYNCFLOW.FILE_NAMER.getPostImgsDir(step);
      return `${dir}/${fileName}`;
    },

    getMarkerAsLastFileNameSegment: function(fileName) {
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const sansExt = STR.stripSuffix(fileName, `.${SYNCFLOW.FILE_NAMER.EXT.json}`);
      const parts = sansExt.split(delim);
      const marker = (parts.length == 1) ? '' : parts[parts.length - 1];
      return marker;
    },

    // to pull the marker out of the file name
    // works for posts and for post imgs
    getPostMarkerWorker: function(fileName) {
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      let cleaned = STR.stripSuffix(fileName, `.${SYNCFLOW.FILE_NAMER.EXT.json}`);
      // handle images case
      cleaned = STR.stripSuffix(cleaned, `${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.images}`);
      const parts = cleaned.split(delim);
      let marker = (parts.length == 1) ? '' : parts[parts.length - 1];
      // need to reinsert to '/' (but carefully since '_' is a legal character)
      if (marker.startsWith('_')) {
        marker = STR.stripPrefix(marker, '_');
        marker = `/${marker}`;
      }
      marker = marker.replace('_status_', '/status/');
      return marker;
    },

    // for help in making filename from marker
    // to x-_1neiln63_status_1668610953661886467.json
    // from /scafaria/status/123456
    makeMarkerFileReady: function(marker) {
      return marker.replaceAll('/', '_');
    }
  },

  PUSH_WRITER: {
    // used when writing a line of text...
    appendTimestamp: function(str, timestamp) {
      const dt = (timestamp && !isNaN(parseInt(timestamp))) ? new Date(parseInt(timestamp)) : null;
      return dt ? `${str}${FLAT_RDF_TIME_DELIM}${dt.toISOString()}` : str;
    },
    
    asJson: function(rows, type) {
      if (!rows || rows.length == 0) { return null; }
      const data = {};
      data[SYNCFLOW.DATA_PART.app] = APP_SITE_SHORT;
      data[SYNCFLOW.DATA_PART.version] = SYNCFLOW.SYNC_VERSION;
      data[SYNCFLOW.DATA_PART.type] = type;
      data[SYNCFLOW.DATA_PART.data] = rows;
      return JSON.stringify(data, null, 2);
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
    }
  },

  END_MARKING: {
    calcMarkerEnd: function(step, rows, col) {
      const stepType = step[SYNCFLOW.STEP.type];
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return SYNCFLOW.END_MARKING.calcAutoAdvanceEnd(step, rows, col);
        case SYNCFLOW.STEP_TYPE.profiles:
          return SYNCFLOW.END_MARKING.calcNextAlpha(step, rows, col);
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return SYNCFLOW.END_MARKING.calcNextAlpha(step, rows, col);
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNCFLOW.END_MARKING.calcViaLastRow(step, rows, col);
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNCFLOW.END_MARKING.calcPostRatingsEndMarker(step, rows, col);
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNCFLOW.END_MARKING.calcViaLastRow(step, rows, col);
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNCFLOW.END_MARKING.calcViaLastRow(step, rows, col);
        default:
          console.log('Unhandled restore type');
          return null;
      }
    },
    
    getMarkerColName: function(stepType) {
      switch (stepType) {
        case SYNCFLOW.STEP_TYPE.profileFavorites:
          return null;
        case SYNCFLOW.STEP_TYPE.profiles:
          return null;
        case SYNCFLOW.STEP_TYPE.profileImgs:
          return null;
        case SYNCFLOW.STEP_TYPE.networkFollowings:
        case SYNCFLOW.STEP_TYPE.networkFollowers:
          return SYNC_COL.NETWORK.Handle;
        case SYNCFLOW.STEP_TYPE.postTopicRatings:
          return SYNC_COL.NETWORK.Handle;
        case SYNCFLOW.STEP_TYPE.posts:
          return SYNC_COL.POSTS.MarkerUrlKey;
        case SYNCFLOW.STEP_TYPE.postImgs:
          return SYNC_COL.POSTS.MarkerUrlKey;
        default:
          console.log('Unhandled restore type');
          return null;
      }
    },

    calcAutoAdvanceEnd: function(step) {
      return LAST_TEXT;
    },

    calcNextAlpha: function(step) {
      return STR.hasLen(step.marker) ? STR.nextAlphaMarker(step.marker).toLowerCase() : FIRST_TEXT;
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
  }
};