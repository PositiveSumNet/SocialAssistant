// fetching social connections

var CONNREQUEST = {

  OWNER: {
    pageType: 'pageType',
    limit: 'limit',
    searchText: 'searchText'
  }

};

// constants for selected-back-as column names
var CONNSELECTED = {
  
  OWNER: {
    Handle: 'Handle',
    Timestamp: 'Timestamp',
    DisplayName: 'DisplayName',
    Description: 'Description',
    ImgCdnUrl: 'ImgCdnUrl',
    Img64Url: 'Img64Url'
  }

};

var CONNFETCHER = {
  
  // pass in a CONNREQUEST.OWNER
  // suggesting a single owner on init
  suggestOwner: function(data) {
    let rows = searchOwners(data);
    
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
    let rows = searchOwners(data);
    
    if (rows.length > 0) {
      postMessage({ 
        type: MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS,
        payload: { 
          owners: rows
        }
      });
    }
  },

  // pass in a CONNREQUEST.OWNER
  // search across those who own connection data
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
      `${display}.${display}.${entDisplay.ObjectCol}`
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
              ${descrip}.${entDescription.ObjectCol} AS ${CONNSELECTED.OWNER.Description},
              ${imgcdn}.${entImgCdnUrl.ObjectCol} AS ${CONNSELECTED.OWNER.ImgCdnUrl}, 
              ${img64}.${entImg64Url.ObjectCol} AS ${CONNSELECTED.OWNER.Img64Url},
              COUNT(${conn}.${entConn.SubjectCol}) AS Cnt
      FROM ${tblFollow} ${conn}
      LEFT JOIN ${tblDisplay} ${display} ON ${display}.${entDisplay.SubjectCol} ${equalsConnSubject} 
        AND ${display}.${equalsConnGraph}
      LEFT JOIN ${tblDescription} ${descrip} ON ${descrip}.${entDescription.SubjectCol} ${equalsConnSubject} 
        AND ${descrip}.${equalsConnGraph}
      LEFT JOIN ${tblImgCdnUrl} ${imgcdn} ON ${imgcdn}.${entImgCdnUrl.SubjectCol} ${equalsConnSubject} 
        AND ${imgcdn}.${equalsConnGraph}
      LEFT JOIN ${tblImg64Url} ${img64} ON ${img64}.${entImg64Url.SubjectCol} ${equalsConnSubject} 
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