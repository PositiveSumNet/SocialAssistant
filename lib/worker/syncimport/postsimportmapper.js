var POSTS_IMPORT_MAPPER = {
  mapSavableSet: function(data) {

    const entDefns = [
      // author
      APPSCHEMA.SocialPostAuthorHandle,
      APPSCHEMA.SocialProfileDisplayName,
      // post
      APPSCHEMA.SocialPostTime,
      APPSCHEMA.SocialPostText,
      APPSCHEMA.SocialPostReplyToUrlKey,
      APPSCHEMA.SocialPostReposter,
      APPSCHEMA.SocialPostQuoteOf,
      APPSCHEMA.SocialPostThreadUrlKey,
      APPSCHEMA.SocialPostSearchBlob,
      APPSCHEMA.SocialPostEmbedsVideo,
      // card
      APPSCHEMA.SocialPostCardSearchBlob,
      APPSCHEMA.SocialPostCardText,
      APPSCHEMA.SocialPostCardShortUrl,
      APPSCHEMA.SocialPostCardFullUrl,
      // stats
      APPSCHEMA.SocialPostReplyCount,
      APPSCHEMA.SocialPostLikeCount,
      APPSCHEMA.SocialPostReshareCount
    ];
    
    // passing true for onlyIfNewer because this is a sync context
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, true);
    const records = data.data;  // data node holds the records
    
    const mapper = POSTS_IMPORT_MAPPER; // just to abbreviate
    // RDF - subject, object, graph, timestamp
    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      // the select columns of SYNC.getPosts
      mapper.attachPostAttr(POST_SEL.PostTime, APPSCHEMA.SocialPostTime, set, record);
      mapper.attachPostAttr(POST_SEL.AuthorHandle, APPSCHEMA.SocialPostAuthorHandle, set, record);
      mapper.attachAuthorName(set, record);
      mapper.attachPostAttr(POST_SEL.PostText, APPSCHEMA.SocialPostText, set, record);
      mapper.attachPostAttr(POST_SEL.ReplyToUrlKey, APPSCHEMA.SocialPostReplyToUrlKey, set, record);
      mapper.attachPostAttr(POST_SEL.ReposterHandle, APPSCHEMA.SocialPostReposter, set, record);
      mapper.attachReposterName(set, record);
      mapper.attachPostAttr(POST_SEL.QuoteOfUrlKey, APPSCHEMA.SocialPostQuoteOf, set, record);
      mapper.attachPostAttr(POST_SEL.ThreadUrlKey, APPSCHEMA.SocialPostThreadUrlKey, set, record);
      mapper.attachPostAttr(POST_SEL.EmbedsVideo, APPSCHEMA.SocialPostEmbedsVideo, set, record);
      mapper.attachPostAttr(POST_SEL.CardText, APPSCHEMA.SocialPostCardText, set, record);
      mapper.attachPostAttr(POST_SEL.ReplyCount, APPSCHEMA.SocialPostReplyCount, set, record);
      mapper.attachPostAttr(POST_SEL.LikeCount, APPSCHEMA.SocialPostLikeCount, set, record);
      mapper.attachPostAttr(POST_SEL.ReshareCount, APPSCHEMA.SocialPostReshareCount, set, record);
      mapper.attachPostAttr(POST_SEL.CardShortUrl, APPSCHEMA.SocialPostCardShortUrl, set, record);
      mapper.attachPostAttr(POST_SEL.CardFullUrl, APPSCHEMA.SocialPostCardFullUrl, set, record);
    }

    return set;
  },

  attachAuthorName: function(set, record) {
    const sHandle = record[POST_SEL.AuthorHandle]; 
    const oValue = record[POST_SEL.AuthorName];
    if (!sHandle || !oValue) { return; }

    const mapped = {
      s: sHandle,
      o: oValue,
      g: POSTS_IMPORT_MAPPER.getGraph(record),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDisplayName.Name).sogs.push(mapped);
  },

  attachReposterName: function(set, record) {
    const sHandle = record[POST_SEL.ReposterHandle]; 
    const oValue = record[POST_SEL.ReposterName];
    if (!sHandle || !oValue) { return; }

    const mapped = {
      s: sHandle,
      o: oValue,
      g: POSTS_IMPORT_MAPPER.getGraph(record),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDisplayName.Name).sogs.push(mapped);
  },

  // where PostUrlKey is the subject
  attachPostAttr: function(column, entDefn, set, record) {
    const mapped = POSTS_IMPORT_MAPPER.buildPostSog(record, column);
    if (!mapped) { return; }
    APPSCHEMA.SAVING.getSubset(set, entDefn.Name).sogs.push(mapped);
  },

  buildPostSog: function(record, column) {
    const oValue = record[column];
    if (!oValue) { return null; }
    return {
      s: record[POST_SEL.PostUrlKey],
      o: oValue,
      g: POSTS_IMPORT_MAPPER.getGraph(record),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };
  },

  // we aren't bothering with a separate timestamp per component entity
  getTimestamp: function(record) {
    return record[SCHEMA_CONSTANTS.COLUMNS.Timestamp];
  },

  // we aren't bothering with a separate graph per component entity
  getGraph: function(record) {
    return record[SCHEMA_CONSTANTS.COLUMNS.NamedGraph];
  }
};