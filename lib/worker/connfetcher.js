// fetching social connections

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

  NETWORK_SEARCH: {
    pageType: 'pageType',
    networkOwner: 'networkOwner',
    // optional
    searchText: 'searchText',
    mutual: 'mutual',
    withMdon: 'withMdon',
    withEmail: 'withEmail',
    withUrl: 'withUrl',
    list: 'list', // name of list to focus on (default to 'favorite')
    requireList: 'requireList', // bool of whether to require membership in the list (indicates whether to left join or inner join)
    skip: 'skip',
    take: 'take',
    graph: 'graph'
    // can later reintroduce 'orderBy' (tried it and it slowed us down without adding much value)
  }
};

// constants for selected-back-as column names
var CONNSELECTED = {
  
  OWNER: {
    Handle: 'Handle',
    Timestamp: 'Timestamp',
    DisplayName: 'DisplayName',
    Detail: 'Detail',
    ImgCdnUrl: 'ImgCdnUrl',
    Img64Url: 'Img64Url'
  },

  NETWORK_SIZE: {
    totalCount: 'totalCount'
  },

  NETWORK_SEARCH: {
    Handle: 'Handle',
    Timestamp: 'Timestamp',
    DisplayName: 'DisplayName',
    Detail: 'Detail',
    ImgCdnUrl: 'ImgCdnUrl',
    Img64Url: 'Img64Url',
    ListName: 'ListName',
    InList: 'InList'
  }
};

var CONNFETCHER = {
  
  networkSearch: function(request) {

    const skip = request.skip || 0;
    const take = request.take || 50;
    
    // prefixes
    const conn = 'conn';
    const display = 'display';
    const descrip = 'descrip';
    const imgcdn = 'imgcdn';
    const img64 = 'img64';
    const mutual = 'mutual';
    const mdon = 'mdon';
    const ema = 'ema';
    const durl = 'durl';
    const lst = 'lst';

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
    const reciproalEntDefn = PAGETYPE.getReciprocalEntDefn(request.pageType);

    const bind = [];
    let conjunction = 'WHERE';
    let ownerCondition = '';

    if (request.networkOwner && request.networkOwner != '*') {
      let parm = {key: '$owner', value: request.networkOwner};
      
      ownerCondition = `${conjunction} ${conn}.${entConn.SubjectCol} = ${parm.key} 
        AND ${conn}.${SCHEMA_CONSTANTS.COLUMNS.NamedGraph} LIKE '${graphFilter}'`;
      
      bind.push(parm);
      conjunction = 'AND';
    }
  
    const searchCols = [
      `${conn}.${entConn.ObjectCol}`, 
      `${display}.${entDisplay.ObjectCol}`, 
      `${descrip}.${entDescription.ObjectCol}`
    ];
    
    const searchClause = DBORM.QUERYING.writeSearchClause(searchCols, request.searchText, conjunction, bind.length);
    let searchClauseSql = '';

    if (searchClause) {
      searchClauseSql = searchClause.sql;
      bind.push(...searchClause.parms);
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
        AND ${mutual}.${equalsConnGraph}`;
    }
    
    if (request.withMdon === true) {
      joinMastodon = `JOIN ${entLinkMdon.Name} ${mdon} ON ${mdon}.${entLinkMdon.SubjectCol} = ${conn}.${entConn.ObjectCol}
        AND ${mdon}.${equalsConnGraph}`;
      
      detail = `${mdon}.${entLinkMdon.ObjectCol}`;
    }
    else if (request.withEmail === true) {
      joinEmail = `JOIN ${entLinkEmail.Name} ${ema} ON ${ema}.${entLinkEmail.SubjectCol} = ${conn}.${entConn.ObjectCol} 
        AND ${ema}.${equalsConnGraph}`;

      detail = `${ema}.${entLinkEmail.ObjectCol}`;
    }
    else if (request.withUrl === true) {
      joinUrl = `JOIN ${entLinkUrl.Name} ${durl} ON ${durl}.${entLinkUrl.SubjectCol} = ${conn}.${entConn.ObjectCol} 
        AND ${durl}.${equalsConnGraph}`;

      detail = `${durl}.${entLinkUrl.ObjectCol}`;
    }
  
    const list = request.list || LIST_FAVORITES;
    bind.push({key: '$list', value: list});
    const listJoinWord = request.requireList ? 'JOIN' : 'LEFT JOIN';

    const joinList = `
      ${listJoinWord} ${entListMember.Name} ${lst}
        ON ${lst}.${entListMember.ObjectCol} = ${conn}.${entConn.ObjectCol}
        AND ${lst}.${entListMember.SubjectCol} = $list
        AND ${lst}.${equalsConnGraph}
        AND ${DBORM.QUERYING.notDeleted(lst)}
      `;

    const sql = `
    SELECT DISTINCT ${conn}.${entConn.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.Handle}, 
        ${conn}.${SCHEMA_CONSTANTS.COLUMNS.Timestamp} AS ${CONNSELECTED.NETWORK_SEARCH.Timestamp},
        ${display}.${entDisplay.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.DisplayName}, 
        ${detail} AS ${CONNSELECTED.NETWORK_SEARCH.Detail},
        ${imgcdn}.${entImgCdnUrl.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.ImgCdnUrl}, 
        ${img64}.${entImg64Url.ObjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.Img64Url},
        ${lst}.${entListMember.SubjectCol} AS ${CONNSELECTED.NETWORK_SEARCH.ListName},
        CASE WHEN ${DBORM.QUERYING.notDeleted(lst)} THEN 1 ELSE 0 END AS ${CONNSELECTED.NETWORK_SEARCH.InList}
    FROM ${entConn.Name} ${conn}
    ${joinMutual}
    ${joinMastodon}
    ${joinEmail}
    ${joinUrl}
    ${joinList}
    LEFT JOIN ${entDisplay.Name} ${display} ON ${display}.${entDisplay.SubjectCol} ${equalsConnObject} 
      AND ${display}.${equalsConnGraph}
    LEFT JOIN ${entDescription.Name} ${descrip} ON ${descrip}.${entDescription.SubjectCol} ${equalsConnObject} 
      AND ${descrip}.${equalsConnGraph}
    LEFT JOIN ${entImgCdnUrl.Name} ${imgcdn} ON ${imgcdn}.${entImgCdnUrl.SubjectCol} ${equalsConnObject} 
      AND ${imgcdn}.${equalsConnGraph}
    LEFT JOIN ${entImg64Url.Name} ${img64} ON ${img64}.${entImg64Url.SubjectCol} ${equalsConnObject} 
      AND ${img64}.${equalsConnGraph}
    ${ownerCondition}
    ${searchClauseSql}
    LIMIT ${take} OFFSET ${skip};
    `;

    let dt = Date.now();

    const bound = DBORM.QUERYING.bindConsol(bind);
    const rows = DBORM.QUERYING.fetch(sql, bound);

    console.log(Date.now() - dt);

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
  inputFollowOwner: function(data) {
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
    const graphCondition = `${conjunction} ${conn}.NamedGraph LIKE '${graphPattern}'`;
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
  }
};