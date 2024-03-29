// fetching social connections
// TODO: When we start ingesting graphs other than from APPGRAPHS.MYSELF, 
// we'll need to (a) normalize all those that are 'mine' (i.e. convert to say MYSELF when imported here)
// and/or (b) use GROUP BY / MAX on networkSearch to avoid duplicates being returned (esp. re mastodon "where I'm following" joiners)

var CONNREQUEST = {

  OWNER: {
    pageType: 'pageType',
    limit: 'limit',
    searchText: 'searchText'
  },

  NETWORK_SIZE: {
    pageType: 'pageType',
    networkOwner: 'networkOwner',
    // optional
    graph: 'graph'
  },

  // request columns
  NETWORK_SEARCH: {
    // shared with POST_SEARCH
    pageType: 'pageType',
    networkOwner: 'networkOwner',
    skip: 'skip',
    take: 'take',
    graph: 'graph',
    // optional
    searchText: 'searchText',
    mutual: 'mutual',
    withMdon: 'withMdon',
    withEmail: 'withEmail',
    withUrl: 'withUrl',
    mdonFollowing: 'mdonFollowing',  // tri-state
    myMastodonHandle: 'myMastodonHandle',    // mdonFollowing is only relevant (and ImFollowingOnMdon only returned) if "my mastodon handle" is passed in here
    list: 'list', // name of list to focus on (default to 'favorite')
    requireList: 'requireList' // bool of whether to require membership in the list (indicates whether to left join or inner join)
    // can later reintroduce 'orderBy' (tried it and it slowed us down without adding much value)
  }
};

// constants for selected-back-as column names
var CONNSELECTED = {
  
  OWNER: {
    // reuse of generic 'person' entity attr names
    Handle: PERSON_ATTR.HANDLE,
    DisplayName: PERSON_ATTR.DISPLAY_NAME,
    Detail: PERSON_ATTR.DETAIL,
    ImgCdnUrl: PERSON_ATTR.IMG_CDN_URL,
    Img64Url: PERSON_ATTR.IMG_64_URL,
    Timestamp: 'Timestamp'
  },

  NETWORK_SIZE: {
    totalCount: 'totalCount'
  },

  // result columns
  NETWORK_SEARCH: {
    // reuse of generic 'person' entity attr names
    Handle: PERSON_ATTR.HANDLE,
    DisplayName: PERSON_ATTR.DISPLAY_NAME,
    Detail: PERSON_ATTR.DETAIL,
    ImgCdnUrl: PERSON_ATTR.IMG_CDN_URL,
    Img64Url: PERSON_ATTR.IMG_64_URL,
    FollowersCount: PERSON_ATTR.FOLLOWERS_COUNT,
    FollowingCount: PERSON_ATTR.FOLLOWING_COUNT,
    SourceId: PERSON_ATTR.SOURCE_ID,
    Timestamp: 'Timestamp',
    ListName: 'ListName',
    InList: 'InList',
    ImFollowingOnMdon: 'ImFollowingOnMdon'
  }
};

var CONNFETCHER = {
  
  MASTODON_CONDITION_WRITER: {
    
    emptyResult: function() {
      return {
        selectSql: '',
        joinSql: '',
        andSql: '',
        parms: []
      };
    },

    queryWriteWorker: function(request, following, linkToAlias, linkToEntity, conjunction) {
      const result = CONNFETCHER.MASTODON_CONDITION_WRITER.emptyResult();
      const mcon = 'mcon';
      const entMcon = APPSCHEMA.SocialConnIsFollowing;
      const graphFilter = APPGRAPHS.getGraphBySite(SITE.MASTODON);
      result.parms.push({ key: '$myMdon', value: request.myMastodonHandle });
      
      let existsClause = `(
        SELECT 1
        FROM ${entMcon.Name} ${mcon}
        WHERE ${mcon}.${entMcon.ObjectCol} = ${linkToAlias}.${linkToEntity.ObjectCol}
          AND ${mcon}.${entMcon.SubjectCol} = $myMdon
          AND ${mcon}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
      )`;

      switch (following) {
        case true:
          // WHERE EXISTS
          result.selectSql = `1 AS ${CONNSELECTED.NETWORK_SEARCH.ImFollowingOnMdon},`
          result.andSql = `${conjunction} EXISTS ${existsClause}`;

          break;
        case false:
          // WHERE NOT EXISTS
          result.selectSql = `0 AS ${CONNSELECTED.NETWORK_SEARCH.ImFollowingOnMdon},`
          result.andSql = `${conjunction} NOT EXISTS ${existsClause}`;

          break;
        case undefined:
        default:
          // LEFT JOIN
          result.selectSql = `CASE WHEN ${mcon}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} IS NOT NULL THEN 1 ELSE 0 END AS ${CONNSELECTED.NETWORK_SEARCH.ImFollowingOnMdon},`;

          result.joinSql = `LEFT JOIN ${entMcon.Name} ${mcon} 
          ON ${mcon}.${entMcon.ObjectCol} = ${linkToAlias}.${linkToEntity.ObjectCol}
          AND ${mcon}.${entMcon.SubjectCol} = $myMdon
          AND ${mcon}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
          `;

          break;
      }

      return result;
    },

    twitterQueryWriteWorker: function(request, following, conjunction) {
      const entLinkMdon = APPSCHEMA.SocialProfileLinkMastodonAccount;
      return CONNFETCHER.MASTODON_CONDITION_WRITER.queryWriteWorker(request, following, 'mdon', entLinkMdon, conjunction);
    },

    mdonQueryWriteWorker: function(request, following, conjunction) {
      const entConn = PAGETYPE.getRootEntDefn(request.pageType);
      return CONNFETCHER.MASTODON_CONDITION_WRITER.queryWriteWorker(request, following, 'conn', entConn, conjunction);
    },

    twitterQueryWhereImFollowingResult: function(request, conjunction) {
      return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryWriteWorker(request, true, conjunction);
    },

    twitterQueryWhereImNotFollowingResult: function(request, conjunction) {
      return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryWriteWorker(request, false, conjunction);
    },

    twitterQueryUnconditionedResult: function(request, conjunction) {
      return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryWriteWorker(request, undefined, conjunction);
    },

    mdonQueryWhereImFollowingResult: function(request, conjunction) {
      return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryWriteWorker(request, true, conjunction);
    },

    mdonQueryWhereImNotFollowingResult: function(request, conjunction) {
      return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryWriteWorker(request, false, conjunction);
    },

    mdonQueryUnconditionedResult: function(request, conjunction) {
      return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryWriteWorker(request, undefined, conjunction);
    },

    twitterQueryResult: function(request, conjunction) {
      switch (request.mdonFollowing) {
        case true:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryWhereImFollowingResult(request, conjunction);
        case false:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryWhereImNotFollowingResult(request, conjunction);
        case undefined:
        default:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryUnconditionedResult(request, conjunction);
      }
    },

    mdonQueryResult: function(request, conjunction) {
      switch (request.mdonFollowing) {
        case true:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryWhereImFollowingResult(request, conjunction);
        case false:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryWhereImNotFollowingResult(request, conjunction);
        case undefined:
        default:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryUnconditionedResult(request, conjunction);
      }
    },

    // using the same aliases as networkSearch()
    // selectSql includes trailing comma
    writeResult: function(request, conjunction) {
      let result = CONNFETCHER.MASTODON_CONDITION_WRITER.emptyResult();

      if (!request.myMastodonHandle) {
        return result;
      }

      const site = PAGETYPE.getSite(request.pageType);
      switch (site) {
        case SITE.TWITTER:
          if (request.withMdon != true) {
            return result;
          }
          else {
            return CONNFETCHER.MASTODON_CONDITION_WRITER.twitterQueryResult(request, conjunction);
          }
        case SITE.MASTODON:
          return CONNFETCHER.MASTODON_CONDITION_WRITER.mdonQueryResult(request, conjunction);
        default:
          return result;
      }
    }
  },

  networkSearch: function(request) {
    const skip = request.skip || 0;
    const take = request.take || 50;
    
    // prefixes
    const conn = 'conn';
    const display = 'display';
    const descrip = 'descrip';
    const imgcdn = 'imgcdn';
    const mutual = 'mutual';
    const durl = 'durl';
    const lst = 'lst';

    let img64 = 'img64';
    let mdon = 'mdon';
    let ema = 'ema';
    let followersCount = 'fercount';
    let followingCount = 'fingcount';
    let srcId = 'srcid';

    const site = PAGETYPE.getSite(request.pageType);

    // site-specific query rules applied
    switch (site) {
      case SITE.TWITTER:
        // we're starting to pull these via nitter, commented out the lines below
        //followersCount = undefined;
        //followingCount = undefined;
        srcId = undefined;
        break;
      case SITE.MASTODON:
        // these aren't stored/supported for mdon; don't waste energy on them
        img64 = undefined;
        ema = undefined;
        mdon = undefined; // we don't call out other mdon links within an mdon profile
        // at one point we were storing and fetching the 'id' of mastodon accounts.
        // but they depend on which server got asked for the information, which makes them 
        // unusable for our use case of exploring different servers' connections
        srcId = undefined;
        break;
      default:
        break;
    }

    const graphFilter = request.graph || APPGRAPHS.getGraphsStartWithByPageType(request.pageType);
    const entConn = PAGETYPE.getRootEntDefn(request.pageType);
    const entDisplay = APPSCHEMA.SocialProfileDisplayName;
    const entDescription = APPSCHEMA.SocialProfileDescription;
    const entImgCdnUrl = APPSCHEMA.SocialProfileImgSourceUrl;
    const entImg64Url = APPSCHEMA.SocialProfileImgBinary;
    const entLinkMdon = APPSCHEMA.SocialProfileLinkMastodonAccount;
    const entLinkUrl = APPSCHEMA.SocialProfileLinkExternalUrl;
    const entLinkEmail = APPSCHEMA.SocialProfileLinkEmailAddress;
    const entListMember = APPSCHEMA.SocialListMember;
    const entFollowersCount = APPSCHEMA.SocialFollowerCount;
    const entFollowingCount = APPSCHEMA.SocialFollowingCount;
    const entSrcId = APPSCHEMA.SocialSourceIdentifier;
    const reciproalEntDefn = PAGETYPE.getReciprocalEntDefn(request.pageType);

    const bind = [];
    let ownerCondition = `WHERE ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} LIKE '${graphFilter}'`;
    let conjunction = 'AND';

    if (request.networkOwner && request.networkOwner != '*') {
      let parm = {key: '$owner', value: request.networkOwner};
      ownerCondition = `${ownerCondition}
        ${conjunction} ${conn}.${entConn.SubjectCol} = ${parm.key}`;
      
      bind.push(parm);
      conjunction = 'AND';
    }
  
    // special filters
    let joinMutual = '';
    let joinMastodon = '';
    let joinEmail = '';
    let joinUrl = '';

    // by default we return back the description
    // if a special report (email, url, mdon), we return that instead (to render in the same template)
    let detail = `${descrip}.${entDescription.ObjectCol}`;

    // see if we need a join from the follower to the following table (or vice versa)
    const needMutualityCondition = request.mutual && reciproalEntDefn != undefined;

    const equalsConnGraph = `${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}`;
    const equalsConnSubject = `= ${conn}.${entConn.SubjectCol}`;
    const equalsConnObject = `= ${conn}.${entConn.ObjectCol}`;

    if (needMutualityCondition === true) {
      joinMutual = `
      JOIN ${reciproalEntDefn.Name} ${mutual} ON ${mutual}.${reciproalEntDefn.ObjectCol} = ${conn}.${entConn.ObjectCol}
        AND ${mutual}.${reciproalEntDefn.SubjectCol} ${equalsConnSubject}
        AND ${mutual}.${equalsConnGraph}
        AND ${DBORM.QUERYING.existsAndNotDeleted(mutual)}`;
    }
    
    // By default we search the full description field.
    // But if we're focused specifically on one of these filters, then 
    // we should restrict to that subset (e.g. the URL) to avoid duped records on the same person
    let detailSearchCol = `${descrip}.${entDescription.ObjectCol}`;
    
    if (mdon && request.withMdon === true) {
      joinMastodon = `JOIN ${entLinkMdon.Name} ${mdon} ON ${mdon}.${entLinkMdon.SubjectCol} = ${conn}.${entConn.ObjectCol}
        AND ${mdon}.${equalsConnGraph}
        AND ${DBORM.QUERYING.existsAndNotDeleted(mdon)}`;
      
      detail = `${mdon}.${entLinkMdon.ObjectCol}`;
      detailSearchCol = detail;
    }
    else if (ema && request.withEmail === true) {
      joinEmail = `JOIN ${entLinkEmail.Name} ${ema} ON ${ema}.${entLinkEmail.SubjectCol} = ${conn}.${entConn.ObjectCol} 
        AND ${ema}.${equalsConnGraph}
        AND ${DBORM.QUERYING.existsAndNotDeleted(ema)}`;

      detail = `${ema}.${entLinkEmail.ObjectCol}`;
      detailSearchCol = detail;
    }
    else if (request.withUrl === true) {
      joinUrl = `JOIN ${entLinkUrl.Name} ${durl} ON ${durl}.${entLinkUrl.SubjectCol} = ${conn}.${entConn.ObjectCol} 
        AND ${durl}.${equalsConnGraph}
        AND ${DBORM.QUERYING.existsAndNotDeleted(durl)}`;

      detail = `${durl}.${entLinkUrl.ObjectCol}`;
      detailSearchCol = detail;
    }
  
    const searchCols = [
      `${conn}.${entConn.ObjectCol}`, 
      `${display}.${entDisplay.ObjectCol}`, 
      `${detailSearchCol}`
    ];
    
    const searchClause = DBORM.QUERYING.writeSearchClause(searchCols, request.searchText, conjunction, bind.length);
    let searchClauseSql = '';

    if (searchClause) {
      searchClauseSql = searchClause.sql;
      bind.push(...searchClause.parms);
      conjunction = 'AND';
    }
  
    const list = request.list || LIST_FAVORITES;
    bind.push({key: '$list', value: list});
    const listJoinWord = request.requireList ? 'JOIN' : 'LEFT JOIN';

    const joinList = `
      ${listJoinWord} ${entListMember.Name} ${lst}
        ON ${lst}.${entListMember.ObjectCol} = ${conn}.${entConn.ObjectCol}
        AND ${lst}.${entListMember.SubjectCol} = $list
        AND ${lst}.${equalsConnGraph}
        AND ${DBORM.QUERYING.existsAndNotDeleted(lst)}
      `;

    // site-specific support for these aspects of the query
    let img64Selection = '';
    let img64Joiner = '';
    if (img64) {
      img64Selection = `${img64}.${entImg64Url.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.Img64Url},`;
      img64Joiner = `LEFT JOIN ${entImg64Url.Name} ${img64} ON ${img64}.${entImg64Url.SubjectCol} ${equalsConnObject} 
        AND ${img64}.${equalsConnGraph}`;
    }

    let followersCountSelection = '';
    let followersCountJoiner = '';
    if (followersCount) {
      followersCountSelection = `${followersCount}.${entFollowersCount.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.FollowersCount},`;
      followersCountJoiner = `LEFT JOIN ${entFollowersCount.Name} ${followersCount} ON ${followersCount}.${entFollowersCount.SubjectCol} ${equalsConnObject} 
        AND ${followersCount}.${equalsConnGraph}`;
    }

    let followingCountSelection = '';
    let followingCountJoiner = '';
    if (followingCount) {
      followingCountSelection = `${followingCount}.${entFollowingCount.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.FollowingCount},`;
      followingCountJoiner = `LEFT JOIN ${entFollowingCount.Name} ${followingCount} ON ${followingCount}.${entFollowingCount.SubjectCol} ${equalsConnObject} 
        AND ${followingCount}.${equalsConnGraph}`;
    }

    let srcIdSelection = '';
    let srcIdJoiner = '';
    if (srcId) {
      srcIdSelection = `${srcId}.${entSrcId.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.SourceId},`;
      srcIdJoiner = `LEFT JOIN ${entSrcId.Name} ${srcId} ON ${srcId}.${entSrcId.SubjectCol} ${equalsConnObject} 
        AND ${srcId}.${equalsConnGraph}`;
    }

    const mdonCondition = CONNFETCHER.MASTODON_CONDITION_WRITER.writeResult(request, conjunction);
    bind.push(...mdonCondition.parms);

    const sql = `
    SELECT ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} AS ${SCHEMA_CONSTANTS.COLUMNS.NamedGraph},
        ${conn}.${entConn.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.Handle}, 
        ${conn}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} AS ${CONNSELECTED.NETWORK_SEARCH.Timestamp},
        ${display}.${entDisplay.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.DisplayName}, 
        ${detail} AS ${CONNSELECTED.NETWORK_SEARCH.Detail},
        ${imgcdn}.${entImgCdnUrl.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.ImgCdnUrl}, 
        ${followersCountSelection}
        ${followingCountSelection}
        ${img64Selection}
        ${srcIdSelection}
        ${mdonCondition.selectSql}
        ${lst}.${entListMember.SubjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.ListName},
        CASE WHEN ${DBORM.QUERYING.existsAndNotDeleted(lst)} THEN 1 ELSE 0 END AS ${CONNSELECTED.NETWORK_SEARCH.InList}
    FROM ${entConn.Name} ${conn}
    ${joinMutual}
    ${joinMastodon}
    ${joinEmail}
    ${joinUrl}
    ${mdonCondition.joinSql}
    ${joinList}
    LEFT JOIN ${entDisplay.Name} ${display} ON ${display}.${entDisplay.SubjectCol} ${equalsConnObject} 
      AND ${display}.${equalsConnGraph}
    LEFT JOIN ${entDescription.Name} ${descrip} ON ${descrip}.${entDescription.SubjectCol} ${equalsConnObject} 
      AND ${descrip}.${equalsConnGraph}
    LEFT JOIN ${entImgCdnUrl.Name} ${imgcdn} ON ${imgcdn}.${entImgCdnUrl.SubjectCol} ${equalsConnObject} 
      AND ${imgcdn}.${equalsConnGraph}
    ${followersCountJoiner}
    ${followingCountJoiner}
    ${img64Joiner}
    ${srcIdJoiner}
    ${ownerCondition}
    ${searchClauseSql}
    ${mdonCondition.andSql}
    LIMIT ${take} OFFSET ${skip};
    `;

    let dt = Date.now();
    const bound = DBORM.QUERYING.bindConsol(bind);
    const rows = DBORM.QUERYING.fetch(sql, bound);
    console.log(`${Date.now() - dt} ms`);
    
    // post back to UI
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.CONNECTIONS,
      payload: { 
        request: request, 
        rows: rows
        }
    });  
  },

  // pass in a CONNREQUEST.NETWORK_SIZE
  getNetworkSize: function(request) {
    const graphFilter = request.graph || APPGRAPHS.getGraphsStartWithByPageType(request.pageType);
    const entDefn = PAGETYPE.getRootEntDefn(request.pageType);

    // tbc, parameter is named $owner
    const sql = `
    SELECT COUNT(*) AS ${CONNSELECTED.NETWORK_SIZE.totalCount} 
    FROM ${entDefn.Name} conn
    WHERE conn.${entDefn.SubjectCol} = $owner
      AND conn.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} LIKE '${graphFilter}';
    `;
    
    const bound = {$owner: request.networkOwner};
    const rows = DBORM.QUERYING.fetch(sql, bound);

    let cnt = 0;
    if (rows.length === 1) {
      const row = rows[0];
      cnt = parseInt(row[CONNSELECTED.NETWORK_SIZE.totalCount]);
    }

    // post back to UI
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.NETWORK_SIZE,
      payload: { 
        totalCount: cnt,
        request: request
      }
    });  

  },

  // pass in a CONNREQUEST.OWNER
  // suggesting a single owner on init
  suggestOwner: function(data) {
    const rows = CONNFETCHER.searchOwners(data);
    
    if (rows.length === 1) {
      postMessage({ 
        type: MSGTYPE.FROMDB.RENDER.SUGGESTED_OWNER,
        payload: { 
          owner: rows[0]
        }
      });
    }
  },

  // pass in a CONNREQUEST.OWNER
  // find owners matching the search
  inputOwner: function(data) {
    const rows = CONNFETCHER.searchOwners(data);
    
    postMessage({ 
      type: MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS,
      payload: { 
        owners: rows
      }
    });
  },

  // pass in a CONNREQUEST.OWNER
  // search across those who own connection data
  // passes back results (caller should post message back to UI)
  searchOwners: function(data) {
    const pageType = data.pageType;
    const limit = data.limit || 1;
    const searchText = data.searchText || '';
    
    const entConn = PAGETYPE.getRootEntDefn(pageType);
    const entDisplay = APPSCHEMA.SocialProfileDisplayName;
    const entDescription = APPSCHEMA.SocialProfileDescription;
    const entImgCdnUrl = APPSCHEMA.SocialProfileImgSourceUrl;
    const entImg64Url = APPSCHEMA.SocialProfileImgBinary;
    
    const bind = [];
    let conjunction = 'WHERE';
    
    // prefixes
    const conn = 'conn';
    const display = 'display';
    const descrip = 'descrip';
    const imgcdn = 'imgcdn';
    const img64 = 'img64';

    const graphPattern = APPGRAPHS.getGraphsStartWithByPageType(pageType);
    const graphCondition = `${conjunction} ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} LIKE '${graphPattern}'`;
    conjunction = 'AND'

    const searchCols = [
      `${conn}.${entConn.SubjectCol}`, 
      `${display}.${entDisplay.ObjectCol}`
    ];

    const searchClause = DBORM.QUERYING.writeSearchClause(searchCols, searchText, conjunction, bind.length);
    let searchClauseSql = '';
    
    if (searchClause && searchClause.sql.length > 0) {
      searchClauseSql = searchClause.sql;
      bind.push(...searchClause.parms);
    }
    
    const equalsConnGraph = `${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}`;
    const equalsConnSubject = `= ${conn}.${entConn.SubjectCol}`;

    const sql = `
    SELECT x.*
    FROM (
      SELECT  ${conn}.${entConn.SubjectCol} AS ${CONNSELECTED.OWNER.Handle}, 
              MAX(${conn}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp}) AS ${CONNSELECTED.OWNER.Timestamp},
              ${display}.${entDisplay.ObjectCol} AS ${CONNSELECTED.OWNER.DisplayName}, 
              ${descrip}.${entDescription.ObjectCol} AS ${CONNSELECTED.OWNER.Detail},
              ${imgcdn}.${entImgCdnUrl.ObjectCol} AS ${CONNSELECTED.OWNER.ImgCdnUrl}, 
              ${img64}.${entImg64Url.ObjectCol} AS ${CONNSELECTED.OWNER.Img64Url},
              COUNT(${conn}.${entConn.SubjectCol}) AS Cnt
      FROM ${entConn.Name} ${conn}
      LEFT JOIN ${entDisplay.Name} ${display} ON ${display}.${entDisplay.SubjectCol} ${equalsConnSubject} 
        AND ${display}.${equalsConnGraph}
      LEFT JOIN ${entDescription.Name} ${descrip} ON ${descrip}.${entDescription.SubjectCol} ${equalsConnSubject} 
        AND ${descrip}.${equalsConnGraph}
      LEFT JOIN ${entImgCdnUrl.Name} ${imgcdn} ON ${imgcdn}.${entImgCdnUrl.SubjectCol} ${equalsConnSubject} 
        AND ${imgcdn}.${equalsConnGraph}
      LEFT JOIN ${entImg64Url.Name} ${img64} ON ${img64}.${entImg64Url.SubjectCol} ${equalsConnSubject} 
        AND ${img64}.${equalsConnGraph}
      ${graphCondition}
      ${searchClauseSql}
      GROUP BY ${conn}.${entConn.SubjectCol}, 
        ${display}.${entDisplay.ObjectCol}, 
        ${descrip}.${entDescription.ObjectCol}, 
        ${imgcdn}.${entImgCdnUrl.ObjectCol}, 
        ${img64}.${entImg64Url.ObjectCol}
    ) x
    ORDER BY x.Cnt DESC
    LIMIT ${limit};
    `;
  
    const bound = DBORM.QUERYING.bindConsol(bind);
    const rows = DBORM.QUERYING.fetch(sql, bound);
    return rows;
  },

  // fetchers used to get data for pushing to backup
  SYNC: {
    getFavorites: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const entList = APPSCHEMA.SocialListMember;
      const lst = 'lst';
  
      const sql = `
      SELECT ${lst}.${entList.ObjectCol} AS ${SYNC_COL.FAVORITES.Handle},
        ${lst}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
        ${lst}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}
      FROM ${entList.Name} ${lst}
      WHERE ${lst}.${entList.SubjectCol} = '${LIST_FAVORITES}'
        AND ${lst}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
        AND ${DBORM.QUERYING.existsAndNotDeleted(lst)}
      ORDER BY ${lst}.${entList.ObjectCol};
      `;

      const bind = [];
      const bound = DBORM.QUERYING.bindConsol(bind);
      const rows = DBORM.QUERYING.fetch(sql, bound);

      return rows;
    },

    usesBase64Avatars: function(site) {
      switch(site) {
        case SITE.TWITTER:
          return true;
        case SITE.MASTODON:
        default:
          return false;
      }
    },

    getAlphaMarkerPredicate: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      let handlePrefix = '';
      switch (site) {
        case SITE.TWITTER:
        case SITE.MASTODON:
          // sHandle for these starts with @ in our db
          handlePrefix = '@';
          break;
        default:
          break;
      }

      // console.log(step.marker);
      const isStart = !STR.hasLen(step.marker) || step.marker == FIRST_TEXT_START;
      let markerChar = (isStart) ? '' : step.marker.substring(0, 1);
      let markerFilterPredicate;
      switch (markerChar) {
        case '':
          markerFilterPredicate = `< '${handlePrefix}a'`;
          break;
        case 'z':
          markerFilterPredicate = `>= '${handlePrefix}z'`;
          break;
        default:
          markerFilterPredicate = `LIKE '${handlePrefix}${markerChar}%'`;
          break;
      }

      return markerFilterPredicate;
    },

    // Can reconstitute child accounts upon ingestion via STR.extractAccounts
    // and the utility of having it searchable at github is relatively low, 
    // so for now we aren't including them in the backup explicitly
    // step marker is expected to be an alpha character (or empty string)
    getProfiles: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const entDisplay = APPSCHEMA.SocialProfileDisplayName;
      const entDescription = APPSCHEMA.SocialProfileDescription;
      const disp = 'disp';
      const desc = 'desc';

      const bind = [];
      const markerFilterPredicate = CONNFETCHER.SYNC.getAlphaMarkerPredicate(step);
      const andGraphMatch = `AND ${desc}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = ${disp}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}`;

      const sql = `
      SELECT ${disp}.${entDisplay.SubjectCol} AS ${SYNC_COL.PROFILES.Handle},
        ${disp}.${entDisplay.ObjectCol} AS ${SYNC_COL.PROFILES.Display},
        ${desc}.${entDescription.ObjectCol} AS ${SYNC_COL.PROFILES.Detail},
        ${disp}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
        ${desc}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} AS ${SYNC_COL.PROFILES.DetailTimestamp},
        ${disp}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}
      FROM ${entDisplay.Name} ${disp}
      LEFT JOIN ${entDescription.Name} ${desc} ON ${desc}.${entDescription.SubjectCol} = ${disp}.${entDisplay.SubjectCol}
        ${andGraphMatch}
      WHERE ${disp}.${entDisplay.SubjectCol} ${markerFilterPredicate}
        AND ${disp}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
      ORDER BY ${disp}.${entDisplay.SubjectCol};
      `;

      const bound = DBORM.QUERYING.bindConsol(bind);
      const rows = DBORM.QUERYING.fetch(sql, bound);
      return rows;
    },

    getProfileImgs: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const usesB64 = CONNFETCHER.SYNC.usesBase64Avatars(site);
      const b64Value = (usesB64 == true) ? 1 : 0;
      const entImg = (usesB64 == true) ? APPSCHEMA.SocialProfileImgBinary : APPSCHEMA.SocialProfileImgSourceUrl;
      const img = 'img';

      const bind = [];
      const markerFilterPredicate = CONNFETCHER.SYNC.getAlphaMarkerPredicate(step);

      const sql = `
      SELECT ${img}.${entImg.SubjectCol} AS ${SYNC_COL.PROFILE_IMGS.Handle},
        ${img}.${entImg.ObjectCol} AS ${SYNC_COL.PROFILE_IMGS.Img},
        ${b64Value} AS ${SYNC_COL.PROFILE_IMGS.IsB64},
        ${img}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
        ${img}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}
      FROM ${entImg.Name} ${img}
      WHERE ${img}.${entImg.SubjectCol} ${markerFilterPredicate}
        AND ${img}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
      ORDER BY ${img}.${entImg.SubjectCol};
      `;

      const bound = DBORM.QUERYING.bindConsol(bind);
      const rows = DBORM.QUERYING.fetch(sql, bound);
      return rows;
    },

    // marker is the prior subject handle (or empty string at the beginning)
    // grab for one network owner at a time
    getNetworkConns: function(step) {
      const site = SYNCFLOW.getSite(step.network);
      const direction = SYNCFLOW.getConnDirection(step);
      const pageType = PAGETYPE.getPageType(site, direction);
      const graphFilter = APPGRAPHS.getGraphBySite(site);
      const entConn = PAGETYPE.getRootEntDefn(pageType);
      const conn = 'conn';

      const bind = [];

      let markerFilter = '';
      const isStart = !STR.hasLen(step.marker) || step.marker == FIRST_TEXT_START || step.marker == FIRST_TEXT_END;
      if (!isStart) {
        let parm = {key: '$marker', value: step.marker};
        bind.push(parm);
        const oper = step[SYNCFLOW.STEP.exact] == true ? '=' : '>';
        markerFilter = `  AND ${conn}.${entConn.SubjectCol} ${oper} ${parm.key}`;
      }

      const sql = `;with cte AS (
        SELECT DISTINCT ${conn}.${entConn.SubjectCol}
        FROM ${entConn.Name} ${conn}
        WHERE ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
        ${markerFilter}
        ORDER BY ${conn}.${entConn.SubjectCol} ASC
        LIMIT 1
      )
      SELECT ${conn}.${entConn.SubjectCol} AS ${SYNC_COL.NETWORK.Handle},
        ${conn}.${entConn.ObjectCol} AS ${SYNC_COL.NETWORK.Connection},
        ${conn}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp},
        ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph}
      FROM ${entConn.Name} ${conn}
      JOIN cte c ON c.${entConn.SubjectCol} = ${conn}.${entConn.SubjectCol}
      WHERE ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} = '${graphFilter}'
      ORDER BY ${conn}.${entConn.ObjectCol};
      `;

      const bound = DBORM.QUERYING.bindConsol(bind);
      const rows = DBORM.QUERYING.fetch(sql, bound);
      return rows;
    }
  }
};