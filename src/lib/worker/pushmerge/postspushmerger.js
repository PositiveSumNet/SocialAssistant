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

  adoptThreadKeyAsNeeded: function(merged, adoptFrom) {
    if (STR.hasLen(merged[POST_SEL.ThreadUrlKey]) && merged[POST_SEL.ThreadUrlKey] != merged[POST_SEL.PostUrlKey]) {
      // we already have a thread (that isn't simply the post url key)
      return;
    }

    if (STR.hasLen(adoptFrom[POST_SEL.ThreadUrlKey]) && adoptFrom[POST_SEL.ThreadUrlKey] != adoptFrom[POST_SEL.PostUrlKey]) {
      merged[POST_SEL.ThreadUrlKey] = adoptFrom[POST_SEL.ThreadUrlKey];
    }
  }
};