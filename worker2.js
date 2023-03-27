// sqlite.org/wasm/doc/tip/api-oo1.md#stmt
// sql.js.org/documentation/Statement.html
// sql.js.org/#/?id=sqlite-compiled-to-javascript
// sqlite.org/lang_expr.html#varparam
// willschenk.com/articles/2021/sq_lite_in_the_browser/

/*****************************************/
// INITIALIZATION
/*****************************************/

// on startup
// DBORM.LOGGING.log('Loading and initializing sqlite3 module...');
importScripts('/jswasm/sqlite3.js');
importScripts('/lib/shared/constants.js');
importScripts('/lib/shared/settingslib.js');
importScripts('/lib/shared/es6lib.js');
importScripts('/lib/shared/strlib.js');
importScripts('/lib/shared/appgraphs.js');
importScripts('/lib/shared/datatypes.js');
importScripts('/lib/shared/appschema.js');
importScripts('/lib/worker/dbormlib.js');

const getMigrationScripts = function() {
  const scripts = [];
  
  // create import tables
  const sql1 = DBORM.MIGRATION.writeEnsureImportTablesScript(1);
  scripts.push(DBORM.MIGRATION.newScript(sql1, 1));
  
  // create tables for the initial entities
  const initialEntities = [
    APPSCHEMA.SocialConnHasFollower,
    APPSCHEMA.SocialConnIsFollowing,
    APPSCHEMA.SocialConnection,
    APPSCHEMA.SocialProfileDisplayName,
    APPSCHEMA.SocialProfileImgSourceUrl,
    APPSCHEMA.SocialProfileImgBinary,
    APPSCHEMA.SocialProfileLinkMastodonAccount,
    APPSCHEMA.SocialProfileLinkExternalUrl,
    APPSCHEMA.SocialProfileLinkEmailAddress,
    APPSCHEMA.SocialListMember
  ];
  
  const sql2 = DBORM.MIGRATION.writeEnsureEntityTablesStep(initialEntities, 2);
  scripts.push(DBORM.MIGRATION.newScript(sql2, 2));
  
  // if we need to create ad-hoc sql scripts, they can come next (script 3 etc.)
  
  return scripts;
}

self
  .sqlite3InitModule({
    print: DBORM.LOGGING.log,
    printErr: DBORM.LOGGING.error,
  })
  .then(function (sqlite3) {
    // log('Done initializing. Running demo...');
    try {
      _sqlite3 = sqlite3;
      let scripts = getMigrationScripts();
      DBORM.start(scripts);
      // tell index.js that worker is ready to receive on-startup data
      postMessage({ type: 'workerReady' });
    } catch (e) {
      DBORM.LOGGING.error('Exception:', e.message);
    }
  });

/*****************************************/
// RECEIVE MESSAGES
/*****************************************/

// receive message from index.js
onmessage = (evt) => {
  let actionType = getActionType(evt);
  switch(actionType) {
    case MSGTYPE.TODB.XFER_CACHE_TODB:
      // xferCacheToDb(evt.data);
      break;
    case MSGTYPE.TODB.SUGGEST_OWNER:
      // suggestOwner(evt.data);
      break;
    case MSGTYPE.TODB.INPUT_FOLLOW_OWNER:
      // inputFollowOwner(evt.data);
      break;
    case MSGTYPE.TODB.NETWORK_SEARCH:
      // networkSearch(evt.data);
      break;
    case MSGTYPE.TODB.GET_NETWORK_SIZE:
      // getNetworkSize(evt.data);
      break;
    case MSGTYPE.TODB.SET_FAVORITE:
      // setFavorite(evt.data);
      break;
    default:
      break;
  }
};

const getActionType = function(evt) {
  if (evt.data && evt.data.actionType) {
    return evt.data.actionType;
  }
  else if (evt.data && evt.data.val && evt.data.val.actionType) {
    return evt.data.val.actionType;
  }
  else {
    return undefined;
  }
}

