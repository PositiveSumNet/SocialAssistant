var PROFILE_FAVORITES_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    const listMemberEntDefn = APPSCHEMA.SocialListMember;
    const entDefns = [listMemberEntDefn];

    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    const listMembers = records.map(function(x) {
      return {
        s: LIST_FAVORITES, 
        o: x[SYNC_COL.FAVORITES.Handle], 
        g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph] || APPGRAPHS.MYSELF,
        t: x[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
      };
    });

    APPSCHEMA.SAVING.getSubset(set, listMemberEntDefn.Name).sogs = listMembers;

    return set;
  }
};