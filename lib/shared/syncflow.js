/*
possumid.json
readme.md
profile
  x
    x-list-favorites.txt
    x-scafaria-profile.json
    img64
      x-scafaria-profile.img64
network
  x
    x-scafaria-following.json
    x-scafaria-followers.json
post
  x
    x-topicallyrated.txt
    x-scafaria_status_12345.json
    img64
      x-scafaria_status_12345.img64         // text file; use new-line to separate multiple images
    video
      x-scafaria_status_12345.mp4
*/

var SYNCFLOW = {
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
    marker: 'marker'
  },

  // todo: decouple this from index.js
  UI: {
    logStatus: function(direction, status) {
      switch (direction) {
        case SYNCFLOW.DIRECTION.BACKUP:
          renderSyncBackupMsg(status);
        case SYNCFLOW.DIRECTION.RESTORE:
        default:
          renderSyncRestoreMsg(status);
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
        msg: 'Ready'
      };
    }
    else {
      lastType = SYNCFLOW.toFriendlyStepType(lastType);
      lastNetwork = SYNCFLOW.toFriendlyNetwork(lastNetwork);
      marker = SYNCFLOW.toFriendlyMarker(marker);
      const properDirection = (direction == SYNCFLOW.DIRECTION.BACKUP) ? 'Backup' : 'Restore';
      const logMsg = `${properDirection} for ${lastNetwork} ${lastType}... ${marker}`;
      // leave 'ok' undefined (we're not planning to show OK nor Fail icon)
      return {
        msg: logMsg
      };
    }
  },

  toFriendlyMarker: function(marker) {
    return marker == LAST_TEXT ? 'file pushed' : marker;
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
  // i.e. saving the tracker locked in a marker that we can simply use here without additional logic.
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
      // fetch next page with same type and same network
      step[SYNCFLOW.STEP.type] = lastType;
      step[SYNCFLOW.STEP.network] = lastNetwork;
      step[SYNCFLOW.STEP.marker] = marker;
      return step;
    }
    else {
      // just increment the step
      step[SYNCFLOW.STEP.type] = ES6.getNext(_syncStepTypes, lastType);
      step[SYNCFLOW.STEP.network] = lastNetwork;
      step[SYNCFLOW.STEP.marker] = marker;
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
      const status = {msg: `Retrying in ${retryInSeconds} seconds`};
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
    SYNCFLOW.UI.logStatus(direction);

    SYNCFLOW.kickoffSyncStep(direction, step);
  },

  kickoffSyncStep: function(direction, step) {
    switch (direction) {
      case SYNCFLOW.DIRECTION.BACKUP:
        SYNCFLOW.kickoffBackupStep(step);
        break;
      case SYNCFLOW.DIRECTION.RESTORE:
      default:
        SYNCFLOW.kickoffRestoreStep(direction, step);
        break;
    }
  },

  kickoffBackupStep: function(step) {
    const stepType = step[SYNCFLOW.STEP.type];
    switch (stepType) {
      case SYNCFLOW.STEP_TYPE.profileFavorites:
        SYNCFLOW.KICKOFF_BACKUP.kbProfileFavorites(step);
        break;
      case SYNCFLOW.STEP_TYPE.profiles:
      case SYNCFLOW.STEP_TYPE.profileImg64s:
      case SYNCFLOW.STEP_TYPE.networkFollowings:
      case SYNCFLOW.STEP_TYPE.networkFollowers:
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
      case SYNCFLOW.STEP_TYPE.posts:
      case SYNCFLOW.STEP_TYPE.postImg64s:
        // TEMPORARY
        const markerAfterStepRun = LAST_TEXT;
        const pushable = {};
        pushable[SYNCFLOW.PUSHABLE.content] = 'ad lorem ipsum';
        pushable[SYNCFLOW.PUSHABLE.filepath] = 'filename.txt';
        pushable[SYNCFLOW.PUSHABLE.marker] = LAST_TEXT;
        SYNCFLOW.ON_FETCH_FOR_BACKUP.placeholderCallback(step, pushable, markerAfterStepRun);
        break;
      default:
        console.log('Unhandled backup type');
        SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.BACKUP, 'Unhandled backup type');
        break;
    }
  },

  kickoffRestoreStep: function(step) {
    console.log('todo: restore...');
  },

  recordExecutionStep: function(direction, ranThisStep, reachedThisMarker) {
    SETTINGS.SYNCFLOW.setLastStepType(direction, ranThisStep[SYNCFLOW.STEP.type]);
    SETTINGS.SYNCFLOW.setLastNetwork(direction, ranThisStep[SYNCFLOW.STEP.network]);
    SETTINGS.SYNCFLOW.setMarker(direction, reachedThisMarker);
    SETTINGS.SYNCFLOW.setCompletedStepOk(direction);
  },

  // called back by worker with content needed for backup
  ON_FETCH_FOR_BACKUP: {
    placeholderCallback: function(step, pushable, markerAfterStepRun) {
      const direction = SYNCFLOW.DIRECTION.BACKUP;
      SYNCFLOW.recordExecutionStep(direction, step, markerAfterStepRun);

      const finalType = _syncStepTypes[_syncStepTypes.length - 1];
      const finalNetwork = _syncNetworks[_syncNetworks.length - 1];
      const completedFullRun = step && step[SYNCFLOW.STEP.type] == finalType && step[SYNCFLOW.STEP.network] == finalNetwork;

      if (completedFullRun == true) {
        SETTINGS.SYNCFLOW.setCompletedRunOk(direction);
      }
      else {
        // pause a bit to breathe, then try for next step (which will exit instead if done)
        setTimeout(() => {
          SYNCFLOW.runSyncFlowWorker(direction);
        }, 50);
      }
    }
  },

  // fetch content from DB
  KICKOFF_BACKUP: {
    kbProfileFavorites: function(step) {
      var pushable = {};
      pushable[SYNCFLOW.PUSHABLE.content] = 'ad lorem ipsum';
      pushable[SYNCFLOW.PUSHABLE.filepath] = 'filename.txt';
      pushable[SYNCFLOW.PUSHABLE.marker] = LAST_TEXT;
      // TEMPORARY
      // call worker and it should result in on_fetch getting called with the data
      const markerAfterStepRun = LAST_TEXT;
      SYNCFLOW.ON_FETCH_FOR_BACKUP.placeholderCallback(step, pushable, markerAfterStepRun);
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
