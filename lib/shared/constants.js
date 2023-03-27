/******************************************************/
// constants and string values used like enums
/******************************************************/

const APPNAME = 'SocialAssistant';

// site enums
var SITE = {
  TWITTER: 'twitter'
};

var SAVABLE_CONCEPT = {
  // follower/following (twitter), or mutual connection (linkedin, FB, etc.)
  CONNECTION: 'connection'
  // POST
};

// whether/how to render anchors
var RENDER_CONTEXT = {
  ANCHORS: {
    MDON_ONLY: 'mdonOnly',
    EMAIL_ONLY: 'emailOnly',
    EXTURL_ONLY: 'urlOnly',
    ALL: 'all'
  },
  PERSON: {
    ACCOUNT_OWNER: 'owner',
    FOLLOW_RESULT: 'followResult'
  }
};

var MSGTYPE = {
  RECORDING: {
    START: 'startRecording',
    STOP: 'stopRecording'
  },
  TODB: {
    XFER_CACHE_TODB: 'xferCacheToDb',
    SUGGEST_OWNER: 'suggestOwner',
    INPUT_FOLLOW_OWNER: 'inputFollowOwner',
    NETWORK_SEARCH: 'networkSearch',
    GET_NETWORK_SIZE: 'getNetworkSize',
    SET_FAVORITE: 'setFavorite'
  },
  FROMDB: {
    // legacy + error logging (prints ugly)
    LOG: {
      LEGACY: 'log',
      SQLITE_VERSION: 'logSqliteVersion',
      DB_SCRIPT_VERSION: 'logDbScriptVersion'
    },
    WORKER_READY: 'workerReady',
    COPIED_TODB: 'copiedToDb',
    RENDER: {
      SUGGESTED_OWNER: 'renderSuggestedOwner',
      MATCHED_OWNERS: 'renderMatchedOwners',
      FOLLOWS: 'renderFollows',
      NETWORK_SIZE: 'renderNetworkSize'
    }
  }
};

/******************************************************/
// Regular expressions
/******************************************************/

const REGEX_EMAIL = /(?:^|\s|\()([A-Za-z0-9._%+-]+(@| at |\(at\))[A-Za-z0-9.-]+(\.| dot |\(dot\))[A-Za-z]{2,4})\b/g;
const REGEX_URL = /http[s]?:\/\/[^\s]+/g;
// @scafaria@toad.social
const REGEX_MDON1 = /(?:^|\s|\()@([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\b/g;
// toad.social/@scafaria
const REGEX_MDON2 = /(?:^|\s|\()(https?:\/\/)?(www\.)?([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\/@([A-Za-z0-9._%+-]+)\b/g;
// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const REGEX_MDON3 = /(?:^|\s|\()([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.(social|online))\b/g;
