var PROFILES_PUSH_MERGER = {
  
  mergeForPush: function(localJson, remoteJson) {
    return PUSH_MERGE_HELPER.mergeBySubject(
      localJson, 
      remoteJson, 
      SYNC_COL.PROFILES.Handle, 
      PROFILES_PUSH_MERGER.mergeWorker,
      SYNC_COL.PROFILES.Handle,
      SYNCFLOW.STEP_TYPE.profiles);
  },

  mergeWorker: function(localRow, remoteRow) {
    // starting with local (as opposed to starting with {}) is defensive in case we forget that new properties have been added
    const merged = localRow;

    if (remoteRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp] > localRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp]) {
      merged[SCHEMA_CONSTANTS.COLUMNS.Timestamp] = remoteRow[SCHEMA_CONSTANTS.COLUMNS.Timestamp];
      merged[SYNC_COL.PROFILES.Display] = remoteRow[SYNC_COL.PROFILES.Display];
    }

    if (!STR.hasLen(localRow[SYNC_COL.PROFILES.Detail]) || remoteRow[SYNC_COL.PROFILES.DetailTimestamp] > localRow[SYNC_COL.PROFILES.DetailTimestamp]) {
      merged[SYNC_COL.PROFILES.DetailTimestamp] = remoteRow[SYNC_COL.PROFILES.DetailTimestamp];
      merged[SYNC_COL.PROFILES.Detail] = remoteRow[SYNC_COL.PROFILES.Detail];
    }

    return merged;
  }
};