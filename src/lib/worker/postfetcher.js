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
  
  searchInUseTopics: function(request) {
    const concatSubtopics = POSTFETCHER.getInUseConcatSubtopics(request.site, request.searchText);
    // post back to UI
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.SEARCHED_INUSE_TOPICS,
      payload: concatSubtopics
    });  
  },

  postSearch: function(request) {
    let dt = Date.now();
    const rows = POSTFETCHER.postSearchWorker(request);
    console.log(`${Date.now() - dt} fetch main`);
    POSTFETCHER.infuseThreadItemCount(rows);
    POSTFETCHER.infuseQuoteAndReplyToTweets(request.pageType, rows);
    console.log(`${Date.now() - dt} ms fetch total`);
    // post back to UI
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.POST_STREAM,
      payload: { 
        request: request, 
        rows: rows
        }
    });  
  },

  infuseQuoteAndReplyToTweets: function(pageType, rows, minimal) {
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

    const fetchRequest = { pageType: pageType };
    const fetchedRows = POSTFETCHER.postSearchWorker(fetchRequest, neededKeys, minimal);
    
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

  infuseThreadItemCount: function(rows) {
    let threadUrlKeys = rows
      .filter(function(row) { return STR.hasLen(row[POST_SEL.ThreadUrlKey]); })
      .map(function(row) { return row[POST_SEL.ThreadUrlKey]; })
    
    threadUrlKeys = ES6.distinctify(threadUrlKeys);
    
    if (threadUrlKeys.length == 0) { return; }

    const bind = [];
    for (let i = 0; i < threadUrlKeys.length; i++) {
      let parm = {key: `$uk_${i}`, value: threadUrlKeys[i]};
      bind.push(parm);
    }
    const delimUrlKeyParms = bind.map(function(p) { return p.key; }).join(', ');

    const entThread = APPSCHEMA.SocialPostThreadUrlKey;
    const pthread = 'pthread';

    const sql = `
    SELECT  ${pthread}.${entThread.ObjectCol} AS ${POST_SEL.ThreadUrlKey},
            COUNT(DISTINCT ${pthread}.${entThread.SubjectCol}) AS Cnt
    FROM ${entThread.Name} ${pthread}
    WHERE ${pthread}.${entThread.ObjectCol} IN ( ${delimUrlKeyParms} )
    GROUP BY ${pthread}.${entThread.ObjectCol};
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    const cnts = DBORM.QUERYING.fetch(sql, bound);
    
    for (let i = 0; i < cnts.length; i++) {
      let cnt = cnts[i];
      let matchedRows = rows.filter(function(r) { return STR.sameText(cnt[POST_SEL.ThreadUrlKey], r[POST_SEL.ThreadUrlKey]); });
      for (let j = 0; j < matchedRows.length; j++) {
        let match = matchedRows[j];
        match[POST_SEL.ConvoCount] = cnt.Cnt;
      }
    }
  },

  // urlKeysAs is SPECIFIC_URL_KEYS_AS
  postSearchWorker: function(request, specificUrlKeys, minimal) {
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
    const entThreadUrlKey = APPSCHEMA.SocialPostThreadUrlKey;
    const entSearchBlob = APPSCHEMA.SocialPostSearchBlob;
    const entEmbedsVideo = APPSCHEMA.SocialPostEmbedsVideo;
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
    const pthread = 'pthread';
    const psrch = 'psrch';
    const pembvid = 'pembvid';
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
    let urlKeyCondition = `AND ${ptime}.${entPostTime.SubjectCol} NOT LIKE '%${QUOTED_SUFFIX}'`;
    let authorCondition = '';
    let searchClauseSql = '';
    let topicCondition = '';
    let threadCondition = '';
    let cteSql = '';
    let orderBy = '';
    let paging = `LIMIT ${take} OFFSET ${skip}`;
    let replyToJoinWord = 'LEFT JOIN';
    let likeTopicParm;
    let guessedTopicParm;
    let orderByTopicParm;

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
      urlKeyCondition = `  AND ${ptime}.${entPostTime.SubjectCol} IN ( ${delimUrlKeyParms} )`;
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
        // note that it's valid to pass in just the topic without the ": Subtopic" part
        const likeTopicPattern = (request.topic.indexOf(TOPICS.TOPIC_SUBTOPIC_COLON) > -1) 
          ? `${request.topic}${SUBTOPIC_RATING_DELIM}%`   // concat topic was passed in
          : `${request.topic}${TOPICS.TOPIC_SUBTOPIC_COLON}%`;  // just topic (no subtopic)

        likeTopicParm = {key: `$likeTopic`, value: likeTopicPattern};
        bind.push(likeTopicParm);
        topicCondition = POSTFETCHER.writeTopicCondition(likeTopicParm, request.guessTopics);
  
        if (request.guessTopics == true) {
          const guessedTopicPattern = (request.topic.indexOf(TOPICS.TOPIC_SUBTOPIC_COLON) > -1) 
          ? request.topic   // exact match
          : `${request.topic}${TOPICS.TOPIC_SUBTOPIC_COLON}%`;  // LIKE topic (no subtopic specified)

          guessedTopicParm = {key: `$guessedTopic`, value: guessedTopicPattern};
          bind.push(guessedTopicParm);
          cteSql = POSTFETCHER.writeTopicGuessCte(guessedTopicParm);
        }
      }
      
      switch (request.orderBy) {
        case ORDER_BY.POST_RATING:
          const orderByTopicPattern = (request.topic.indexOf(TOPICS.TOPIC_SUBTOPIC_COLON) > -1) 
          ? request.topic   // exact match
          : `${request.topic}${TOPICS.TOPIC_SUBTOPIC_COLON}%`;  // LIKE topic (no subtopic specified)

          orderByTopicParm = {key: `$orderByTopic`, value: orderByTopicPattern};
          bind.push(orderByTopicParm);
          orderBy = POSTFETCHER.writeOrderByRating(request.topic, orderByTopicParm);
          break;
        case ORDER_BY.POST_TIME_ASC:
          orderBy = `ORDER BY ${ptime}.${entPostTime.ObjectCol} ASC`;
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

    let threadUrlKeyJoinWord = 'LEFT JOIN';
    if (STR.hasLen(request.threadUrlKey)) {
      threadUrlKeyJoinWord = 'JOIN';
      bind.push({key: '$thread', value: request.threadUrlKey});
      threadCondition = `  AND ${pthread}.${entThreadUrlKey.ObjectCol} = $thread`;
    }

    let imgSelect = '';
    let imgJoiner = '';
    if (minimal != true) {
      
      imgSelect = `,
      ${acdnurl}.${entProfileImgCdnUrl.ObjectCol} AS ${POST_SEL.AuthorImgCdnUrl},
      ${a64url}.${entProfileImg64Url.ObjectCol} AS ${POST_SEL.AuthorImg64Url},
      ${ccdnurl}.${entCardImgCdnUrl.ObjectCol} AS ${POST_SEL.CardImgCdnUrl},
      ${c64url}.${entCardImg64Url.ObjectCol} AS ${POST_SEL.CardImg64Url}
      `;

      imgJoiner = `
      LEFT JOIN ${entProfileImgCdnUrl.Name} ${acdnurl} ON ${acdnurl}.${entProfileImgCdnUrl.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
        AND ${acdnurl}.${graphMatchRhs}
      LEFT JOIN ${entProfileImg64Url.Name} ${a64url} ON ${a64url}.${entProfileImg64Url.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
        AND ${a64url}.${graphMatchRhs}
      LEFT JOIN ${entCardImgCdnUrl.Name} ${ccdnurl} ON ${ccdnurl}.${entCardImgCdnUrl.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${ccdnurl}.${graphMatchRhs}
      LEFT JOIN ${entCardImg64Url.Name} ${c64url} ON ${c64url}.${entCardImg64Url.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${c64url}.${graphMatchRhs}
      `;
    }

    const sql = `${cteSql}
    SELECT  ${ptime}.${entPostTime.SubjectCol} AS ${POST_SEL.PostUrlKey},
            ${ptime}.${entPostTime.ObjectCol} AS ${POST_SEL.PostTime},
            ${ahandle}.${entAuthorHandle.ObjectCol} AS ${POST_SEL.AuthorHandle},
            ${aname}.${entProfileName.ObjectCol} AS ${POST_SEL.AuthorName},
            ${ptext}.${entPostText.ObjectCol} AS ${POST_SEL.PostText},
            ${preplykey}.${entReplyToUrlKey.ObjectCol} AS ${POST_SEL.ReplyToUrlKey},
            ${preposter}.${entReposter.ObjectCol} AS ${POST_SEL.ReposterHandle},
            ${preponame}.${entProfileName.ObjectCol} AS ${POST_SEL.ReposterName},
            ${pquoteof}.${entQuoteOf.ObjectCol} AS ${POST_SEL.QuoteOfUrlKey},
            ${pthread}.${entThreadUrlKey.ObjectCol} AS ${POST_SEL.ThreadUrlKey},
            ${pembvid}.${entEmbedsVideo.ObjectCol} AS ${POST_SEL.EmbedsVideo},
            ${ctext}.${entCardText.ObjectCol} AS ${POST_SEL.CardText},
            ${sreplycnt}.${entStatReplyCount.ObjectCol} AS ${POST_SEL.ReplyCount},
            ${slikecnt}.${entStatLikeCount.ObjectCol} AS ${POST_SEL.LikeCount},
            ${sresharecnt}.${entStatReshareCount.ObjectCol} AS ${POST_SEL.ReshareCount},
            ${cshorturl}.${entCardShortUrl.ObjectCol} AS ${POST_SEL.CardShortUrl},
            ${cfullurl}.${entCardFullUrl.ObjectCol} AS ${POST_SEL.CardFullUrl}${imgSelect}
    FROM ${entPostTime.Name} ${ptime}
    JOIN ${entSearchBlob.Name} ${psrch} ON ${psrch}.${entSearchBlob.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${psrch}.${graphMatchRhs}
    JOIN ${entAuthorHandle.Name} ${ahandle} ON ${ahandle}.${entAuthorHandle.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ahandle}.${graphMatchRhs}
    ${replyToJoinWord} ${entReplyToUrlKey.Name} ${preplykey} ON ${preplykey}.${entReplyToUrlKey.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${preplykey}.${graphMatchRhs}
    ${threadUrlKeyJoinWord} ${entThreadUrlKey.Name} ${pthread} ON ${pthread}.${entThreadUrlKey.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${pthread}.${graphMatchRhs}
    LEFT JOIN ${entReposter.Name} ${preposter} ON ${preposter}.${entReposter.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${preposter}.${graphMatchRhs}
    LEFT JOIN ${entProfileName.Name} ${aname} ON ${aname}.${entProfileName.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${aname}.${graphMatchRhs}
    LEFT JOIN ${entPostText.Name} ${ptext} ON ${ptext}.${entPostText.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ptext}.${graphMatchRhs}
    LEFT JOIN ${entEmbedsVideo.Name} ${pembvid} ON ${pembvid}.${entEmbedsVideo.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${pembvid}.${graphMatchRhs}
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
    LEFT JOIN ${entStatReplyCount.Name} ${sreplycnt} ON ${sreplycnt}.${entStatReplyCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${sreplycnt}.${graphMatchRhs}
    LEFT JOIN ${entStatLikeCount.Name} ${slikecnt} ON ${slikecnt}.${entStatLikeCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${slikecnt}.${graphMatchRhs}
    LEFT JOIN ${entStatReshareCount.Name} ${sresharecnt} ON ${sresharecnt}.${entStatReshareCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${sresharecnt}.${graphMatchRhs}
    ${imgJoiner}
    WHERE ${ptime}.${graphMatchRhs}
    ${urlKeyCondition}
    ${authorCondition}
    ${searchClauseSql}
    ${topicCondition}
    ${threadCondition}
    ${orderBy}
    ${paging};
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    let rows = DBORM.QUERYING.fetch(sql, bound);
    
    if (minimal != true) {
      POSTFETCHER.infuseRegularImages(rows, graphMatchRhs);
    }
    if (minimal != true) {
      POSTFETCHER.infuseTopicRatingTags(rows, graphMatchRhs, guessedTopicParm, request.guessTopics);
    }
    
    return rows;
  },

  writeOrderByRating: function(topic, orderByTopicParm) {
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entPostTag = APPSCHEMA.SocialPostSubtopicRating;
    const ptime = 'ptime';
    const ptag = 'ptag';
    
    if (!STR.hasLen(topic) || !orderByTopicParm) {
      console.log('unexpected order-by');
      return `ORDER BY ${ptime}.${entPostTime.ObjectCol} DESC`;
    }

    // a quick & dirty way to sort by tag rating, which is a many-to-one!
    const oper = orderByTopicParm.value.endsWith('%') ? 'LIKE' : '=';

    const whenTemplate = `
      SELECT ${ptag}.${entPostTag.SubjectCol}
      FROM ${entPostTag.Name} ${ptag}
      WHERE ${ptag}.${entPostTag.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${ptag}.${entPostTag.ObjectCol} ${oper} ${orderByTopicParm.key} || '${SUBTOPIC_RATING_DELIM}' || `;

    return `ORDER BY 
    CASE 
      WHEN EXISTS ( ${whenTemplate} '5' ) THEN 5
      WHEN EXISTS ( ${whenTemplate} '4' ) THEN 4
      WHEN EXISTS ( ${whenTemplate} '3' ) THEN 3
      WHEN EXISTS ( ${whenTemplate} '2' ) THEN 2
      WHEN EXISTS ( ${whenTemplate} '1' ) THEN 1
      ELSE 0
    END DESC`;
  },

  writeTopicGuessCte: function(guessedTopicParm) {
    const entTopicSubtopic = APPSCHEMA.SocialTopicSubtopic;
    const entSubtopicKeyword = APPSCHEMA.SocialSubtopicKeyword;
    const tsub = 'tsub';
    const skw = 'skw';
    
    let topicCondition = '';
    if (guessedTopicParm) {
      // in this case, not every topic-keyword is interesting; only those matching this concatenated topic
      // (i.e. like 'Environment: Climate')
      const oper = guessedTopicParm.value.endsWith('%') ? 'LIKE' : '=';
      topicCondition = `WHERE ${tsub}.${entTopicSubtopic.SubjectCol} || '${TOPICS.TOPIC_SUBTOPIC_COLON}' || ${tsub}.${entTopicSubtopic.ObjectCol} ${oper} ${guessedTopicParm.key}`;
    }

    // ConcatSansRating is e.g. 'Environment: Climate-'
    const sql = `
    ;WITH cte AS (
      SELECT  ${tsub}.${entTopicSubtopic.SubjectCol} AS Topic,
              ${tsub}.${entTopicSubtopic.ObjectCol} AS Subtopic,
              ${tsub}.${entTopicSubtopic.SubjectCol} || '${TOPICS.TOPIC_SUBTOPIC_COLON}' || ${tsub}.${entTopicSubtopic.ObjectCol} || '${SUBTOPIC_RATING_DELIM}' AS ConcatSansRating,
              '%' || ${skw}.${entSubtopicKeyword.ObjectCol} || '%' AS Pattern
      FROM ${entTopicSubtopic.Name} ${tsub}
      JOIN ${entSubtopicKeyword.Name} ${skw} ON ${skw}.${entSubtopicKeyword.SubjectCol} = ${tsub}.${entTopicSubtopic.ObjectCol}
      ${topicCondition}
    )
    `;

    return sql;
  },

  writeTopicCondition: function(likeTopicParm, guessTopics) {
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entTopic = APPSCHEMA.SocialPostSubtopicRating;
    const entPostText = APPSCHEMA.SocialPostText;
    const ptime = 'ptime';  // from main query
    const ptopic = 'topic';
    const ptext = 'ptext';

    let specificTopicCondition = '';
    let guessCondition = '';
    
    // for the case where it was manually tagged
    if (likeTopicParm) {
      specificTopicCondition = `EXISTS (
        SELECT ${ptopic}.${entTopic.SubjectCol}
        FROM ${entTopic.Name} ${ptopic}
        WHERE ${ptopic}.${entTopic.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
          AND ${ptopic}.${entTopic.ObjectCol} LIKE ${likeTopicParm.key}
      )`;
    }

    // based on the common-table expression from writeTopicGuessCte
    // (guessing that a tag would match, based on keyword match)
    if (guessTopics == true) {
      guessCondition = `EXISTS (
        SELECT c.Subtopic
        FROM cte c
        WHERE ${ptext}.${entPostText.ObjectCol} LIKE c.Pattern
      )`;
    }

    let topicCondition = '';
    if (STR.hasLen(specificTopicCondition) && STR.hasLen(guessCondition)) {
      topicCondition = `AND ( 
        ${specificTopicCondition} 
        OR
        ${guessCondition}
        )`;
    }
    else if (STR.hasLen(specificTopicCondition)) {
      topicCondition = `AND ${specificTopicCondition}`;
    }
    else if (STR.hasLen(guessCondition)) {
      topicCondition = `AND ${guessCondition}`;
    }

    return topicCondition;
  },

  infuseTopicRatingTags: function(rows, graphMatchRhs, guessedTopicParm, guessTopics) {
    if (rows.length == 0) { return; }
    
    const entPostTime = APPSCHEMA.SocialPostTime;
    const entPostText = APPSCHEMA.SocialPostText;
    const entSubtopicRating = APPSCHEMA.SocialPostSubtopicRating;
    const ptime = 'ptime';
    const ptag = 'ptag';
    const ptext = 'ptext';
    const bind = [];
    const urlKeys = rows.map(function(r) { return r[POST_SEL.PostUrlKey]; });

    for (let i = 0; i < urlKeys.length; i++) {
      let parm = {key: `$uk_${i}`, value: urlKeys[i]};
      bind.push(parm);
    }

    const delimParms = bind.map(function(p) { return p.key; }).join(', ');
    
    // a) first identify tags that are actually set
    let sql = `
    SELECT  ${ptime}.${entPostTime.SubjectCol} AS ${TOPIC_RATING_SEL.PostUrlKey},
            ${ptag}.${entSubtopicRating.ObjectCol} AS ${TOPIC_RATING_SEL.SubtopicRating}
    FROM ${entPostTime.Name} ${ptime}
    JOIN ${entSubtopicRating.Name} ${ptag} ON ${ptag}.${entSubtopicRating.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ptag}.${graphMatchRhs}
    WHERE ${ptime}.${entPostTime.SubjectCol} IN ( ${delimParms} );
    `;
    
    let bound = DBORM.QUERYING.bindConsol(bind);
    let tagRows = DBORM.QUERYING.fetch(sql, bound);

    // b) next, if guessTags is true, find additional rows based on keyword matches
    if (guessTopics == true) {
      const cteSql = POSTFETCHER.writeTopicGuessCte(guessedTopicParm);
      if (guessedTopicParm) {
        bind.push(guessedTopicParm);
      }
      bound = DBORM.QUERYING.bindConsol(bind);

      // the group-by is because we're satisfied to find one (rather than proliferating lots of guessed comboboxes)
      sql = `${cteSql}
      SELECT ${ptext}.${entPostText.SubjectCol} AS ${TOPIC_RATING_SEL.PostUrlKey},
             MAX(c.ConcatSansRating) AS ${TOPIC_RATING_SEL.SubtopicRating}
      FROM cte c
      JOIN ${entPostText.Name} ${ptext} ON ${ptext}.${entPostText.ObjectCol} LIKE c.Pattern
      WHERE ${ptext}.${entPostText.SubjectCol} IN ( ${delimParms} )
      GROUP BY ${ptext}.${entPostText.SubjectCol};
      `;

      let addtlRows = DBORM.QUERYING.fetch(sql, bound);
      tagRows.push(...addtlRows);
    }

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
      let consolidated = {};
      consolidated[TOPIC_RATING_SEL.Subtopic] = name;
      
      let ratings = topicRatings.filter(function(r) {
        return r[TOPIC_RATING_SEL.Subtopic] == name;
      })
      .filter(function(r) { return r[TOPIC_RATING_SEL.Rating] && !isNaN(parseInt(r[TOPIC_RATING_SEL.Rating])); });
      
      ratings = ES6.sortByDesc(ratings, TOPIC_RATING_SEL.Rating);
      if (ratings.length > 0) {
        let topRated = ratings[0];
        if (topRated) {
          consolidated[TOPIC_RATING_SEL.Rating] = topRated[TOPIC_RATING_SEL.Rating];
        }
      }

      consolidateds.push(consolidated);
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
  },

  getInUseConcatSubtopics: function(site, searchText) {
    const bind = [];

    let conjunction = 'WHERE';
    let graphCondition = '';

    const entTopicRating = APPSCHEMA.SocialPostSubtopicRating;
    const oValue = entTopicRating.ObjectCol;
    const ptr = 'ptr';

    if (site) {
      const graph = APPGRAPHS.getGraphBySite(site);
      graphCondition = `WHERE ${ptr}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graph}'`;
      conjunction = 'AND';
    }

    let searchCondition = '';
    if (STR.hasLen(searchText)) {
      let pattern = searchText.replaceAll(' ', '%');
      pattern = STR.ensurePrefix(pattern, '%');
      pattern = STR.ensureSuffix(pattern, '%');
      bind.push({key: '$searchText', value: pattern });
      searchCondition = `${conjunction} ${oValue} LIKE $searchText`;
      conjunction = 'AND';
    }
    
    const sql = `
    SELECT DISTINCT ${ptr}.${oValue}
    FROM ${entTopicRating.Name} ${ptr}
    ${graphCondition}
    ${searchCondition}
    ORDER BY ${ptr}.${oValue};
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    const rows = DBORM.QUERYING.fetch(sql, bound);
    
    let subtopics = rows.map(function(r) { 
      let splt = STR.splitSubtopicRatingTag(r[entTopicRating.ObjectCol]);
      return (splt) ? splt.subtopic : null;
    }).filter(function(s) {
      return STR.hasLen(s);
    });

    subtopics = ES6.distinctify(subtopics);
    return subtopics;
  },

  getPostImageEntities: function() {
    return [
      APPSCHEMA.SocialPostCardImgBinary,
      APPSCHEMA.SocialPostCardImgSourceUrl,
      APPSCHEMA.SocialPostRegImgBinary,
      APPSCHEMA.SocialPostRegImgSourceUrl
    ];
  },

  SYNC: {
    // urlkeys by subtopic
    getTopicRatings: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const subtopics = POSTFETCHER.getInUseConcatSubtopics(site);
      const marker = step[SYNCFLOW.STEP.marker];

      if (subtopics.length === 0) {
        return [];
      }

      let subtopic = '';
      if (!STR.hasLen(marker) || marker == FIRST_TEXT_START || marker == FIRST_TEXT_END) {
        subtopic = subtopics[0];
      }
      else if (step[SYNCFLOW.STEP.exact] == true) {
        subtopic = subtopics.find(function(s) { return STR.sameText(s, marker); });
      }
      else {
        subtopic = ES6.getNext(subtopics, marker);
      }

      if (!STR.hasLen(subtopic)) {
        return [];
      }

      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const entTopicRating = APPSCHEMA.SocialPostSubtopicRating;
      const ptr = 'ptr';

      const bind = [];
      const pattern = `${subtopic}${SUBTOPIC_RATING_DELIM}%`;
      let parm = {key: '$marker', value: pattern};
      bind.push(parm);
      const markerFilter = `  AND ${ptr}.${entTopicRating.ObjectCol} LIKE ${parm.key}`;
      
      const sql = `
      SELECT ${ptr}.${entTopicRating.SubjectCol} AS ${SYNC_COL.RATED_POST.PostUrlKey},
        ${ptr}.${entTopicRating.ObjectCol} AS ${SYNC_COL.RATED_POST.Concat},
        ${ptr}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
        ${ptr}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}
      FROM ${entTopicRating.Name} ${ptr}
      WHERE ${ptr}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
      ${markerFilter}
      ORDER BY ${ptr}.${entTopicRating.SubjectCol};
      `;

      const bound = DBORM.QUERYING.bindConsol(bind);
      let rows = DBORM.QUERYING.fetch(sql, bound);

      rows = rows.map(function(r) {
        let row = {};
        row[SYNC_COL.RATED_POST.PostUrlKey] = r[SYNC_COL.RATED_POST.PostUrlKey];
        let splat = STR.splitSubtopicRatingTag(r[SYNC_COL.RATED_POST.Concat]);
        let topicWithSubtopic = splat.subtopic;
        // TopicName: SubtopicName
        let parsedTopic = topicWithSubtopic.split(TOPICS.TOPIC_SUBTOPIC_COLON);
        row[SYNC_COL.RATED_POST.Topic] = parsedTopic[0];
        row[SYNC_COL.RATED_POST.Subtopic] = parsedTopic[1];
        row[SYNC_COL.RATED_POST.Rating] = splat.rating;
        row[SCHEMA_CONSTANTS.COLUMNS.Timestamp] = r[SCHEMA_CONSTANTS.COLUMNS.Timestamp];
        row[SCHEMA_CONSTANTS.COLUMNS.NamedGraph] = r[SCHEMA_CONSTANTS.COLUMNS.NamedGraph];
        return row;
      });

      return rows;
    },

    // for one thread at a time
    getPosts: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const graphMatchRhs = `${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'`;

      // author
      const entAuthorHandle = APPSCHEMA.SocialPostAuthorHandle;
      const entProfileName = APPSCHEMA.SocialProfileDisplayName;
      // post
      const entPostTime = APPSCHEMA.SocialPostTime;
      const entPostText = APPSCHEMA.SocialPostText;
      const entReplyToUrlKey = APPSCHEMA.SocialPostReplyToUrlKey;
      const entReposter = APPSCHEMA.SocialPostReposter;
      const entQuoteOf = APPSCHEMA.SocialPostQuoteOf;
      const entThreadUrlKey = APPSCHEMA.SocialPostThreadUrlKey;
      const entSearchBlob = APPSCHEMA.SocialPostSearchBlob;
      const entEmbedsVideo = APPSCHEMA.SocialPostEmbedsVideo;
      // card
      const entCardSearchBlob = APPSCHEMA.SocialPostCardSearchBlob;
      const entCardText = APPSCHEMA.SocialPostCardText;
      const entCardShortUrl = APPSCHEMA.SocialPostCardShortUrl;
      const entCardFullUrl = APPSCHEMA.SocialPostCardFullUrl;
      // stats
      const entStatReplyCount = APPSCHEMA.SocialPostReplyCount;
      const entStatLikeCount = APPSCHEMA.SocialPostLikeCount;
      const entStatReshareCount = APPSCHEMA.SocialPostReshareCount;

      // prefixes
      const ahandle = 'ahandle';
      const aname = 'aname';
      const ptime = 'ptime';
      const ptext = 'ptext';
      const preplykey = 'preplykey';
      const preposter = 'preposter';
      const preponame = 'preponame';
      const pquoteof = 'pquoteof';
      const pthread = 'pthread';
      const psrch = 'psrch';
      const pembvid = 'pembvid';
      const csrch = 'csrch';
      const ctext = 'ctext';
      const cshorturl = 'cshorturl';
      const cfullurl = 'cfullurl';
      const sreplycnt = 'sreplycnt';
      const slikecnt = 'slikecnt';
      const sresharecnt = 'sresharecnt';

      const bind = [];
      const targetUrlKeyResult = POSTFETCHER.SYNC.getNextPostUrlKeys(step);
      const targetUrlKeys = targetUrlKeyResult.postUrlKeys;
      if (targetUrlKeys.length == 0) {
        const emptyResult = {};
        emptyResult[SYNC_COL.POSTS.MarkerUrlKey] = targetUrlKeyResult.endingMarker;
        return [emptyResult];
      }
      const delimUrlKeys = targetUrlKeys.map(function(k) {return `'${k}'`;}).join(', ');

      const sql = `
      SELECT  '${targetUrlKeyResult.endingMarker}' AS ${SYNC_COL.POSTS.MarkerUrlKey},
              ${ptime}.${entPostTime.SubjectCol} AS ${POST_SEL.PostUrlKey},
              ${ptime}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
              ${ptime}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph},
              ${ptime}.${entPostTime.ObjectCol} AS ${POST_SEL.PostTime},
              ${ahandle}.${entAuthorHandle.ObjectCol} AS ${POST_SEL.AuthorHandle},
              ${aname}.${entProfileName.ObjectCol} AS ${POST_SEL.AuthorName},
              ${ptext}.${entPostText.ObjectCol} AS ${POST_SEL.PostText},
              ${preplykey}.${entReplyToUrlKey.ObjectCol} AS ${POST_SEL.ReplyToUrlKey},
              ${preposter}.${entReposter.ObjectCol} AS ${POST_SEL.ReposterHandle},
              ${preponame}.${entProfileName.ObjectCol} AS ${POST_SEL.ReposterName},
              ${pquoteof}.${entQuoteOf.ObjectCol} AS ${POST_SEL.QuoteOfUrlKey},
              ${pthread}.${entThreadUrlKey.ObjectCol} AS ${POST_SEL.ThreadUrlKey},
              ${pembvid}.${entEmbedsVideo.ObjectCol} AS ${POST_SEL.EmbedsVideo},
              ${ctext}.${entCardText.ObjectCol} AS ${POST_SEL.CardText},
              ${sreplycnt}.${entStatReplyCount.ObjectCol} AS ${POST_SEL.ReplyCount},
              ${slikecnt}.${entStatLikeCount.ObjectCol} AS ${POST_SEL.LikeCount},
              ${sresharecnt}.${entStatReshareCount.ObjectCol} AS ${POST_SEL.ReshareCount},
              ${cshorturl}.${entCardShortUrl.ObjectCol} AS ${POST_SEL.CardShortUrl},
              ${cfullurl}.${entCardFullUrl.ObjectCol} AS ${POST_SEL.CardFullUrl}
      FROM ${entPostTime.Name} ${ptime}
      LEFT JOIN ${entSearchBlob.Name} ${psrch} ON ${psrch}.${entSearchBlob.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${psrch}.${graphMatchRhs}
      JOIN ${entAuthorHandle.Name} ${ahandle} ON ${ahandle}.${entAuthorHandle.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${ahandle}.${graphMatchRhs}
      LEFT JOIN ${entReplyToUrlKey.Name} ${preplykey} ON ${preplykey}.${entReplyToUrlKey.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${preplykey}.${graphMatchRhs}
      LEFT JOIN ${entThreadUrlKey.Name} ${pthread} ON ${pthread}.${entThreadUrlKey.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${pthread}.${graphMatchRhs}
      LEFT JOIN ${entReposter.Name} ${preposter} ON ${preposter}.${entReposter.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${preposter}.${graphMatchRhs}
      LEFT JOIN ${entProfileName.Name} ${aname} ON ${aname}.${entProfileName.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
        AND ${aname}.${graphMatchRhs}  
      LEFT JOIN ${entPostText.Name} ${ptext} ON ${ptext}.${entPostText.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${ptext}.${graphMatchRhs}
      LEFT JOIN ${entEmbedsVideo.Name} ${pembvid} ON ${pembvid}.${entEmbedsVideo.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${pembvid}.${graphMatchRhs}
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
      LEFT JOIN ${entStatReplyCount.Name} ${sreplycnt} ON ${sreplycnt}.${entStatReplyCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${sreplycnt}.${graphMatchRhs}
      LEFT JOIN ${entStatLikeCount.Name} ${slikecnt} ON ${slikecnt}.${entStatLikeCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${slikecnt}.${graphMatchRhs}
      LEFT JOIN ${entStatReshareCount.Name} ${sresharecnt} ON ${sresharecnt}.${entStatReshareCount.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${sresharecnt}.${graphMatchRhs}
      WHERE ${ptime}.${graphMatchRhs}
        AND ${ptime}.${entPostTime.SubjectCol} IN ( ${delimUrlKeys} )
      ORDER BY ${ptime}.${entPostTime.ObjectCol} ASC;
      `;
  
      const bound = DBORM.QUERYING.bindConsol(bind);
      let rows = DBORM.QUERYING.fetch(sql, bound);
      const pageType = PAGETYPE.getPageType(site, undefined, true);
      POSTFETCHER.infuseQuoteAndReplyToTweets(pageType, rows);
      return rows;
    },

    getPostImgs: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const graphMatchRhs = `${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'`;

      const img = 'img';
      const bind = [];

      const targetUrlKeyResult = POSTFETCHER.SYNC.getNextPostUrlKeys(step);
      const targetUrlKeys = targetUrlKeyResult.postUrlKeys;
  
      const emptyResult = {};
      emptyResult[SYNC_COL.POSTS.MarkerUrlKey] = targetUrlKeyResult.endingMarker;
      if (targetUrlKeys.length == 0) {
        return [emptyResult];
      }
  
      const delimUrlKeys = targetUrlKeys.map(function(k) {return `'${k}'`;}).join(', ');
  
      const imgEnts = POSTFETCHER.getPostImageEntities();

      let allRows = [];
      for (let i = 0; i < imgEnts.length; i++) {
        let imgEnt = imgEnts[i];

        let sql = `
        SELECT  '${targetUrlKeyResult.endingMarker}' AS ${SYNC_COL.POST_IMGS.MarkerUrlKey},
                ${img}.${imgEnt.SubjectCol} AS ${SYNC_COL.POST_IMGS.PostUrlKey},
                ${img}.${imgEnt.ObjectCol} AS ${SYNC_COL.POST_IMGS.Img},
                ${img}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
                ${img}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph},
                '${imgEnt.Name}' AS ${SYNC_COL.POST_IMGS.Type}
        FROM ${imgEnt.Name} ${img}
        WHERE ${img}.${graphMatchRhs}
          AND ${img}.${imgEnt.SubjectCol} IN ( ${delimUrlKeys} );
        `;
        let bound = DBORM.QUERYING.bindConsol(bind);
        let rows = DBORM.QUERYING.fetch(sql, bound);
        allRows.push(...rows);
      }
      
      if (allRows.length == 0) {
        return [emptyResult];
      }
      else {
        return allRows;
      }
    },

    // marker represents threadUrlKey where available; else fallback to postUrlKey
    // return {endingMarker: '' , postUrlKeys: []}
    getNextPostUrlKeys: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const graphMatchRhs = `${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'`;

      const entPostTime = APPSCHEMA.SocialPostTime;
      const entPostAuthor = APPSCHEMA.SocialPostAuthorHandle;
      const entThreadUrlKey = APPSCHEMA.SocialPostThreadUrlKey;

      const ptime = 'ptime';
      const pauth = 'path';
      const pthread = 'pthread';

      const markerBind = [];
      
      let markerViaThread = true;
      let configFilterSql = '';
      const config = step[SYNCFLOW.STEP.config];
      let authorFilter = config[SETTINGS.SYNCFLOW.CONFIG.AUTHOR_FILTER];
      if (STR.hasLen(authorFilter)) {
        authorFilter = STR.ensurePrefix(authorFilter, '@');
        let parm = {key: '$author', value: authorFilter};
        markerBind.push(parm);
        configFilterSql = STR.appendLine(configFilterSql, `  AND ${pauth}.${entPostAuthor.ObjectCol} = ${parm.key}`);
        // when an author filter is in place, we choose to be conservative about the risk of 
        // uploading a thread's file with only one author's posts within it (potentially overwriting the full thread)
        markerViaThread = false;
      }

      let markerUrlKey;
      if (markerViaThread == true) {
        markerUrlKey = `COALESCE(${pthread}.${entThreadUrlKey.ObjectCol} COLLATE NOCASE, ${ptime}.${entPostTime.SubjectCol} COLLATE NOCASE)`;
      }
      else {
        markerUrlKey = `${ptime}.${entPostTime.SubjectCol}`;
      }

      let markerFilter = '';
      const marker = step[SYNCFLOW.STEP.marker];
      if (STR.hasLen(marker) && marker != FIRST_TEXT_START) {
        let parm = {key: '$marker', value: marker};
        markerBind.push(parm);
        const oper = step[SYNCFLOW.STEP.exact] == true ? '=' : '>';
        markerFilter = `  AND ${markerUrlKey} ${oper} ${parm.key}`;
      }

      const postedFrom = config[SETTINGS.SYNCFLOW.CONFIG.POSTED_FROM];
      if (postedFrom && !isNaN(parseInt(postedFrom))) {
        let parm = {key: '$fromTime', value: postedFrom};
        markerBind.push(parm);
        configFilterSql = STR.appendLine(configFilterSql, `  AND ${ptime}.${entPostAuthor.ObjectCol} > ${parm.key}`);
      }
      const postedUntil = config[SETTINGS.SYNCFLOW.CONFIG.POSTED_UNTIL];
      if (postedUntil && !isNaN(parseInt(postedUntil))) {
        let parm = {key: '$untilTime', value: postedUntil};
        markerBind.push(parm);
        configFilterSql = STR.appendLine(configFilterSql, `  AND ${ptime}.${entPostAuthor.ObjectCol} < ${parm.key}`);
      }

      const bodySql = `
      FROM ${entPostTime.Name} ${ptime}
      JOIN ${entPostAuthor.Name} ${pauth} ON ${pauth}.${entPostAuthor.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${pauth}.${graphMatchRhs}
      LEFT JOIN ${entThreadUrlKey.Name} ${pthread} ON ${pthread}.${entThreadUrlKey.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
        AND ${pthread}.${graphMatchRhs}
      WHERE ${ptime}.${graphMatchRhs}
        AND ${ptime}.${entPostTime.SubjectCol} NOT LIKE '%${QUOTED_SUFFIX}'
      `;

      const markerSql = `
      SELECT DISTINCT ${markerUrlKey} AS ${SYNC_COL.POSTS.MarkerUrlKey}
      ${bodySql}
      ${markerFilter}
      ${configFilterSql}
      ORDER BY ${markerUrlKey} ASC
      LIMIT 1;
      `;

      const markerBound = DBORM.QUERYING.bindConsol(markerBind);
      let markerRows = DBORM.QUERYING.fetch(markerSql, markerBound);
      let endingMarker = LAST_TEXT;
      let postUrlKeys = [];

      if (markerRows.length > 0) { 
        endingMarker = markerRows[0][SYNC_COL.POSTS.MarkerUrlKey];
        
        let urlKeySql = `
        SELECT ${ptime}.${entPostTime.SubjectCol} AS ${POST_SEL.PostUrlKey}
        ${bodySql}
        AND CASE
            WHEN ${ptime}.${entPostTime.SubjectCol} = '${endingMarker}' THEN 1
            WHEN ${pthread}.${entThreadUrlKey.ObjectCol} = '${endingMarker}' THEN 1
            ELSE 0
          END = 1
        `;

        const urlKeyBind = [];
        const urlKeyBound = DBORM.QUERYING.bindConsol(urlKeyBind);
        postUrlKeys = DBORM.QUERYING.fetch(urlKeySql, urlKeyBound).map(function(r) { return r[POST_SEL.PostUrlKey]; });
      }

      const resultSet = {
        endingMarker: endingMarker,
        postUrlKeys: postUrlKeys
      };

      return resultSet;
    }
  }
};