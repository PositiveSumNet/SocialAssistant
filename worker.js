// sqlite.org/wasm/doc/tip/api-oo1.md#stmt
// sql.js.org/documentation/Statement.html
// sql.js.org/#/?id=sqlite-compiled-to-javascript
// sqlite.org/lang_expr.html#varparam
// willschenk.com/articles/2021/sq_lite_in_the_browser/
// javascript.plainenglish.io/a-beginners-guide-to-setting-up-and-using-sqlite-3-in-a-browser-based-application-9e60cefe75ce

/*****************************************/
// INITIALIZATION
/*****************************************/

// on startup
// DBORM.LOGGING.log('Loading and initializing sqlite3 module...');
importScripts('/jswasm/sqlite3.js');
importScripts('/lib/shared/constants.js');
importScripts('/lib/shared/pagetypes.js');
importScripts('/lib/shared/settingslib.js');
importScripts('/lib/shared/es6lib.js');
importScripts('/lib/shared/strlib.js');
importScripts('/lib/shared/appgraphs.js');
importScripts('/lib/shared/datatypes.js');
importScripts('/lib/shared/appschema.js');
importScripts('/lib/shared/queue.js');
importScripts('/lib/worker/dbormlib.js');
importScripts('/lib/worker/twitterconnsavemapper.js');
importScripts('/lib/worker/mastodonconnsavemapper.js');
importScripts('/lib/worker/savemapperfactory.js');
importScripts('/lib/worker/connfetcher.js');

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

const _initialEntities = [
  APPSCHEMA.SocialConnHasFollower,
  APPSCHEMA.SocialConnIsFollowing,
  APPSCHEMA.SocialConnection,
  APPSCHEMA.SocialProfileDisplayName,
  APPSCHEMA.SocialProfileDescription,
  APPSCHEMA.SocialProfileImgSourceUrl,
  APPSCHEMA.SocialProfileImgBinary,
  APPSCHEMA.SocialProfileLinkMastodonAccount,
  APPSCHEMA.SocialProfileLinkExternalUrl,
  APPSCHEMA.SocialProfileLinkEmailAddress,
  APPSCHEMA.SocialListMember
];

const _script4Entities = [
  APPSCHEMA.SocialFollowerCount,
  APPSCHEMA.SocialFollowingCount,
  APPSCHEMA.SocialSourceIdentifier
];

const getAllEntities = function() {
  const arr = [];
  // as we add more entities beyond the initial set, this array will be a superset
  arr.push(..._initialEntities);
  arr.push(..._script4Entities);
  return arr;
}

const getMigrationScripts = function() {
  const scripts = [];
  
  const negationTime = DBORM.getNowTime(true);  // true is to semantically negate (see comment at top of DBORM)

  // note: script 1 was the initialization script that established the Migration table

  // create import tables
  const sql2 = DBORM.MIGRATION.writeEnsureImportTablesScript(2);
  scripts.push(DBORM.MIGRATION.newScript(sql2, 2));
  
  // create tables for the initial entities
  
  const sql3 = DBORM.MIGRATION.writeEnsureEntityTablesStep(_initialEntities, 3);
  scripts.push(DBORM.MIGRATION.newScript(sql3, 3));
  
  const sql4 = DBORM.MIGRATION.writeEnsureEntityTablesStep(_script4Entities, 4);
  scripts.push(DBORM.MIGRATION.newScript(sql4, 4));
  
  // script 5 is because we sometimes mistook post.news as mastodon
  const sql5 = `UPDATE SocialProfileLinkMastodonAccount SET Timestamp = ${negationTime} WHERE oValue LIKE '%post.news%';
    ${DBORM.MIGRATION.writeUpdateMigrationVersionSql(5)}`;

  scripts.push(DBORM.MIGRATION.newScript(sql5, 5));

  return scripts;
}

/*****************************************/
// RECEIVE MESSAGES
/*****************************************/

// receive message from index.js
onmessage = (evt) => {
  let actionType = getActionType(evt);
  switch(actionType) {
    case MSGTYPE.TODB.XFER_CACHE_TODB:
      DBORM.SAVING.xferCacheToDb(evt.data);
      break;
    case MSGTYPE.TODB.SUGGEST_OWNER:
      CONNFETCHER.suggestOwner(evt.data);
      break;
    case MSGTYPE.TODB.INPUT_FOLLOW_OWNER:
      CONNFETCHER.inputFollowOwner(evt.data);
      break;
    case MSGTYPE.TODB.NETWORK_SEARCH:
      CONNFETCHER.networkSearch(evt.data);
      break;
    case MSGTYPE.TODB.GET_NETWORK_SIZE:
      CONNFETCHER.getNetworkSize(evt.data);
      break;
    case MSGTYPE.TODB.SET_LIST_MEMBER:
      DBORM.SAVING.setListMember(evt.data);
      break;
    case MSGTYPE.TODB.EXPORT_BACKUP:
      DBORM.EXPORT.exportBackup(evt.data, getAllEntities());
      break;
    case MSGTYPE.TODB.ON_RECEIVED_SYNCABLE_IMPORT:
      DBORM.IMPORT.receiveSyncableImport(evt.data, getAllEntities());
      break;
    case MSGTYPE.TODB.SAVE_PAGE_RECORDS:
      savePageRecords(evt.data)
      break;
    default:
      break;
  }
};

const savePageRecords = function(data) {
  const recordCount = DBORM.SAVING.saveRecords(data);
  console.log('saved ' + recordCount);
  if (data.onSuccessCountMsg) {
    // tell the listener how many were saved
    postMessage({ 
      type: MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT, 
      count: recordCount, 
      pageType: data.pageType,
      metadata: data.metadata });
  }
}

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
