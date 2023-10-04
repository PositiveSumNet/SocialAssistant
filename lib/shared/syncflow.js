/*
possumid.json
readme.md
sync
  profiles
    x
      x-list-favorites.txt
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
      x-topicallyrated.txt
      content
        x-scafaria_status_12345.json
      images
        x-scafaria_status_12345-images.json
      videos
        x-scafaria_status_12345.mp4
*/

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
    profileImg64s: 'profileImg64s',
    // NETWORKS
    networkFollowings: 'networkFollowings',
    networkFollowers: 'networkFollowers',
    // POSTS
    postTopicRatings: 'postTopicRatings',
    posts: 'posts',
    postImg64s: 'postImg64s'
  },

  STEP: {
    type: 'type',
    network: 'network',
    marker: 'marker'
  },

  PUSHABLE: {
    content: 'content',
    filepath: 'filepath',
    startMarker: 'startMarker',
    endMarker: 'endMarker'
  },

  STEP_SECONDS_AGO_DEEMED_RUNNING: 5,

  // todo: decouple this from index.js
  UI: {
    logStatus: function(direction, status) {
      switch (direction) {
        case SYNCFLOW.DIRECTION.BACKUP:
          renderSyncBackupStatus(status);
        case SYNCFLOW.DIRECTION.RESTORE:
        default:
          renderSyncRestoreStatus(status);
          break;
      }
    }
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
    return marker == LAST_TEXT ? 'done' : marker;
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
      case SYNCFLOW.STEP_TYPE.profileImg64s:
        return 'Profile photos';
      case SYNCFLOW.STEP_TYPE.networkFollowings:
        return 'Networks: following';
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return 'Networks: followers';
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
        return 'Rated posts';
      case SYNCFLOW.STEP_TYPE.posts:
        return 'Posts';
      case SYNCFLOW.STEP_TYPE.postImg64s:
        return 'Post images';
      default:
        return '';
    }
  },

  // note: when marker was saved at the end of the prior step run, we recorded the *end* marker.
  getStepToRun: function(lastType, lastNetwork, marker) {
    if (!STR.hasLen(lastNetwork)) {
      lastNetwork = _syncNetworks[0];
    }
    
    const finalStepType = _syncStepTypes[_syncStepTypes.length - 1];
    const finalNetwork = _syncNetworks[_syncNetworks.length - 1];
    
    let step = {};
    if (!STR.hasLen(lastType)) {
      // at the beginning
      step[SYNCFLOW.STEP.type] = _syncStepTypes[0];
      step[SYNCFLOW.STEP.network] = _syncNetworks[0];
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
        step[SYNCFLOW.STEP.type] = _syncStepTypes[0];
        step[SYNCFLOW.STEP.network] = ES6.getNext(_syncNetworks, lastNetwork);
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
      step[SYNCFLOW.STEP.type] = ES6.getNext(_syncStepTypes, lastType);
      step[SYNCFLOW.STEP.network] = lastNetwork;
      step[SYNCFLOW.STEP.marker] = '';
      return step;
    }
  },

  pauseSync: function(direction) {
    SETTINGS.SYNCFLOW.setShouldRun(direction, false);
  },

  startOverSync: function(direction) {
    SETTINGS.SYNCFLOW.setLastStepType(direction, '');
    SETTINGS.SYNCFLOW.setMarker(direction, '');
    SETTINGS.SYNCFLOW.setLastNetwork(direction, '');
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    SYNCFLOW.resumeSync(direction);
  },

  resumeSync: function(direction) {
    if (SETTINGS.SYNCFLOW.getCompletedRunOk(direction) || SETTINGS.SYNCFLOW.getStuckLastErrorWhen(direction)) {
      SETTINGS.SYNCFLOW.setLastStepType(direction, '');
      SETTINGS.SYNCFLOW.setMarker(direction, '');
      SETTINGS.SYNCFLOW.setLastNetwork(direction, '');
    }
    
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    SYNCFLOW.runSyncFlowWorker(direction);
  },

  // resumes where left off
  runSyncFlowWorker: function(direction) {
    const shouldRun = SETTINGS.SYNCFLOW.getShouldRun(direction);
    if (!shouldRun) {
      console.log('sync is off; exiting');
      SYNCFLOW.UI.logStatus(direction);
      return;
    }
    
    const retryInSeconds = SETTINGS.SYNCFLOW.getSecondsToPauseAfterRecentError(direction);
    if (retryInSeconds > 0) {
      const status = {msg: `Retrying in ${retryInSeconds} seconds`, running: true};
      SYNCFLOW.UI.logStatus(direction, status);

      // clear error first
      SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
      
      setTimeout(() => {
        SYNCFLOW.runSyncFlowWorker(direction);
      }, retryInSeconds * 1000);

      return;
    }

    const lastType = SETTINGS.SYNCFLOW.getLastStepType(direction);
    const lastNetwork = SETTINGS.SYNCFLOW.getLastNetwork(direction);
    const marker = SETTINGS.SYNCFLOW.getMarker(direction);
    const step = SYNCFLOW.getStepToRun(lastType, lastNetwork, marker);

    if (step == null) {
      // DONE!
      SYNCFLOW.UI.logStatus(direction);
      return;
    }
    
    // logs info about the prior step
    SYNCFLOW.UI.logStatus(direction);

    SYNCFLOW.kickoffSyncStep(direction, step);
  },

  kickoffSyncStep: function(direction, step) {
    switch (direction) {
      case SYNCFLOW.DIRECTION.BACKUP:
        worker.postMessage({
          actionType: MSGTYPE.TODB.FETCH_FOR_BACKUP,
          step: step
        });
        break;
      case SYNCFLOW.DIRECTION.RESTORE:
        // TODO...
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

  // called back by worker with content needed for backup
  onFetchedForBackup: function(step, pushable) {
    const direction = SYNCFLOW.DIRECTION.BACKUP;
    SYNCFLOW.recordExecutionStep(direction, step, pushable.endMarker);

    const finalType = _syncStepTypes[_syncStepTypes.length - 1];
    const finalNetwork = _syncNetworks[_syncNetworks.length - 1];
    const completedFullRun = step && step[SYNCFLOW.STEP.type] == finalType && step[SYNCFLOW.STEP.network] == finalNetwork;

    if (completedFullRun == true) {
      SETTINGS.SYNCFLOW.setCompletedRunOk(direction);
      SYNCFLOW.UI.logStatus(direction);
    }
    else {
      // pause a bit to breathe, then try for next step (which will exit instead if done)
      setTimeout(() => {
        SYNCFLOW.runSyncFlowWorker(direction);
      }, 50);
    }
  },

  buildPushable: function(step) {
    
    const stepType = step[SYNCFLOW.STEP.type];
    switch (stepType) {
      case SYNCFLOW.STEP_TYPE.profileFavorites:
        return SYNCFLOW.PUSHABLE_BUILDER.buildProfileFavorites(step);
      case SYNCFLOW.STEP_TYPE.profiles:
        return SYNCFLOW.PUSHABLE_BUILDER.buildProfiles(step);
      case SYNCFLOW.STEP_TYPE.profileImg64s:
        return SYNCFLOW.PUSHABLE_BUILDER.buildProfileImg64s(step);
      case SYNCFLOW.STEP_TYPE.networkFollowings:
        return SYNCFLOW.PUSHABLE_BUILDER.buildNetworkFollowings(step);
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return SYNCFLOW.PUSHABLE_BUILDER.buildNetworkFollowers(step);
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
        return SYNCFLOW.PUSHABLE_BUILDER.buildPostTopicRatings(step);
      case SYNCFLOW.STEP_TYPE.posts:
        return SYNCFLOW.PUSHABLE_BUILDER.buildPosts(step);
      case SYNCFLOW.STEP_TYPE.postImg64s:
        return SYNCFLOW.PUSHABLE_BUILDER.buildPostImg64s(step);
      default:
        console.log('Unhandled backup type');
        SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.BACKUP, 'Unhandled backup type');
        return null;
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

  FILE_NAMER: {
    DELIM: '-',
    
    EXT: {
      txt: 'txt',
      json: 'json',
      img64: 'img64',
      mp4: 'mp4'
    },

    PATH_PART: {
      sync: 'sync',
      profiles: 'profiles',
      networks: 'networks',
      posts: 'posts',
      following: 'following',
      followers: 'followers',
      content: 'content',
      images: 'images',
      avatars: 'avatars',
      videos: 'videos'
    },

    getProfileFavoritesFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${DATATYPES.LIST_NAME}${delim}${LIST_FAVORITES}.${SYNCFLOW.FILE_NAMER.EXT.txt}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${fileName}`;
      return fullPath;
    },

    getProfilesFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}${delim}${step.marker}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.content}/${fileName}`;
      return fullPath;
    },

    getProfileImg64sFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.avatars}${delim}${step.marker}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.profiles}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.images}/${fileName}`;
      return fullPath;
    },

    getNetworkFollowingsFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${step.marker}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.following}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.networks}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.following}/${fileName}`;
      return fullPath;
    },

    getNetworkFollowersFilePath: function(step) {
      const network = step.network;
      const delim = SYNCFLOW.FILE_NAMER.DELIM;
      const fileName = `${network}${delim}${step.marker}${delim}${SYNCFLOW.FILE_NAMER.PATH_PART.followers}.${SYNCFLOW.FILE_NAMER.EXT.json}`;
      const fullPath = `${SYNCFLOW.FILE_NAMER.PATH_PART.sync}/${SYNCFLOW.FILE_NAMER.PATH_PART.networks}/${network}/${SYNCFLOW.FILE_NAMER.PATH_PART.followers}/${fileName}`;
      return fullPath;
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

    writeProfileFavorites: function(rows) {
      let txt = '';
      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let handle = row[SYNC_COL.FAVORITES.Handle];
        let timestamp = row[SCHEMA_CONSTANTS.COLUMNS.Timestamp];
        let line = SYNCFLOW.PUSH_WRITER.appendTimestamp(handle, timestamp);
        txt = STR.appendLine(txt, line);
      }

      return txt;
    }
  },

  END_MARKING: {
    calcAutoAdvanceEnd: function(step, rows) {
      return LAST_TEXT;
    },

    calcNextAlpha: function(step) {
      return STR.nextAlphaMarker(step.marker);
    }
  },

  PUSHABLE_BUILDER: {
    buildPushable: function(step, fnDbQuery, fnWriter, fnFileNamer, fnEndMarkerCalcer) {
      const rows = fnDbQuery(step);
      const content = fnWriter(rows);
      const path = fnFileNamer(step);
      const endMarker = fnEndMarkerCalcer(step, rows);
      var pushable = {};

      pushable[SYNCFLOW.PUSHABLE.content] = content;
      pushable[SYNCFLOW.PUSHABLE.filepath] = path;
      pushable[SYNCFLOW.PUSHABLE.startMarker] = step.marker;
      pushable[SYNCFLOW.PUSHABLE.endMarker] = endMarker;
      return pushable;
    },
    
    buildProfileFavorites: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildPushable(
        step, 
        CONNFETCHER.SYNC.getFavorites, 
        SYNCFLOW.PUSH_WRITER.writeProfileFavorites,
        SYNCFLOW.FILE_NAMER.getProfileFavoritesFilePath,
        SYNCFLOW.END_MARKING.calcAutoAdvanceEnd);
    },

    buildProfiles: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildPushable(
        step, 
        CONNFETCHER.SYNC.getProfiles, 
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getProfilesFilePath,
        SYNCFLOW.END_MARKING.calcNextAlpha);
    },

    buildProfileImg64s: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildPushable(
        step, 
        CONNFETCHER.SYNC.getProfileImg64s,
        SYNCFLOW.PUSH_WRITER.asJson,
        SYNCFLOW.FILE_NAMER.getProfileImg64sFilePath,
        SYNCFLOW.END_MARKING.calcNextAlpha);
    },

    buildNetworkFollowings: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildDummyPushable(step);
    },

    buildNetworkFollowers: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildDummyPushable(step);
    },

    buildPostTopicRatings: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildDummyPushable(step);
    },

    buildPosts: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildDummyPushable(step);
    },

    buildPostImg64s: function(step) {
      return SYNCFLOW.PUSHABLE_BUILDER.buildDummyPushable(step);
    },

    buildDummyPushable: function(step) {
      var pushable = {};
      pushable[SYNCFLOW.PUSHABLE.content] = 'ad lorem ipsum';
      pushable[SYNCFLOW.PUSHABLE.filepath] = 'filename.txt';
      pushable[SYNCFLOW.PUSHABLE.startMarker] = step.marker;
      pushable[SYNCFLOW.PUSHABLE.endMarker] = LAST_TEXT;
      return pushable;
    }
  }
};

// these are at the bottom so they can be referenced above
// ordered
var _syncStepTypes = [
  SYNCFLOW.STEP_TYPE.profileFavorites,
  SYNCFLOW.STEP_TYPE.profiles,
  SYNCFLOW.STEP_TYPE.profileImg64s,
  SYNCFLOW.STEP_TYPE.networkFollowings,
  SYNCFLOW.STEP_TYPE.networkFollowers,
  SYNCFLOW.STEP_TYPE.postTopicRatings,
  SYNCFLOW.STEP_TYPE.posts,
  SYNCFLOW.STEP_TYPE.postImg64s
];

var _syncNetworks = [
  SYNCFLOW.NETWORK.x,
  SYNCFLOW.NETWORK.mdon
];
