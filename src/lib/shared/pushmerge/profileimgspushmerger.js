var PROFILE_IMGS_PUSH_MERGER = {
    
  mergeForPush: function(localJson, remoteJson) {
    return PUSH_MERGE_HELPER.mergeBySubject(
      localJson, 
      remoteJson, 
      SYNC_COL.PROFILE_IMGS.Handle, 
      PROFILE_IMGS_PUSH_MERGER.mergeWorker,
      SYNC_COL.PROFILE_IMGS.Handle,
      SYNCFLOW.STEP_TYPE.profileImgs);
  },

  mergeWorker: function(localRow, remoteRow) {
    return (remoteRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp] > localRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp])
      ? remoteRow
      : localRow;
  }
};