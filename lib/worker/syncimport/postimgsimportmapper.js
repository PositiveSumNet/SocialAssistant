var POST_IMGS_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    
    // see getPostImageEntities
    const entDefns = [
      APPSCHEMA.SocialPostCardImgBinary,
      APPSCHEMA.SocialPostCardImgSourceUrl,
      APPSCHEMA.SocialPostRegImgBinary,
      APPSCHEMA.SocialPostRegImgSourceUrl
    ];
    
    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      // per SYNC.getPostImgs, ent defn name is the "type" property
      let type = record[SYNC_COL.POST_IMGS.Type];
      let entDefn = entDefns.find(function(e) { return e.Name == type; });
      let subset = APPSCHEMA.SAVING.getSubset(set, entDefn.Name);
      let mapped = POST_IMGS_IMPORT_MAPPER.mapRecord(record);
      subset.sogs.push(mapped);
    }

    return set;
  },

  mapRecord: function(record) {
    return {
      s: record[SYNC_COL.POST_IMGS.PostUrlKey],
      o: record[SYNC_COL.POST_IMGS.Img],
      g: record[SCHEMA_CONSTANTS.COLUMNS.NamedGraph],
      t: record[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
    };
  }
};