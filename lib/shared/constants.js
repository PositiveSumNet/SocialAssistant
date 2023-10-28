/******************************************************/
// constants and string values used like enums
/******************************************************/

const APPNAME = 'SocialAssistant';
const APP_HOME_URL = 'https://whosum.com';

const LIST_FAVORITES = 'favorites';

const SUBSET_IS_COMPLETE = 'isComplete';

// b64Data is e.g. "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA...""
const VIDEO_DATA_URL_PREFIX = 'data:video/mp4;base64,';

// when exporting Subject-Object to flat file (as opposed to json)
const FLAT_RDF_SO_DELIM = ' |>>| ';
// appending timestamp at the end
const FLAT_RDF_TIME_DELIM = ' |at| ';

// SocialPostSubtopicRating ex. 'SubTopicName-5'
const SUBTOPIC_RATING_DELIM = '-';

const X_COM_URL = 'x.com';
const SQUIDLR_URL = 'squidlr.com';

const SUPPORT_EMAIL = 'whosumsupport@positivesum.net';

const VIDEO_RES = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOWEST: 'lowest'
};

const STORAGE_PREFIX = {
  FOR_DB: 'fordb-',
  THREAD_EXPANSION_URLKEY: 'threadMore-',
  EMBEDDED_VIDEO_URLKEY: 'embVideo-'
};

const DEPRECATED_SUFFIX = '_deprecated';

const CLS = {
  MASTODON: {
    // links to a mastodon url get this class
    ACCOUNT_LINK: 'mastodon-account-link',

    // the float-right div gets one of these two styles:
    // a) if the DB informed us that we're already following
    // green
    FOLLOWING_ALREADY: 'following-already-mdon',
    // b) else
    FOLLOW_ONE_PLACEHOLDER: 'mastodon-follow-one-placeholder',
    
    // and always also gets this
    FOLLOW_ONE_CONTAINER: 'mastodon-follow-one-container',

    // this is the span that holds either (a) status text or (b) the Follow button anchor
    FOLLOW_ONE_SPAN: 'mastodon-follow-one-span',

    // the anchor button to click 'Follow'
    // purple
    FOLLOW_ONE_ANCHOR: 'mastodon-follow-one-anchor',
    // green
    FOLLOW_LIKELY_ACCEPTED: 'following-likely-mdon',
    // pale blue
    FOLLOW_AWAITING_RESPONSE: 'following-awaits-response-mdon'
  }
};

const POSTS = 'posts';

const URL_PARM = {
  PAGE_TYPE: 'pageType',
  OWNER: 'owner',
  SEARCH: 'search',
  STAR: 'star',
  SORT: 'sort',
  PAGE: 'page',
  SIZE: 'size',
  WITH_RETWEETS: 'withRetweets',
  TOPIC: 'topic',
  GUESS_TOPICS: 'guessTopics',
  THREAD: 'thread'
};

// a suffix appended to an urlKey to express the url of its quoted tweet (used because not all quoted tweets provide their url)
const QUOTED_SUFFIX = '#quoted';

// hit end of text (ascending order)
const LAST_TEXT = '~~~';

const CONN_DIRECTION = {
  FOLLOWING: 'following',
  FOLLOWERS: 'followers'
};

// site enums
const SITE = {
  TWITTER: 'twitter',
  MASTODON: 'mastodon',
  NITTER: 'nitter',
  GITHUB: 'github'
};

// common to all savables
const SAVABLE_IMG_ATTR = {
  // see usage at background and also at infuseImgCdns
  imgInfos: 'imgInfos',
  imgCdnUrl: 'imgCdnUrl',
  img64Url: 'img64Url',
  isEmbeddedVideo: 'isEmbeddedVideo'
};

// property names for a thread response object (analyzed by parser)
const THREAD_INFO = {
  replyToUrlKey: 'replyToUrlKey',
  threadUrlKey: 'threadUrlKey',
  // whether we need to queue up offscreen navigation to identify reply reply & thread urls
  unfurlRequired: 'unfurlRequired'
};

const SAVABLE_TWEET_ATTR = {
  urlKey: 'urlKey',
  authorHandle: 'authorHandle',
  authorName: 'authorName',
  postedUtc: 'postedUtc',
  replyToUrlKey: 'replyToUrlKey',
  threadUrlKey: 'threadUrlKey',
  postText: 'postText',
  replyCount: 'replyCount',
  likeCount: 'likeCount',
  reshareCount: 'reshareCount',
  embedsVideo: 'embedsVideo',
  // not 1:1 at db layer
  retweetedBy: 'retweetedBy',
  quoteTweet: 'quoteTweet',
  hasMore: 'hasMore',
  // nitter does in one go; separate recording for twitter
  authorImgCdnUrl: 'authorImgCdnUrl',
  card: 'card',
  postImgs: 'postImgs'
};

const TWEET_POST_IMG_ATTR = {
  urlKey: 'urlKey',
  isEmbeddedVideo: 'isEmbeddedVideo',
  imgCdnUrl: 'imgCdnUrl',
  img64Url: 'img64Url'
};

const TWEET_CARD_ATTR = {
  urlKey: 'urlKey',
  shortSourceUrl: 'shortSourceUrl',
  fullSourceUrl: 'fullSourceUrl',
  cardText: 'cardText',
  imgCdnUrl: 'imgCdnUrl',
  img64Url: 'img64Url'
}

const TWEET_AUTHOR_IMG_ATTR = {
  handle: 'handle',
  imgCdnUrl: 'imgCdnUrl',
  img64Url: 'img64Url'
};

const PERSON_ATTR = {
  OWNER_HANDLE: 'OwnerHandle',
  SITE: 'Site',
  SOURCE_ID: 'SourceId',
  HANDLE: 'Handle',
  DISPLAY_NAME: 'DisplayName',
  DETAIL: 'Detail',
  IMG_CDN_URL: 'ImgCdnUrl',
  IMG_64_URL: 'Img64Url',
  FOLLOWERS_COUNT: 'FollowersCount',
  FOLLOWING_COUNT: 'FollowingCount'
};

// whether/how to render anchors
const RENDER_CONTEXT = {
  ANCHORS: {
    MDON_ONLY: 'mdonOnly',
    EMAIL_ONLY: 'emailOnly',
    EXTURL_ONLY: 'urlOnly',
    ALL: 'all'
  },
  PERSON: {
    ACCOUNT_OWNER: 'owner',
    AUTHD_USER: 'user'
  }
};

const ORDER_BY = {
  HANDLE: 'Handle',
  POST_TIME_DESC: 'NewestFirst',
  POST_TIME_ASC: 'OldestFirst',
  POST_RATING: 'TopRated'
};

// Subject, Object, Graph, Timestamp
const RDFCOL = {
  s: 's',
  o: 'o',
  g: 'g',
  t: 't'
};

const MSGTYPE = {
  TOBACKGROUND: {
    SAVE: 'save',
    SETBADGE: 'setBadge',
    LOG_ME: 'logMe',
    SAVED_THREAD: 'savedThreadToBg',
    FOUND_PARTIAL_THREAD: 'foundPartialThread',
    FOUND_EMBEDDED_VIDEO: 'foundEmbeddedVideo'
  },
  TO_POPUP: {
    SAVED_THREAD: 'savedThreadToPop',
    DOWNLOAD_MEDIA: 'downloadMedia'
  },
  TO_OFFSCREEN: {
    NAV_FRAME_URL: 'navFrameUrl',
    NAV_FRAME_URLS: 'navFrameUrls',
    CLOSE_FRAME: 'closeFrame'
  },
  TODB: {
    XFER_CACHE_TODB: 'xferCacheToDb',
    SUGGEST_OWNER: 'suggestOwner',
    INPUT_OWNER: 'inputOwner',
    EXECUTE_SEARCH: 'executeSearch',
    GET_NETWORK_SIZE: 'getNetworkSize',
    SET_LIST_MEMBER: 'setListMember',
    ON_RECEIVED_SYNCABLE_IMPORT: 'onReceivedSyncableImport',
    SAVE_PAGE_RECORDS: 'savePageRecords',
    EXECUTE_SAVE_AND_DELETE: 'executeSaveAndDelete',
    GET_INUSE_TOPICS: 'getInUseTopics',
    FETCH_FOR_BACKUP: 'fetchForBackup',
    FETCH_FOR_RESTORE: 'fetchForRestore',
    SAVE_FOR_RESTORE: 'saveForRestore'
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
    SAVE_AND_DELETE_DONE: 'saveAndDeleteDone',
    RENDER: {
      SUGGESTED_OWNER: 'renderSuggestedOwner',
      MATCHED_OWNERS: 'renderMatchedOwners',
      CONNECTIONS: 'renderConnections',
      POST_STREAM: 'renderPostStream',
      NETWORK_SIZE: 'renderNetworkSize',
      INUSE_TOPICS: 'renderInUseTopics'
    },
    CONTINUE_RESTORE: 'continueRestore',
    ON_SUCCESS: {
      SAVED_COUNT: 'savedCount',
      SAVED_POST_TAG: 'savedPostTag'
    }
  }
};

const EXPORT_ROOT_ALIAS = 'x';

const REASON_CLEAR_ALT_URLS = 'reason=clearAltUrls';

// default combo box text when nothing is selected
const CMB_SPECIAL = {
  TAG_RATE: '-- Set topic & rate --',
  TAG_REMOVE: '-- Clear selection --',
  REQUEST_TAG: '-- Request a new topic! --',
  TAG_FILTER_BY: '-- Filter by topic --'
};

// columns used for sync
// NOTE: POST_SEL is used for posts
var SYNC_COL = {
  FAVORITES: {
    Handle: 'Handle'
  },
  PROFILES: {
    Handle: 'Handle',
    Display: 'Display',
    Detail: 'Detail'
  },
  PROFILE_IMGS: {
    Handle: 'Handle',
    IsB64: 'IsB64',
    Img: 'Img'
  },
  NETWORK: {
    Handle: 'Handle',
    Connection: 'Connection'
  },
  RATED_POST: {
    PostUrlKey: 'PostUrlKey',
    Concat: 'Concat',
    Topic: 'Topic',
    Subtopic: 'Subtopic',
    Rating: 'Rating'
  },
  POSTS: {
    // mostly uses POST_SEL
    // this is here because not every post is assigned a ThreadUrlKey (sometimes at save-time we aren't sure and leave blank), though we sync using thread as marker where possible
    MarkerUrlKey: 'MarkerUrlKey'
  },
  POST_IMGS: {
    MarkerUrlKey: 'MarkerUrlKey',
    PostUrlKey: 'PostUrlKey',
    Type: 'Type',
    Img: 'Img'
  }
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
  EmbedsVideo: 'EmbedsVideo',
  PostText: 'PostText',
  ReposterHandle: 'ReposterHandle',
  ReposterName: 'ReposterName',
  QuoteOfUrlKey: 'QuoteOfUrlKey',
  CardText: 'CardText',
  CardShortUrl: 'CardShortUrl',
  CardFullUrl: 'CardFullUrl',
  ReplyCount: 'ReplyCount',
  LikeCount: 'LikeCount',
  ReshareCount: 'ReshareCount',
  ConvoCount: 'ConvoCount', // posts & replies in the conversation (same thread)
  // for child Images
  CardImgCdnUrl: 'CardImgCdnUrl',
  CardImg64Url: 'CardImg64Url',
  // child objects
  QuoteTweet: 'QuoteTweet',
  ReplyToTweet: 'ReplyToTweet',
  Images: 'Images',
  TopicRatings: 'TopicRatings'
};

var REG_IMG_SEL = {
  PostUrlKey: 'PostUrlKey',
  RegImg64Url: 'RegImg64Url'
};

var TOPIC_RATING_SEL = {
  PostUrlKey: 'PostUrlKey',
  SubtopicRating: 'SubtopicRating',
  // split Subtopic-123 into 'Subtopic' and 123
  Subtopic: 'Subtopic',
  Rating: 'Rating'
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
// 2023-03-30 14:22:54
const REGEX_ISODATE = /(\d{4}-\d{2}-\d{2}[ T]?\d{2}:\d{2}:\d{2})Z?/;
