var PROFILES_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    const entDisplay = APPSCHEMA.SocialProfileDisplayName;
    const entDescription = APPSCHEMA.SocialProfileDescription;
    const entDefns = [entDisplay, entDescription];

    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    const displays = records.map(function(x) {
      return {
        s: x[SYNC_COL.PROFILES.Handle], 
        o: x[SYNC_COL.PROFILES.Display], 
        g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph] || APPGRAPHS.MYSELF,
        t: x[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
      };
    });

    const descriptions = records.map(function(x) {
      return {
        s: x[SYNC_COL.PROFILES.Handle], 
        o: x[SYNC_COL.PROFILES.Detail], 
        g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph] || APPGRAPHS.MYSELF,
        t: x[SYNC_COL.PROFILES.DetailTimestamp]
      };
    });

    APPSCHEMA.SAVING.getSubset(set, entDisplay.Name).sogs = displays;
    APPSCHEMA.SAVING.getSubset(set, entDescription.Name).sogs = descriptions;

    return set;
  }
};