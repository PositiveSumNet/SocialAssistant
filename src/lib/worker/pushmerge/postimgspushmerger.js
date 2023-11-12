var POST_IMGS_PUSH_MERGER = {
  
  mergeForPush: function(localJson, remoteJson) {
    if (!STR.hasLen(localJson) || !STR.hasLen(remoteJson)) { return localJson; }
    const localRows = PUSH_MERGE_HELPER.getRows(localJson);
    const remoteRows = PUSH_MERGE_HELPER.getRows(remoteJson);

    const aggRows = [];
    const keys = new Set();

    for (let i = 0; i < localRows.length; i++) {
      let localRow = localRows[i];
      let key = POST_IMGS_PUSH_MERGER.buildKey(localRow);
      if (!keys.has(key)) {
        aggRows.push(localRow);
      }
    }

    for (let i = 0; i < remoteRows.length; i++) {
      let remoteRow = remoteRows[i];
      let key = POST_IMGS_PUSH_MERGER.buildKey(remoteRow);
      if (!keys.has(key)) {
        aggRows.push(remoteRow);
      }
    }

    aggRows = ES6.sortBy(SYNC_COL.POST_IMGS.PostUrlKey);
    const json = SYNCFLOW.PUSH_WRITER.asJson(aggRows, stepType);
    return json;
  },

  // we don't want a massive dictionary by using the raw binary, so we hash it
  buildKey: function(row) {
    return CRYPTO.hash(`${row[SYNC_COL.POST_IMGS.PostUrlKey]}-${SYNC_COL.POST_IMGS.Img}`, CRYPTO.HASH_METHOD.SHA1);
  }
};