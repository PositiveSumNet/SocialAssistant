var PROFILE_IMGS_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    const entCdnUrl = APPSCHEMA.SocialProfileImgSourceUrl;
    const entBinary = APPSCHEMA.SocialProfileImgBinary;
    const entDefns = [entCdnUrl, entBinary];

    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    const cdnUrls = records
    .filter(function(r) {
      return !STR.isTruthy(r[SYNC_COL.PROFILE_IMGS.IsB64]); 
    })
    .map(function(x) {
      return PROFILE_IMGS_IMPORT_MAPPER.mapRecord(x);
    });

    const binaryUrls = records
    .filter(function(r) {
      return STR.isTruthy(r[SYNC_COL.PROFILE_IMGS.IsB64]); 
    })
    .map(function(x) {
      return PROFILE_IMGS_IMPORT_MAPPER.mapRecord(x);
    });

    APPSCHEMA.SAVING.getSubset(set, entCdnUrl.Name).sogs = cdnUrls;
    APPSCHEMA.SAVING.getSubset(set, entBinary.Name).sogs = binaryUrls;

    return set;
  },

  mapRecord: function(x) {
    return {
      s: x[SYNC_COL.PROFILE_IMGS.Handle],
      o: x[SYNC_COL.PROFILE_IMGS.Img],
      g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph],
      t: x[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
    };
  }
};