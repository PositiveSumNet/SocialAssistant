var PUSH_MERGE_HELPER = {
  mergeBySimpleDistinct: function(localJson, remoteJson, distinctBy, sortBy, stepType) {
    if (!STR.hasLen(localJson) || !STR.hasLen(remoteJson)) { return localJson; }
    const localRows = PUSH_MERGE_HELPER.getRows(localJson);
    const remoteRows = PUSH_MERGE_HELPER.getRows(remoteJson);

    let aggRows = [];
    aggRows.push(...localRows);
    const keys = new Set(aggRows.map(function(r) { return r[distinctBy]; }));
    for (let i = 0; i < remoteRows.length; i++) {
      let remoteRow = remoteRows[i];
      let key = remoteRow[distinctBy];
      if (!keys.has(key)) {
        aggRows.push(remoteRow);
        keys.add(key);
      }
    }

    aggRows = ES6.sortBy(aggRows, sortBy);
    const json = SYNCFLOW.PUSH_WRITER.asJson(aggRows, stepType);
    return json;
  },

  mergeBySubject: function(localJson, remoteJson, sProp, fnMergeWorker, sortBy, stepType) {
    if (!STR.hasLen(localJson) || !STR.hasLen(remoteJson)) { return localJson; }
    const localObj = JSON.parse(localJson);
    const remoteObj = JSON.parse(remoteJson);
    if (PUSH_MERGE_HELPER.isRemoteOldVersion(localObj, remoteObj)) { return localJson; }
    const localRows = localObj[SYNCFLOW.DATA_PART.data];
    const remoteRows = remoteObj[SYNCFLOW.DATA_PART.data];
    let aggRows = [];

    const localKeys = new Set(localRows.map(function(r) { return PUSH_MERGE_HELPER.getSubjectGraphKey(r, sProp); }));
    const remoteKeys = new Set(localRows.map(function(r) { return PUSH_MERGE_HELPER.getSubjectGraphKey(r, sProp); }));

    for (let i = 0; i < localRows.length; i++) {
      let localRow = localRows[i];
      let key = PUSH_MERGE_HELPER.getSubjectGraphKey(localRow, sProp);
      if (!remoteKeys.has(key)) {
        // no-merge needed
        aggRows.push(localRow);
      }
      else {
        let remoteRow = remoteRows.find(function(r) { return PUSH_MERGE_HELPER.getSubjectGraphKey(r, sProp) == key; });
        if (remoteRow) {
          let mergedRow = fnMergeWorker(localRow, remoteRow);
          aggRows.push(mergedRow);
        }
        else {
          // no corresponding remote row
          aggRows.push(localRow);
        }
      }
    }

    // remote rows that needed merge were handled; here only pick up those not contained in local set
    for (let i = 0; i < remoteRows.length; i++) {
      let remoteRow = remoteRows[i];
      let key = PUSH_MERGE_HELPER.getSubjectGraphKey(remoteRow, sProp);
      if (!localKeys.has(key)) {
        aggRows.push(remoteRow);
      }
    }

    aggRows = ES6.sortBy(aggRows, sortBy);
    const json = SYNCFLOW.PUSH_WRITER.asJson(aggRows, stepType);
    return json;
  },

  getSubjectGraphKey: function(row, sProp) {
    return `${row[sProp]}-${row[SCHEMA_CONSTANTS.COLUMNS.NamedGraph]}`.toLowerCase();
  },

  getRows: function(json) {
    const obj = JSON.parse(json);
    const rows = obj[SYNCFLOW.DATA_PART.data];
    return rows;
  },

  isRemoteOldVersion: function(localObj, remoteObj) {
    const localVersion = parseInt(localObj[SYNCFLOW.DATA_PART.version]);
    const remoteVersion = parseInt(remoteObj[SYNCFLOW.DATA_PART.version]);
    return !isNaN(remoteVersion) && !isNaN(localVersion) && remoteVersion < localVersion;
  }
};