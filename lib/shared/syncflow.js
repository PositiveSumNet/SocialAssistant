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
  NETWORK: {
    x,
    mdon
  },
  
  // note that videos are handled separately
  STEP: {
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

  pauseSync: function() {
    SETTINGS.SYNCFLOW.setShouldRun(false);
  },

  resetSync: function() {
    SETTINGS.SYNCFLOW.setLastStepType('');
    SETTINGS.SYNCFLOW.setMarker('');
    SETTINGS.SYNCFLOW.resetLastOkLastErr();
  },

  startSyncFlow: async function() {
    SETTINGS.SYNCFLOW.setShouldRun(true);
    SETTINGS.SYNCFLOW.resetLastOkLastErr();
    await SYNCFLOW.runSyncFlow();
  },

  runSyncFlow: async function() {
    const shouldRun = SETTINGS.SYNCFLOW.getShouldRun();
    if (!shouldRun) {
      console.log('sync is off; exiting');
      return;
    }
    
    const retryInSeconds = SETTINGS.SYNCFLOW.getSecondsToPauseAfterRecentError();
    if (shouldWaitAfterError > 0) {
      console.log(`Retrying in ${retryInSeconds} seconds`);
      
      setTimeout(() => {
        SYNCFLOW.runSyncFlow();
      }, retryInSeconds);

      return;
    }

    const lastType = SETTINGS.SYNCFLOW.getLastStepType();
    const marker = SETTINGS.SYNCFLOW.getMarker();

  }
};