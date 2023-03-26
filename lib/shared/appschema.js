// expresses metadata for application-specific database entities
// (maps the table and column names to RDF concepts)
// Predicate is expressed from the perspective of the Subject
// OneToOne expresses whether the unique constraint (UX) will use just the SubjectCol ('true') or also involve the ObjectCol ('false').

var SCHEMA_CONSTANTS = {
  COLUMNS: {
    sList: 'sList',
    sHandle: 'sHandle',
    oValue: 'oValue',
    NamedGraph: 'NamedGraph',
    Timestamp: 'Timestamp'
  },
  
  PREDICATES: {
    SOCIAL_CONNECTION_TYPE: {
      HAS_FOLLOWER: 'has-follower',
      IS_FOLLOWING: 'is-following',
      CONNECTION: 'is-connection-of'
    },
    PROFILE: {
      DISPLAY_NAME: 'display-name',
      IMAGE_SOURCE_URL: 'image-source-url',
      IMAGE_BINARY: 'image-binary',
      MASTODON_ACCOUNT_URL: 'mastodon-account-url',
      EXTERNAL_URL: 'external-url',
      EMAIL_ADDRESS: 'email-address'
    },
    CURATION: {
      LIST_MEMBER: 'list-member'
    }
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
    Predicate: SCHEMA_CONSTANTS.PREDICATES.SOCIAL_CONNECTION_TYPE.HAS_FOLLOWER,
    OneToOne: false
  },
  
  SocialConnIsFollowing: {
    Name: 'SocialConnIsFollowing',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.SOCIAL_CONNECTION_TYPE.IS_FOLLOWING,
    OneToOne: false
  },
  
  SocialConnection: {
    Name: 'SocialConnection',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.SOCIAL_CONNECTION_TYPE.CONNECTION,
    OneToOne: false
  },
  
  SocialProfileDisplayName: {
    Name: 'SocialProfileDisplayName',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.PROFILE.DISPLAY_NAME,
    OneToOne: true
  },
  
  SocialProfileImgSourceUrl: {
    Name: 'SocialProfileImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.PROFILE.IMAGE_SOURCE_URL,
    OneToOne: true
  },
  
  SocialProfileImgBinary: {
    Name: 'SocialProfileImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.IMG_BINARY,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.PROFILE.IMAGE_SOURCE_URL,
    OneToOne: true
  },
  
  SocialProfileLinkMastodonAccount: {
    Name: 'SocialProfileLinkMastodonAccount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.MASTODON_ACCOUNT_URL,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.PROFILE.MASTODON_ACCOUNT_URL,
    OneToOne: false
  },
  
  SocialProfileLinkExternalUrl: {
    Name: 'SocialProfileLinkExternalUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.EXTERNAL_URL,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.PROFILE.EXTERNAL_URL,
    OneToOne: false
  },
  
  SocialProfileLinkEmailAddress: {
    Name: 'SocialProfileLinkEmailAddress',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.EMAIL_ADDRESS,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.PROFILE.EMAIL_ADDRESS,
    OneToOne: false
  },
  
  SocialListMember: {
    Name: 'SocialListMember',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sList,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.LIST_NAME,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    Predicate: SCHEMA_CONSTANTS.PREDICATES.CURATION.LIST_MEMBER,
    OneToOne: false
  }
};