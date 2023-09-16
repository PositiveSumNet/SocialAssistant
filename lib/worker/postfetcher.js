// request columns
var POSTREQUEST = {
  // shared with NETWORK_SEARCH
  pageType: 'pageType',
  networkOwner: 'networkOwner',
  skip: 'skip',
  take: 'take',
  graph: 'graph'
};

var SPECIFIC_URL_KEYS_AS = {
  GET_THESE: 'getThese',
  GET_NEXT_REPLIES: 'getNextReplies'
};

var POSTFETCHER = {
  
  // suggesting a single owner on init
  suggestOwner: function(data) {
    const rows = POSTFETCHER.searchOwners(data);
    
    if (rows.length === 1) {
      postMessage({ 
        type: MSGTYPE.FROMDB.RENDER.SUGGESTED_OWNER,
        payload: { 
          owner: rows[0]
        }
      });
    }
  },

  // find owners matching the search
  inputOwner: function(data) {
    const rows = POSTFETCHER.searchOwners(data);
    
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS,
      payload: { 
        owners: rows
      }
    });
  },

  // search across authors
  // passes back results (caller should post message back to UI)
  searchOwners: function(data) {
    const limit = data.limit || 1;
    const searchText = data.searchText || '';

    // author
    const entAuthorHandle = APPSCHEMA.SocialPostAuthorHandle;
    const entProfileName = APPSCHEMA.SocialProfileDisplayName;
    const entProfileImgCdnUrl = APPSCHEMA.SocialProfileImgSourceUrl;
    const entProfileImg64Url = APPSCHEMA.SocialProfileImgBinary;

    const bind = [];
    let conjunction = 'WHERE';

    // prefixes
    const ahandle = 'ahandle';
    const aname = 'aname';
    const acdnurl = 'acdnurl';
    const a64url = 'a64url';

    const searchCols = [
      `${ahandle}.${entAuthorHandle.ObjectCol}`, 
      `${aname}.${entProfileName.ObjectCol}`
    ];

    const searchClause = DBORM.QUERYING.writeSearchClause(searchCols, searchText, conjunction, bind.length);
    let searchClauseSql = '';
    
    if (searchClause && searchClause.sql.length > 0) {
      searchClauseSql = searchClause.sql;
      bind.push(...searchClause.parms);
    }

    const sql = `
    SELECT x.*
    FROM (
      SELECT  ${ahandle}.${entAuthorHandle.ObjectCol} AS ${PERSON_ATTR.HANDLE}, 
              MAX(${aname}.${entProfileName.ObjectCol}) AS ${PERSON_ATTR.DISPLAY_NAME}, 
              MAX(${acdnurl}.${entProfileImgCdnUrl.ObjectCol}) AS ${PERSON_ATTR.IMG_CDN_URL}, 
              MAX(${a64url}.${entProfileImg64Url.ObjectCol}) AS ${PERSON_ATTR.IMG_64_URL},
              COUNT(DISTINCT ${ahandle}.${entAuthorHandle.ObjectCol}) AS Cnt
      FROM ${entAuthorHandle.Name} ${ahandle}
      LEFT JOIN ${entProfileName.Name} ${aname} ON ${aname}.${entProfileName.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      LEFT JOIN ${entProfileImgCdnUrl.Name} ${acdnurl} ON ${acdnurl}.${entProfileImgCdnUrl.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      LEFT JOIN ${entProfileImg64Url.Name} ${a64url} ON ${a64url}.${entProfileImg64Url.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      ${searchClauseSql}
      GROUP BY ${ahandle}.${entAuthorHandle.ObjectCol}
    ) x
    ORDER BY x.Cnt DESC
    LIMIT ${limit};
    `;
  
    const bound = DBORM.QUERYING.bindConsol(bind);
    const rows = DBORM.QUERYING.fetch(sql, bound);
    return rows;
  },
  
  ensureInUseTopicsFilter: function() {
    let dt = Date.now();
    const oValue = APPSCHEMA.SocialPostSubtopicRating.ObjectCol;

    const sql = `
    SELECT DISTINCT ${oValue}
    FROM ${APPSCHEMA.SocialPostSubtopicRating.Name};
    `;

    const bind = [];
    const bound = DBORM.QUERYING.bindConsol(bind);
    const rows = DBORM.QUERYING.fetch(sql, bound);
    
    // distinct set that excludes the "-123" rating suffix
    const justNames = new Set();
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      let splat = STR.splitSubtopicRatingTag(row[oValue]);
      if (splat && STR.hasLen(splat.subtopic)) {
        justNames.add(splat.subtopic);
      }
    }

    const names = Array.from(justNames).sort();
    console.log(`${Date.now() - dt} ms for in-use topics`);

    // post back to UI
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.INUSE_TOPICS,
      payload: names
    });  
  },

  postSearch: function(request) {
    let dt = Date.now();
    const rows = POSTFETCHER.postSearchWorker(request);
    POSTFETCHER.infuseQuoteAndReplyToTweets(request, rows);
    console.log(`${Date.now() - dt} ms`);
    // post back to UI
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.POST_STREAM,
      payload: { 
        request: request, 
        rows: rows
        }
    });  
  },

  infuseQuoteAndReplyToTweets: function(request, rows) {
    const qtKeys = rows
      .filter(function(row) { return STR.hasLen(row[POST_SEL.QuoteOfUrlKey]); } )
      .map(function(row) { return row[POST_SEL.QuoteOfUrlKey]; });
    
    const rtKeys = rows
      .filter(function(row) { return STR.hasLen(row[POST_SEL.ReplyToUrlKey]); } )
      .map(function(row) { return row[POST_SEL.ReplyToUrlKey]; });
    
    let relKeys = [];
    relKeys.push(...qtKeys);
    relKeys.push(...rtKeys);
    relKeys = ES6.distinctify(relKeys);

    if (relKeys.length === 0) { return; }

    const exKeySet = new Set(rows.map(function(row) { return row[POST_SEL.PostUrlKey]; }));
    const neededKeys = relKeys.filter(function(rk) { return !exKeySet.has(rk); });

    const fetchRequest = { pageType: request.pageType };
    const fetchedRows = POSTFETCHER.postSearchWorker(fetchRequest, neededKeys);

    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      let qtKey = row[POST_SEL.QuoteOfUrlKey];
      if (STR.hasLen(qtKey)) {
        let qtRow = fetchedRows.find(function(q) { return q[POST_SEL.PostUrlKey] == qtKey}) || rows.find(function(q) { return q[POST_SEL.PostUrlKey] == qtKey});
        if (qtRow) {
          row[POST_SEL.QuoteTweet] = qtRow;
        }
      }
      let rtKey = row[POST_SEL.ReplyToUrlKey];
      if (STR.hasLen(rtKey)) {
        let rtRow = fetchedRows.find(function(q) { return q[POST_SEL.PostUrlKey] == rtKey}) || rows.find(function(q) { return q[POST_SEL.PostUrlKey] == rtKey});
        if (rtRow) {
          row[POST_SEL.ReplyToTweet] = rtRow;
        }
      }
    }
  },

  // urlKeysAs is SPECIFIC_URL_KEYS_AS
  postSearchWorker: function(request, specificUrlKeys, urlKeysAs) {
    const skip = request.skip || 0;
    const take = request.take || 50;

    // for now we assume all are via contributor 'MYSELF' (otherwise we'll need group by etc.)
    const graphFilter = request.graph || APPGRAPHS.getGraphByPageType(request.pageType);
    const graphMatchRhs = `${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'`;

    // author
    const entAuthorHandle = APPSCHEMA.SocialPostAuthorHandle;
    const entProfileName = APPSCHEMA.SocialProfileDisplayName;
    const entProfileImgCdnUrl = APPSCHEMA.SocialProfileImgSourceUrl;
    const entProfileImg64Url = APPSCHEMA.SocialProfileImgBinary;
    // post
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entPostText = APPSCHEMA.SocialPostText;
    const entReplyToUrlKey = APPSCHEMA.SocialPostReplyToUrlKey;
    const entReposter = APPSCHEMA.SocialPostReposter;
    const entQuoteOf = APPSCHEMA.SocialPostQuoteOf;
    const entSearchBlob = APPSCHEMA.SocialPostSearchBlob;
    // card
    const entCardSearchBlob = APPSCHEMA.SocialPostCardSearchBlob;
    const entCardText = APPSCHEMA.SocialPostCardText;
    const entCardShortUrl = APPSCHEMA.SocialPostCardShortUrl;
    const entCardFullUrl = APPSCHEMA.SocialPostCardFullUrl;
    const entCardImgCdnUrl = APPSCHEMA.SocialPostCardImgSourceUrl;
    const entCardImg64Url = APPSCHEMA.SocialPostCardImgBinary;
    // stats
    const entStatReplyCount = APPSCHEMA.SocialPostReplyCount;
    const entStatLikeCount = APPSCHEMA.SocialPostLikeCount;
    const entStatReshareCount = APPSCHEMA.SocialPostReshareCount;

    // prefixes
    const ahandle = 'ahandle';
    const aname = 'aname';
    const acdnurl = 'acdnurl';
    const a64url = 'a64url';
    const ptime = 'ptime';
    const ptext = 'ptext';
    const preplykey = 'preplykey';
    const preposter = 'preposter';
    const preponame = 'preponame';
    const pquoteof = 'pquoteof';
    const psrch = 'psrch';
    const csrch = 'csrch';
    const ctext = 'ctext';
    const cshorturl = 'cshorturl';
    const cfullurl = 'cfullurl';
    const ccdnurl = 'ccdnurl';
    const c64url = 'c64url';
    const sreplycnt = 'sreplycnt';
    const slikecnt = 'slikecnt';
    const sresharecnt = 'sresharecnt';

    const searchCols = [
      `${psrch}.${entSearchBlob.ObjectCol}`,
      `${csrch}.${entCardSearchBlob.ObjectCol}`
    ];

    const bind = [];
    let urlKeyCondition = '';
    let authorCondition = '';
    let topicCondition = '';
    let searchClauseSql = '';
    let orderBy = '';
    let paging = `LIMIT ${take} OFFSET ${skip}`;
    let replyToJoinWord = 'LEFT JOIN';

    if (specificUrlKeys && specificUrlKeys.length === 0) {
      return [];
    }
    else if (specificUrlKeys && specificUrlKeys.length > 0) {
      let urlKeyParms = [];
      for (let i = 0; i < specificUrlKeys.length; i++) {
        let parm = {key: `$uk_${i}`, value: specificUrlKeys[i]};
        urlKeyParms.push(parm);
        bind.push(parm);
      }
      const delimUrlKeyParms = urlKeyParms.map(function(p) { return p.key; }).join(', ');

      switch (urlKeysAs) {
        case SPECIFIC_URL_KEYS_AS.GET_NEXT_REPLIES:
          replyToJoinWord = 'JOIN';
          urlKeyCondition = `  AND ${preplykey}.${entReplyToUrlKey.ObjectCol} IN ( ${delimUrlKeyParms} )`;
          break;
        case SPECIFIC_URL_KEYS_AS.GET_THESE:
          default:
            urlKeyCondition = `  AND ${ptime}.${entPostTime.SubjectCol} IN ( ${delimUrlKeyParms} )`;
            paging = '';
            break;
      }
    }
    else {
      const bindLenPreSearch = bind.length;
      const searchClause = DBORM.QUERYING.writeSearchClause(searchCols, request.searchText, 'AND', bindLenPreSearch);
      if (searchClause) {
        searchClauseSql = searchClause.sql;
        bind.push(...searchClause.parms);
      }
      
      if (STR.hasLen(request.topic)) {
        // the rated tag is stored as e.g. 'Environment: Climate-2' for a 2-star rating
        const topicParm = {key: `$topic`, value: `${request.topic}${SUBTOPIC_RATING_DELIM}%`};
        bind.push(topicParm);

        topicCondition = POSTFETCHER.writeTopicCondition(topicParm);
      }

      switch (request.orderBy) {
        case ORDER_BY.POST_REPLY_COUNT_DESC:
          orderBy = `ORDER BY ${sreplycnt}.${entPostTime.ObjectCol} DESC`;
          break;
        case ORDER_BY.POST_LIKE_COUNT_DESC:
          orderBy = `ORDER BY ${slikecnt}.${entPostTime.ObjectCol} DESC`;
          break;
        case ORDER_BY.POST_RESHARE_COUNT_DESC:
          orderBy = `ORDER BY ${sresharecnt}.${entPostTime.ObjectCol} DESC`;
          break;
        case ORDER_BY.POST_TIME_DESC:
        default:
          orderBy = `ORDER BY ${ptime}.${entPostTime.ObjectCol} DESC`;
          break;
      }

      if (STR.hasLen(request.networkOwner)) {
        if (request.withRetweets == true) {
          authorCondition = `  AND CASE
                                  WHEN ${ahandle}.${entAuthorHandle.ObjectCol} = $author THEN 1
                                  WHEN ${preposter}.${entReposter.ObjectCol} = $author THEN 1
                                  ELSE 0
                                END = 1
                            `;
        }
        else {
          authorCondition = `  AND ${ahandle}.${entAuthorHandle.ObjectCol} = $author`;
        }
        bind.push({key: '$author', value: request.networkOwner});
      }
    }

    const sql = `
    SELECT  ${ptime}.${entPostTime.SubjectCol} AS ${POST_SEL.PostUrlKey},
            ${ptime}.${entPostTime.ObjectCol} AS ${POST_SEL.PostTime},
            ${ahandle}.${entAuthorHandle.ObjectCol} AS ${POST_SEL.AuthorHandle},
            ${aname}.${entProfileName.ObjectCol} AS ${POST_SEL.AuthorName},
            ${acdnurl}.${entProfileImgCdnUrl.ObjectCol} AS ${POST_SEL.AuthorImgCdnUrl},
            ${a64url}.${entProfileImg64Url.ObjectCol} AS ${POST_SEL.AuthorImg64Url},
            ${ptext}.${entPostText.ObjectCol} AS ${POST_SEL.PostText},
            ${preplykey}.${entReplyToUrlKey.ObjectCol} AS ${POST_SEL.ReplyToUrlKey},
            ${preposter}.${entReposter.ObjectCol} AS ${POST_SEL.ReposterHandle},
            ${preponame}.${entProfileName.ObjectCol} AS ${POST_SEL.ReposterName},
            ${pquoteof}.${entQuoteOf.ObjectCol} AS ${POST_SEL.QuoteOfUrlKey},
            ${ctext}.${entCardText.ObjectCol} AS ${POST_SEL.CardText},
            ${sreplycnt}.${entStatReplyCount.ObjectCol} AS ${POST_SEL.ReplyCount},
            ${slikecnt}.${entStatLikeCount.ObjectCol} AS ${POST_SEL.LikeCount},
            ${sresharecnt}.${entStatReshareCount.ObjectCol} AS ${POST_SEL.ReshareCount},
            ${cshorturl}.${entCardShortUrl.ObjectCol} AS ${POST_SEL.CardShortUrl},
            ${cfullurl}.${entCardFullUrl.ObjectCol} AS ${POST_SEL.CardFullUrl},
            ${ccdnurl}.${entCardImgCdnUrl.ObjectCol} AS ${POST_SEL.CardImgCdnUrl},
            ${c64url}.${entCardImg64Url.ObjectCol} AS ${POST_SEL.CardImg64Url}
    FROM ${entPostTime.Name} ${ptime}
    JOIN ${entSearchBlob.Name} ${psrch} ON ${psrch}.${entSearchBlob.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${psrch}.${graphMatchRhs}
    JOIN ${entAuthorHandle.Name} ${ahandle} ON ${ahandle}.${entAuthorHandle.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ahandle}.${graphMatchRhs}
    ${replyToJoinWord} ${entReplyToUrlKey.Name} ${preplykey} ON ${preplykey}.${entReplyToUrlKey.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${preplykey}.${graphMatchRhs}
    LEFT JOIN ${entReposter.Name} ${preposter} ON ${preposter}.${entReposter.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${preposter}.${graphMatchRhs}
    LEFT JOIN ${entProfileName.Name} ${aname} ON ${aname}.${entProfileName.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${aname}.${graphMatchRhs}
    LEFT JOIN ${entProfileImgCdnUrl.Name} ${acdnurl} ON ${acdnurl}.${entProfileImgCdnUrl.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${acdnurl}.${graphMatchRhs}
    LEFT JOIN ${entProfileImg64Url.Name} ${a64url} ON ${a64url}.${entProfileImg64Url.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${a64url}.${graphMatchRhs}
    LEFT JOIN ${entPostText.Name} ${ptext} ON ${ptext}.${entPostText.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ptext}.${graphMatchRhs}
    LEFT JOIN ${entProfileName.Name} ${preponame} ON ${preponame}.${entProfileName.SubjectCol} = ${preposter}.${entReposter.ObjectCol}
      AND ${preponame}.${graphMatchRhs}
    LEFT JOIN ${entQuoteOf.Name} ${pquoteof} ON ${pquoteof}.${entQuoteOf.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${pquoteof}.${graphMatchRhs}
    LEFT JOIN ${entCardSearchBlob.Name} ${csrch} ON ${csrch}.${entCardSearchBlob.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${csrch}.${graphMatchRhs}
    LEFT JOIN ${entCardText.Name} ${ctext} ON ${ctext}.${entCardText.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ctext}.${graphMatchRhs}
    LEFT JOIN ${entCardShortUrl.Name} ${cshorturl} ON ${cshorturl}.${entCardShortUrl.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${cshorturl}.${graphMatchRhs}
    LEFT JOIN ${entCardFullUrl.Name} ${cfullurl} ON ${cfullurl}.${entCardFullUrl.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${cfullurl}.${graphMatchRhs}
    LEFT JOIN ${entCardImgCdnUrl.Name} ${ccdnurl} ON ${ccdnurl}.${entCardImgCdnUrl.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ccdnurl}.${graphMatchRhs}
    LEFT JOIN ${entCardImg64Url.Name} ${c64url} ON ${c64url}.${entCardImg64Url.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${c64url}.${graphMatchRhs}
    LEFT JOIN ${entStatReplyCount.Name} ${sreplycnt} ON ${sreplycnt}.${entStatReplyCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${sreplycnt}.${graphMatchRhs}
    LEFT JOIN ${entStatLikeCount.Name} ${slikecnt} ON ${slikecnt}.${entStatLikeCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${slikecnt}.${graphMatchRhs}
    LEFT JOIN ${entStatReshareCount.Name} ${sresharecnt} ON ${sresharecnt}.${entStatReshareCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${sresharecnt}.${graphMatchRhs}
    WHERE ${ptime}.${graphMatchRhs}
    ${urlKeyCondition}
    ${authorCondition}
    ${searchClauseSql}
    ${topicCondition}
    ${orderBy}
    ${paging};
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    let rows = DBORM.QUERYING.fetch(sql, bound);

    POSTFETCHER.infuseRegularImages(rows, graphMatchRhs);
    POSTFETCHER.infuseTopicRatingTags(rows, graphMatchRhs);
    return rows;
  },

  // topic is concatenated e.g. "Environment: Climate", akin to SubTopic
  // return { sql: '', parms: [] };
  writeTopicCondition: function(topicParm) {
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entTopic = APPSCHEMA.SocialPostSubtopicRating;
    const ptime = 'ptime';  // from main query
    const ptopic = 'topic';

    let topicCondition = '';
    
    if (topicParm) {
      topicCondition = `AND EXISTS (
        SELECT ${ptopic}.${entTopic.SubjectCol}
        FROM ${entTopic.Name} ${ptopic}
        WHERE ${ptopic}.${entTopic.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
          AND ${ptopic}.${entTopic.ObjectCol} LIKE ${topicParm.key}
      )
      `;
    }

    return topicCondition;
  },

  infuseTopicRatingTags: function(rows, graphMatchRhs) {
    if (rows.length == 0) { return; }
    
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entSubtopicRating = APPSCHEMA.SocialPostSubtopicRating;
    
    const ptime = 'ptime';
    const ptag = 'ptag';

    const bind = [];

    const urlKeys = rows.map(function(r) { return r[POST_SEL.PostUrlKey]; });

    for (let i = 0; i < urlKeys.length; i++) {
      let parm = {key: `$uk_${i}`, value: urlKeys[i]};
      bind.push(parm);
    }

    const delimParms = bind.map(function(p) { return p.key; }).join(', ');

    const sql = `
    SELECT  ${ptime}.${entPostTime.SubjectCol} AS ${TOPIC_RATING_SEL.PostUrlKey},
            ${ptag}.${entSubtopicRating.ObjectCol} AS ${TOPIC_RATING_SEL.SubtopicRating}
    FROM ${entPostTime.Name} ${ptime}
    JOIN ${entSubtopicRating.Name} ${ptag} ON ${ptag}.${entSubtopicRating.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ptag}.${graphMatchRhs}
    WHERE ${ptime}.${entPostTime.SubjectCol} IN ( ${delimParms} );
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    let tagRows = DBORM.QUERYING.fetch(sql, bound);

    for (let i = 0; i < tagRows.length; i++) {
      let tagRow = tagRows[i];
      let row = rows.find(function(r) { return STR.sameText(r[POST_SEL.PostUrlKey], tagRow[POST_SEL.PostUrlKey]); });
      if (!row[POST_SEL.TopicRatings]) {
        row[POST_SEL.TopicRatings] = [];
      }
      // also split per comment at TOPIC_RATING_SEL
      let tagParts = STR.splitSubtopicRatingTag(tagRow[TOPIC_RATING_SEL.SubtopicRating]);
      if (tagParts.subtopic) {
        // no reason to bring along the other (raw) properties fetched back with tagRow
        let parsedTag = {};
        parsedTag[TOPIC_RATING_SEL.Subtopic] = tagParts.subtopic;
        parsedTag[TOPIC_RATING_SEL.Rating] = tagParts.rating;
        row[POST_SEL.TopicRatings].push(parsedTag);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      if (row[POST_SEL.TopicRatings] && row[POST_SEL.TopicRatings].length > 0) {
        row[POST_SEL.TopicRatings] = POSTFETCHER.consolidateTopicRatings(row[POST_SEL.TopicRatings]);
      }
    }
  },

  // in case the user used multiple combo-boxes to assign same subtopic with multiple ratings
  // (which is stupid, but can happen)
  consolidateTopicRatings: function(topicRatings) {
    topicRatings = ES6.sortByDesc(topicRatings, TOPIC_RATING_SEL.Rating);

    let names = topicRatings.map(function(tag) { 
      return tag[TOPIC_RATING_SEL.Subtopic]; 
    });
    names = ES6.distinctify(names);

    const consolidateds = [];
    for (let i = 0; i < names.length; i++) {
      let name = names[i];
      let consol = {};
      consol[TOPIC_RATING_SEL.Subtopic] = name;
      
      let ratings = topicRatings.filter(function(r) {
        return r[TOPIC_RATING_SEL.Subtopic] == name;
      })
      .filter(function(r) { return r[TOPIC_RATING_SEL.Rating] && !isNaN(parseInt(r[TOPIC_RATING_SEL.Rating])); });
      
      ratings = ES6.sortByDesc(ratings, TOPIC_RATING_SEL.Rating);
      if (ratings.length > 0) {
        let topRated = ratings[0];
        if (topRated) {
          consol[TOPIC_RATING_SEL.Rating] = topRated[TOPIC_RATING_SEL.Rating];
        }
      }

      consolidateds.push(consol);
    }

    return consolidateds;
  },

  infuseRegularImages: function(rows, graphMatchRhs) {
    if (rows.length == 0) { return; }
    
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entRegImg64Url = APPSCHEMA.SocialPostRegImgBinary;
    
    const ptime = 'ptime';
    const reg64url = 'reg64url';

    const bind = [];

    const urlKeys = rows.map(function(r) { return r[POST_SEL.PostUrlKey]; });

    for (let i = 0; i < urlKeys.length; i++) {
      let parm = {key: `$uk_${i}`, value: urlKeys[i]};
      bind.push(parm);
    }

    const delimParms = bind.map(function(p) { return p.key; }).join(', ');

    const sql = `
    SELECT  ${ptime}.${entPostTime.SubjectCol} AS ${REG_IMG_SEL.PostUrlKey},
            ${reg64url}.${entRegImg64Url.ObjectCol} AS ${REG_IMG_SEL.RegImg64Url}
    FROM ${entPostTime.Name} ${ptime}
    JOIN ${entRegImg64Url.Name} ${reg64url} ON ${reg64url}.${entRegImg64Url.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${reg64url}.${graphMatchRhs}
    WHERE ${ptime}.${entPostTime.SubjectCol} IN ( ${delimParms} );
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    let imgRows = DBORM.QUERYING.fetch(sql, bound);

    for (let i = 0; i < imgRows.length; i++) {
      let imgRow = imgRows[i];
      let row = rows.find(function(r) { return STR.sameText(r[POST_SEL.PostUrlKey], imgRow[POST_SEL.PostUrlKey]); });
      if (!row[POST_SEL.Images]) {
        row[POST_SEL.Images] = [];
      }
      row[POST_SEL.Images].push(imgRow);
    }

    return imgRows;
  }
};