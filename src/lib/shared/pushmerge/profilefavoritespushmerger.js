var PROFILE_FAVORITES_PUSH_MERGER = {
  
  mergeForPush: function(localJson, remoteJson) {
    return PUSH_MERGE_HELPER.mergeBySimpleDistinct(
      localJson, 
      remoteJson, 
      SYNC_COL.FAVORITES.Handle, 
      SYNC_COL.FAVORITES.Handle,
      SYNCFLOW.STEP_TYPE.profileFavorites);
  }
};