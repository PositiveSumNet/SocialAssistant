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

  // todo: decouple this from index.js
  UI: {
    logStatus: function(direction, msg) {
      switch (direction) {
        case SYNCFLOW.DIRECTION.BACKUP:
          renderSyncBackupMsg(msg);
        case SYNCFLOW.DIRECTION.RESTORE:
        default:
          renderSyncRestoreMsg(msg);
          break;
      }
    }
  },

  toFriendlyMarker: function(marker) {
    return marker == LAST_TEXT ? 'done!' : marker;
  },

  toFriendlyNetwork: function(network) {
    switch (network) {
      case SYNCFLOW.NETWORK.x:
        return 'Twitter/X';
      case SYNCFLOW.mdon:
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

  startOverSync: async function(direction) {
    SETTINGS.SYNCFLOW.setLastStepType(direction, '');
    SETTINGS.SYNCFLOW.setMarker(direction, '');
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    await SYNCFLOW.resumeSync(direction);
  },

  resumeSync: async function(direction) {
    SETTINGS.SYNCFLOW.setShouldRun(direction, true);
    SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
    await SYNCFLOW.runSyncFlowWorker(direction);
  },

  // resumes where left off
  runSyncFlowWorker: async function(direction) {
    const shouldRun = SETTINGS.SYNCFLOW.getShouldRun(direction);
    if (!shouldRun) {
      console.log('sync is off; exiting');
      SYNCFLOW.UI.logStatus(direction, '');
      return;
    }
    
    const retryInSeconds = SETTINGS.SYNCFLOW.getSecondsToPauseAfterRecentError(direction);
    if (retryInSeconds > 0) {
      SYNCFLOW.UI.logStatus(direction, `Retrying in ${retryInSeconds} seconds`);

      // clear error first
      SETTINGS.SYNCFLOW.resetLastOkLastErr(direction);
      
      setTimeout(() => {
        SYNCFLOW.runSyncFlowWorker();
      }, retryInSeconds * 1000);

      return;
    }

    const lastType = SETTINGS.SYNCFLOW.getLastStepType(direction);
    const lastNetwork = SETTINGS.SYNCFLOW.getLastNetwork(direction);
    const marker = SETTINGS.SYNCFLOW.getMarker(direction);
    const step = SYNCFLOW.getStepToRun(lastType, lastNetwork, marker);

    const properDirection = (direction == SYNCFLOW.DIRECTION.BACKUP) ? 'Backup' : 'Restore';
    if (step == null) {
      // DONE!
      SYNCFLOW.UI.logStatus(direction, `${properDirection} COMPLETE!`);
      return;
    }
    
    const friendlyNetwork = SYNCFLOW.toFriendlyNetwork(step[SYNCFLOW.STEP.network]);
    const friendlyStepType = SYNCFLOW.toFriendlyStepType(step[SYNCFLOW.STEP.type]);
    const friendlyMarker = SYNCFLOW.toFriendlyMarker(step[SYNCFLOW.STEP.marker]);
    const logMsg = `${properDirection} for ${friendlyNetwork} ${friendlyStepType}... ${friendlyMarker} `;
    SYNCFLOW.UI.logStatus(direction, logMsg);

    await SYNCFLOW.runStepWorker(direction, step);

    // pause a bit to breathe, then try for next step (which will exit instead if done)
    setTimeout(async () => {
      await SYNCFLOW.runSyncFlowWorker(direction);
    }, 50);
  },

  runStepWorker: async function(direction, step) {
    switch (direction) {
      case SYNCFLOW.DIRECTION.BACKUP:
        await SYNCFLOW.runBackupWorker(direction, step);
        break;
      case SYNCFLOW.DIRECTION.RESTORE:
      default:
        await SYNCFLOW.runRestoreWorker(direction, step);
        break;
    }
  },

  runBackupWorker: async function(direction, step) {
    const stepType = step[SYNCFLOW.STEP.type];

    // TEMPORARY: simulate that it ran
    const markerAfterStepRun = LAST_TEXT;

    switch (stepType) {
      case SYNCFLOW.STEP_TYPE.profileFavorites:
        // YOU ARE HERE
        
      case SYNCFLOW.STEP_TYPE.profiles:
      case SYNCFLOW.STEP_TYPE.profileImg64s:
      case SYNCFLOW.STEP_TYPE.networkFollowings:
      case SYNCFLOW.STEP_TYPE.networkFollowers:
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
      case SYNCFLOW.STEP_TYPE.posts:
        // temporary
        SYNCFLOW.recordExecutionStep(direction, step, markerAfterStepRun);
        break;
      case SYNCFLOW.STEP_TYPE.postImg64s:
        SYNCFLOW.recordExecutionStep(direction, step, markerAfterStepRun);
        // this is also the last step
        SETTINGS.SYNCFLOW.setCompletedRunOk(direction);
        break;
      default:
        console.log('Unhandled backup type');
        SYNCFLOW.UI.logStatus(SYNCFLOW.DIRECTION.BACKUP, 'Unhandled backup type');
        break;
    }
  },

  runRestoreWorker: async function(step) {
    console.log('todo: restore...');
  },

  recordExecutionStep: function(direction, ranThisStep, reachedThisMarker) {
    console.log(ranThisStep);
    SETTINGS.SYNCFLOW.setLastStepType(direction, ranThisStep[SYNCFLOW.STEP.type]);
    SETTINGS.SYNCFLOW.setLastNetwork(direction, ranThisStep[SYNCFLOW.STEP.network]);
    SETTINGS.SYNCFLOW.setMarker(direction, reachedThisMarker);
    SETTINGS.SYNCFLOW.setCompletedStepOk(direction);
  }
};

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
