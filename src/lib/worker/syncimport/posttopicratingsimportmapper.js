var POST_TOPIC_RATINGS_IMPORT_MAPPER = {
  mapSavableSet: function(data) {
    const entTopicRating = APPSCHEMA.SocialPostSubtopicRating;
    const entDefns = [entTopicRating];

    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    // RDF - subject, object, graph, timestamp
    const ratings = records.map(function(x) {
      let topic = x[SYNC_COL.RATED_POST.Topic];
      let subtopic = x[SYNC_COL.RATED_POST.Subtopic];
      let score = x[SYNC_COL.RATED_POST.Rating];
      if (STR.hasLen(topic) && STR.hasLen(subtopic)) {
        let concatSubtopic = TOPICS.concatTopicFullName(topic, subtopic);
        let withRating = STR.concatSubtopicRatingTag(concatSubtopic, score);

        return {
          s: x[SYNC_COL.RATED_POST.PostUrlKey], 
          o: withRating, 
          g: x[SCHEMA_CONSTANTS.COLUMNS.NamedGraph],
          t: x[SCHEMA_CONSTANTS.COLUMNS.Timestamp]
        };
      }
      else {
        return null;
      }
    }).filter(function(r) { return r != null; });

    APPSCHEMA.SAVING.getSubset(set, entTopicRating.Name).sogs = ratings;

    return set;
  }
};