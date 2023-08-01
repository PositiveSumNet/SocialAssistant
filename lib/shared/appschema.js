// expresses metadata for application-specific database entities
// (maps the table and column names to RDF concepts)
// Predicate is expressed from the perspective of the Subject
// OneToOne expresses whether the unique constraint (UX) will use just the SubjectCol ('true') or also involve the ObjectCol ('false').

var SCHEMA_CONSTANTS = {
  COLUMNS: {
    sList: 'sList',
    sHandle: 'sHandle',
    sPostUrlKey: 'sPostUrlKey',
    oValue: 'oValue',
    NamedGraph: 'NamedGraph',
    Timestamp: 'Timestamp'
  }
};

// SubjectCol | ObjectCol | SubjectType | ObjectType | OneToOne
var APPSCHEMA = {
  
  // abstract base class
  SocialConnBase: {
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false
  },
  
  SocialConnHasFollower: {
    Name: 'SocialConnHasFollower',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false
  },
  
  SocialConnIsFollowing: {
    Name: 'SocialConnIsFollowing',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false
  },
  
  SocialConnection: {
    Name: 'SocialConnection',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false
  },
  
  SocialProfileDisplayName: {
    Name: 'SocialProfileDisplayName',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },
  
  SocialProfileDescription: {
    Name: 'SocialProfileDescription',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },
  
  SocialProfileImgSourceUrl: {
    Name: 'SocialProfileImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    OneToOne: true
  },
  
  SocialProfileImgBinary: {
    Name: 'SocialProfileImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.IMG_BINARY,
    OneToOne: true
  },
  
  SocialProfileLinkMastodonAccount: {
    Name: 'SocialProfileLinkMastodonAccount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.MASTODON_ACCOUNT_URL,
    OneToOne: false
  },
  
  SocialProfileLinkExternalUrl: {
    Name: 'SocialProfileLinkExternalUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.EXTERNAL_URL,
    OneToOne: false
  },
  
  SocialProfileLinkEmailAddress: {
    Name: 'SocialProfileLinkEmailAddress',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.EMAIL_ADDRESS,
    OneToOne: false
  },
  
  SocialListMember: {
    Name: 'SocialListMember',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sList,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.LIST_NAME,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false
  },

  SocialFollowerCount: {
    Name: 'SocialFollowerCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true
  },

  SocialFollowingCount: {
    Name: 'SocialFollowingCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true
  },

  SocialSourceIdentifier: {
    Name: 'SocialSourceIdentifier',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },

  SocialPostTime: {
    Name: 'SocialPostTime',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.DATETIME,
    OneToOne: true
  },

  SocialPostAuthorHandle: {
    Name: 'SocialPostAuthorHandle',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: true
  },
  
  SocialPostReplyToUrlKey: {
    Name: 'SocialPostReplyToUrlKey',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.POST_URL_KEY,
    OneToOne: true
  },
  
  SocialPostText: {
    Name: 'SocialPostText',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },
  
  SocialPostReposter: {
    Name: 'SocialPostReposter',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: true
  },
  
  SocialPostQuoteOf: {
    Name: 'SocialPostQuoteOf',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.POST_URL_KEY,
    OneToOne: true
  },
  
  SocialPostSearchBlob: {
    Name: 'SocialPostSearchBlob',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },
  
  // these can be saved separately from the main post, so makes sense to maintain its own search blob
  SocialPostCardSearchBlob: {
    Name: 'SocialPostCardSearchBlob',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },
  
  SocialPostCardText: {
    Name: 'SocialPostCardText',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true
  },
  
  SocialPostCardShortUrl: {
    Name: 'SocialPostCardShortUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.EXTERNAL_URL,
    OneToOne: true
  },
  
  SocialPostCardFullUrl: {
    Name: 'SocialPostCardFullUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.EXTERNAL_URL,
    OneToOne: true
  },
  
  SocialPostCardImgSourceUrl: {
    Name: 'SocialPostCardImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    OneToOne: true
  },
  
  SocialPostCardImgBinary: {
    Name: 'SocialPostCardImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_BINARY,
    OneToOne: true
  },
  
  // one-to-many for these "regular" (non-'card') images
  SocialPostRegImgSourceUrl: {
    Name: 'SocialPostRegImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    OneToOne: false
  },
  
  // one-to-many for these "regular" (non-'card') images
  SocialPostRegImgBinary: {
    Name: 'SocialPostRegImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_BINARY,
    OneToOne: false
  }

};