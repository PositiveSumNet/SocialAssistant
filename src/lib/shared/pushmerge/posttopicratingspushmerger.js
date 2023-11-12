var POST_TOPIC_RATINGS_PUSH_MERGER = {
  
  mergeForPush: function(localJson, remoteJson) {
    return PUSH_MERGE_HELPER.mergeBySimpleDistinct(
      localJson, 
      remoteJson, 
      SYNC_COL.RATED_POST.PostUrlKey, 
      SYNC_COL.RATED_POST.PostUrlKey,
      SYNCFLOW.STEP_TYPE.postTopicRatings);
  }
};