var POST_TOPIC_RATINGS_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    const entTopicRating = APPSCHEMA.SocialPostSubtopicRating;
    const entDefns = [entTopicRating];

    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    const ratings = records.map(function(x) {
      return {
        s: x[SYNC_COL.RATED_POST.PostUrlKey], 
        o: x[SYNC_COL.RATED_POST.Concat], 
        g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph] || APPGRAPHS.MYSELF,
        t: x[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
      };
    });

    APPSCHEMA.SAVING.getSubset(set, entTopicRating.Name).sogs = ratings;

    return set;
  }
};