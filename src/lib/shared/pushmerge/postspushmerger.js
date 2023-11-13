var POSTS_PUSH_MERGER = {
  
  mergeForPush: function(localJson, remoteJson) {
    return PUSH_MERGE_HELPER.mergeBySubject(
      localJson, 
      remoteJson, 
      POST_SEL.PostUrlKey, 
      POSTS_PUSH_MERGER.mergeWorker,
      POST_SEL.PostTime,
      SYNCFLOW.STEP_TYPE.posts);
  },

  mergeWorker: function(localRow, remoteRow) {
    const mergeUsesLocal = (localRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp] > remoteRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp]);
    const merged = (mergeUsesLocal) ? localRow : remoteRow;

  // our primary concern here is getting the thread right
  if (mergeUsesLocal) {
      POSTS_PUSH_MERGER.adoptThreadKeyAsNeeded(merged, remoteRow);
    }
    else {
      POSTS_PUSH_MERGER.adoptThreadKeyAsNeeded(merged, localRow);
    }
    
    return merged;
  },

  // the thread key is "interesting" when it's not identical to the post key
  // and in a merge scenario we prefer the "earliest" post id number
  adoptThreadKeyAsNeeded: function(merged, adoptFrom) {
    const mThreadKey = merged[POST_SEL.ThreadUrlKey];
    const aThreadKey = adoptFrom[POST_SEL.ThreadUrlKey];

    const mPostKey = merged[POST_SEL.PostUrlKey];
    const aPostKey = adoptFrom[POST_SEL.PostUrlKey];

    if (!STR.hasLen(aThreadKey) || aThreadKey == aPostKey) {
      // these are scenarios where we don't have anything to gain from the other post info
      return;
    }

    if (!STR.hasLen(mThreadKey)) {
      merged[POST_SEL.ThreadUrlKey] = aThreadKey;
    }
    else if (mThreadKey == mPostKey) {
      merged[POST_SEL.ThreadUrlKey] = aThreadKey;
    }
    else {
      const mId = parseInt(STR.getTweetIdFromUrlKey(mThreadKey));
      const aId = parseInt(STR.getTweetIdFromUrlKey(aThreadKey));

      if (!isNaN(mId) && !isNaN(aId) && aId < mId) {
        merged[POST_SEL.ThreadUrlKey] = aThreadKey;
      }
    }
  }
};