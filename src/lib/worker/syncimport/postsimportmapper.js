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
      mapper.mapPostWorker(set, record);
      // quote tweet
      if (record[POST_SEL.QuoteTweet]) {
        mapper.mapPostWorker(set, record[POST_SEL.QuoteTweet], record);
      }
      // reply tweet
      if (record[POST_SEL.ReplyToTweet]) {
        mapper.mapPostWorker(set, record[POST_SEL.ReplyToTweet], record);
      }
    }
    
    return set;
  },

  mapPostWorker: function(set, record, parentRecord) {
    const mapper = POSTS_IMPORT_MAPPER; // just to abbreviate
      // the select columns of SYNC.getPosts
      mapper.attachPostAttr(POST_SEL.PostTime, APPSCHEMA.SocialPostTime, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.AuthorHandle, APPSCHEMA.SocialPostAuthorHandle, set, record, parentRecord);
      mapper.attachAuthorName(set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.PostText, APPSCHEMA.SocialPostText, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.ReplyToUrlKey, APPSCHEMA.SocialPostReplyToUrlKey, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.ReposterHandle, APPSCHEMA.SocialPostReposter, set, record, parentRecord);
      mapper.attachReposterName(set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.QuoteOfUrlKey, APPSCHEMA.SocialPostQuoteOf, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.ThreadUrlKey, APPSCHEMA.SocialPostThreadUrlKey, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.EmbedsVideo, APPSCHEMA.SocialPostEmbedsVideo, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.CardText, APPSCHEMA.SocialPostCardText, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.ReplyCount, APPSCHEMA.SocialPostReplyCount, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.LikeCount, APPSCHEMA.SocialPostLikeCount, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.ReshareCount, APPSCHEMA.SocialPostReshareCount, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.CardShortUrl, APPSCHEMA.SocialPostCardShortUrl, set, record, parentRecord);
      mapper.attachPostAttr(POST_SEL.CardFullUrl, APPSCHEMA.SocialPostCardFullUrl, set, record, parentRecord);
      // the more interesting mappings
      mapper.attachSearchBlob(set, record, parentRecord);
      mapper.attachCardSearchBlob(set, record, parentRecord);
  },

  attachSearchBlob: function(set, record, parentRecord) {
    const urlKey = record[POST_SEL.PostUrlKey];
    const authorHandle = record[POST_SEL.AuthorHandle];
    const authorName = record[POST_SEL.AuthorName];
    const postText = record[POST_SEL.PostText];
    let qtAuthorHandle;
    let qtAuthorName;
    let qtPostText;

    let qt = record[POST_SEL.QuoteTweet];
    if (qt) {
      qtAuthorHandle = qt[POST_SEL.AuthorHandle];
      qtAuthorName = qt[POST_SEL.AuthorName];
      qtPostText = qt[POST_SEL.PostText];
    }
    
    const searchBlob = TWEET_SAVE_MAPPER.buildSearchBlob(urlKey, authorHandle, authorName, postText, qtAuthorHandle, qtAuthorName, qtPostText);
    
    const mapped = {
      s: record[POST_SEL.PostUrlKey],
      o: searchBlob,
      g: POSTS_IMPORT_MAPPER.getGraph(record, parentRecord),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostSearchBlob.Name).sogs.push(mapped);
  },

  attachCardSearchBlob: function(set, record, parentRecord) {
    const urlKey = record[POST_SEL.PostUrlKey];
    
    const cardText = record[POST_SEL.CardText];
    if (!STR.hasLen(cardText)) {
      return;
    }

    const cardFullUrl = record[POST_SEL.CardFullUrl];

    const searchBlob = TCARD_SAVE_MAPPER.buildCardSearchBlob(urlKey, cardText, cardFullUrl);
    
    const mapped = {
      s: record[POST_SEL.PostUrlKey],
      o: searchBlob,
      g: POSTS_IMPORT_MAPPER.getGraph(record, parentRecord),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardSearchBlob.Name).sogs.push(mapped);
  },

  attachAuthorName: function(set, record, parentRecord) {
    const sHandle = record[POST_SEL.AuthorHandle]; 
    const oValue = record[POST_SEL.AuthorName];
    if (!sHandle || !oValue) { return; }

    const mapped = {
      s: sHandle,
      o: oValue,
      g: POSTS_IMPORT_MAPPER.getGraph(record, parentRecord),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDisplayName.Name).sogs.push(mapped);
  },

  attachReposterName: function(set, record, parentRecord) {
    const sHandle = record[POST_SEL.ReposterHandle]; 
    const oValue = record[POST_SEL.ReposterName];
    if (!sHandle || !oValue) { return; }

    const mapped = {
      s: sHandle,
      o: oValue,
      g: POSTS_IMPORT_MAPPER.getGraph(record, parentRecord),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDisplayName.Name).sogs.push(mapped);
  },

  // where PostUrlKey is the subject
  attachPostAttr: function(column, entDefn, set, record, parentRecord) {
    const mapped = POSTS_IMPORT_MAPPER.buildPostSog(record, column, parentRecord);
    if (!mapped) { return; }
    APPSCHEMA.SAVING.getSubset(set, entDefn.Name).sogs.push(mapped);
  },

  buildPostSog: function(record, column, parentRecord) {
    const oValue = record[column];
    if (!oValue) { return null; }
    return {
      s: record[POST_SEL.PostUrlKey],
      o: oValue,
      g: POSTS_IMPORT_MAPPER.getGraph(record, parentRecord),
      t: POSTS_IMPORT_MAPPER.getTimestamp(record)
    };
  },

  // we aren't bothering with a separate timestamp per component entity
  getTimestamp: function(record) {
    return record[SCHEMA_CONSTANTS.COLUMNS.Timestamp];
  },

  // we aren't bothering with a separate graph per component entity
  getGraph: function(record, parentRecord) {
    let graph = record[SCHEMA_CONSTANTS.COLUMNS.NamedGraph];
    if (!STR.hasLen(graph) && parentRecord) {
      graph = parentRecord[SCHEMA_CONSTANTS.COLUMNS.NamedGraph];
    }
    return graph;
  }
};