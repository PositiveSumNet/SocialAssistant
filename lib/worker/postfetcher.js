// request columns
var POSTREQUEST = {
  // shared with NETWORK_SEARCH
  pageType: 'pageType',
  networkOwner: 'networkOwner',
  skip: 'skip',
  take: 'take',
  graph: 'graph'
};

// constants for selected-back-as column names
var POST_SEL = {
  PostUrlKey: 'PostUrlKey',
  PostTime: 'PostTime',
  AuthorHandle: 'AuthorHandle',
  AuthorName: 'AuthorName',
  AuthorImgCdnUrl: 'AuthorImgCdnUrl',
  AuthorImg64Url: 'AuthorImg64Url',
  ReplyToUrlKey: 'ReplyToUrlKey',
  ThreadUrlKey: 'ThreadUrlKey',
  PostText: 'PostText',
  ReposterHandle: 'ReposterHandle',
  ReposterName: 'ReposterName',
  QuoteOfUrlKey: 'QuoteOfUrlKey',
  CardText: 'CardText',
  CardShortUrl: 'CardShortUrl',
  CardFullUrl: 'CardFullUrl',
  // for child Images
  CardImgCdnUrl: 'CardImgCdnUrl',
  CardImg64Url: 'CardImg64Url',
  // child objects
  QuoteTweet: 'QuoteTweet',
  ReplyToTweet: 'ReplyToTweet',
  Images: 'Images'
};

var REG_IMG_SEL = {
  PostUrlKey: 'PostUrlKey',
  RegImg64Url: 'RegImg64Url'
};

var SPECIFIC_URL_KEYS_AS = {
  GET_THESE: 'getThese',
  GET_NEXT_REPLIES: 'getNextReplies'
};

var POSTFETCHER = {
  
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

    const searchCols = [
      `${psrch}.${entSearchBlob.ObjectCol}`,
      `${csrch}.${entCardSearchBlob.ObjectCol}`
    ];

    const bind = [];
    let urlKeyCondition = '';
    let authorCondition = '';
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
        searchClauseSql = searchClause.wrappedSql;
        bind.push(...searchClause.parms);
      }
      orderBy = `ORDER BY ${ptime}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} DESC`;

      if (STR.hasLen(request.networkOwner)) {
        authorCondition = `  AND ${ahandle}.${entAuthorHandle.ObjectCol} = $author`;
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
    LEFT JOIN ${entProfileName.Name} ${aname} ON ${aname}.${entProfileName.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${aname}.${graphMatchRhs}
    LEFT JOIN ${entProfileImgCdnUrl.Name} ${acdnurl} ON ${acdnurl}.${entProfileImgCdnUrl.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${acdnurl}.${graphMatchRhs}
    LEFT JOIN ${entProfileImg64Url.Name} ${a64url} ON ${a64url}.${entProfileImg64Url.SubjectCol} = ${ahandle}.${entAuthorHandle.ObjectCol}
      AND ${a64url}.${graphMatchRhs}
    LEFT JOIN ${entPostText.Name} ${ptext} ON ${ptext}.${entPostText.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${ptext}.${graphMatchRhs}
    LEFT JOIN ${entReposter.Name} ${preposter} ON ${preposter}.${entReposter.SubjectCol} = ${ptime}.${entPostTime.SubjectCol}
      AND ${preposter}.${graphMatchRhs}
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
    WHERE ${ptime}.${graphMatchRhs}
    ${urlKeyCondition}
    ${authorCondition}
    ${searchClauseSql}
    ${orderBy}
    ${paging};
    `;

    const bound = DBORM.QUERYING.bindConsol(bind);
    let rows = DBORM.QUERYING.fetch(sql, bound);

    POSTFETCHER.infuseRegularImages(rows, graphMatchRhs);
    return rows;
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