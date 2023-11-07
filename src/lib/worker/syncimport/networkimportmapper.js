var NETWORK_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    const connEntDefn = NETWORK_IMPORT_MAPPER.getConnEntity(data);
    const entDefns = [connEntDefn];

    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    const connections = records.map(function(x) {
      return {
        s: x[SYNC_COL.NETWORK.Handle], 
        o: x[SYNC_COL.NETWORK.Connection], 
        g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph] || APPGRAPHS.MYSELF,
        t: x[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
      };
    });

    APPSCHEMA.SAVING.getSubset(set, connEntDefn.Name).sogs = connections;

    return set;
  },

  getConnEntity: function(data) {
    const type = data.type;
    switch (type) {
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return APPSCHEMA.SocialConnHasFollower;
      case SYNCFLOW.STEP_TYPE.networkFollowings:
        return APPSCHEMA.SocialConnIsFollowing;
      default:
        throw('unexpected connection data type');
    }
  }
};