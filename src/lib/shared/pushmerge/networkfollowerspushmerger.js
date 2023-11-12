var NETWORK_FOLLOWERS_PUSH_MERGER = {
  
  mergeForPush: function(localJson, remoteJson) {
    return PUSH_MERGE_HELPER.mergeBySimpleDistinct(
      localJson, 
      remoteJson, 
      SYNC_COL.NETWORK.Connection, 
      SYNC_COL.NETWORK.Connection,
      SYNCFLOW.STEP_TYPE.networkFollowers);
  }
};