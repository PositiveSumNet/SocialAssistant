// expresses metadata for application-specific database entities
// (maps the table and column names to RDF concepts)
// Predicate is expressed from the perspective of the Subject
// OneToOne expresses whether the unique constraint (UX) will use just the SubjectCol ('true') or also involve the ObjectCol ('false').

var SCHEMA_CONSTANTS = {
  COLUMNS: {
    sList: 'sList',
    sHandle: 'sHandle',
    sPostUrlKey: 'sPostUrlKey',
    sTopic: 'sTopic',
    sSubtopic: 'sSubtopic',
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
    OneToOne: false,
    Friendly: 'followers'
  },
  
  SocialConnIsFollowing: {
    Name: 'SocialConnIsFollowing',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false,
    Friendly: 'following'
  },
  
  SocialConnection: {
    Name: 'SocialConnection',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false,
    Friendly: 'connections'
  },
  
  SocialProfileDisplayName: {
    Name: 'SocialProfileDisplayName',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'profile names'
  },
  
  SocialProfileDescription: {
    Name: 'SocialProfileDescription',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'profile details'
  },
  
  SocialProfileImgSourceUrl: {
    Name: 'SocialProfileImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    OneToOne: true,
    Friendly: 'profile images'
  },
  
  SocialProfileImgBinary: {
    Name: 'SocialProfileImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.IMG_BINARY,
    OneToOne: true,
    Friendly: 'profile images'
  },
  
  SocialProfileLinkMastodonAccount: {
    Name: 'SocialProfileLinkMastodonAccount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.MASTODON_ACCOUNT_URL,
    OneToOne: false,
    Friendly: 'Mastodon accounts'
  },
  
  SocialProfileLinkExternalUrl: {
    Name: 'SocialProfileLinkExternalUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.EXTERNAL_URL,
    OneToOne: false,
    Friendly: 'profile URLs'
  },
  
  SocialProfileLinkEmailAddress: {
    Name: 'SocialProfileLinkEmailAddress',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.EMAIL_ADDRESS,
    OneToOne: false,
    Friendly: 'email addresses'
  },
  
  SocialListMember: {
    Name: 'SocialListMember',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sList,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.LIST_NAME,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: false,
    Friendly: 'list members'
  },

  SocialFollowerCount: {
    Name: 'SocialFollowerCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true,
    Friendly: 'follower counts'
  },

  SocialFollowingCount: {
    Name: 'SocialFollowingCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true,
    Friendly: 'following counts'
  },

  SocialSourceIdentifier: {
    Name: 'SocialSourceIdentifier',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sHandle,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.ACCOUNT_HANDLE,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'source IDs'
  },

  SocialTopicSubtopic: {
    Name: 'SocialTopicSubtopic',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sTopic,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.TEXT,
    ObjectType: DATATYPES.TEXT,
    OneToOne: false,
    Friendly: 'topics'
  },

  SocialSubtopicKeyword: {
    Name: 'SocialSubtopicKeyword',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sSubtopic,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.TEXT,
    ObjectType: DATATYPES.TEXT,
    OneToOne: false,
    Friendly: 'topic keywords'
  },

  SocialPostTime: {
    Name: 'SocialPostTime',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.DATETIME,
    OneToOne: true,
    Friendly: 'post times'
  },

  SocialPostAuthorHandle: {
    Name: 'SocialPostAuthorHandle',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: true,
    Friendly: 'post authors'
  },
  
  SocialPostReplyToUrlKey: {
    Name: 'SocialPostReplyToUrlKey',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.POST_URL_KEY,
    OneToOne: true,
    Friendly: 'post replies'
  },
  
  SocialPostThreadUrlKey: {
    Name: 'SocialPostThreadUrlKey',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.POST_URL_KEY,
    OneToOne: true,
    Friendly: 'threads'
  },
  
  SocialPostText: {
    Name: 'SocialPostText',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'text of posts'
  },
  
  SocialPostReposter: {
    Name: 'SocialPostReposter',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.ACCOUNT_HANDLE,
    OneToOne: true,
    Friendly: 'repost authors'
  },
  
  SocialPostQuoteOf: {
    Name: 'SocialPostQuoteOf',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.POST_URL_KEY,
    OneToOne: true,
    Friendly: 'quoted posts'
  },
  
  SocialPostSearchBlob: {
    Name: 'SocialPostSearchBlob',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'post searches'
  },
  
  // these can be saved separately from the main post, so makes sense to maintain its own search blob
  SocialPostCardSearchBlob: {
    Name: 'SocialPostCardSearchBlob',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'card searches'
  },
  
  SocialPostCardText: {
    Name: 'SocialPostCardText',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: true,
    Friendly: 'text of cards'
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
    OneToOne: true,
    Friendly: 'card URLs'
  },
  
  SocialPostCardImgSourceUrl: {
    Name: 'SocialPostCardImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    OneToOne: true,
    Friendly: 'card images'
  },
  
  SocialPostCardImgBinary: {
    Name: 'SocialPostCardImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_BINARY,
    OneToOne: true,
    Friendly: 'card images'
  },
  
  // one-to-many for these "regular" (non-'card') images
  SocialPostRegImgSourceUrl: {
    Name: 'SocialPostRegImgSourceUrl',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_SOURCE_URL,
    OneToOne: false,
    Friendly: 'post images'
  },
  
  // one-to-many for these "regular" (non-'card') images
  SocialPostRegImgBinary: {
    Name: 'SocialPostRegImgBinary',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.IMG_BINARY,
    OneToOne: false,
    Friendly: 'post images'
  },

  SocialPostReplyCount: {
    Name: 'SocialPostReplyCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true,
    Friendly: 'reply counts'
  },

  SocialPostLikeCount: {
    Name: 'SocialPostLikeCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true,
    Friendly: 'like counts'
  },

  SocialPostReshareCount: {
    Name: 'SocialPostReshareCount',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.INTEGER,
    OneToOne: true,
    Friendly: 'reshare counts'
  },

  SocialPostSubtopicRating: {
    Name: 'SocialPostSubtopicRating',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.TEXT,
    OneToOne: false,
    Friendly: 'ratings'
  },

  SocialPostEmbedsVideo: {
    Name: 'SocialPostEmbedsVideo',
    SubjectCol: SCHEMA_CONSTANTS.COLUMNS.sPostUrlKey,
    ObjectCol: SCHEMA_CONSTANTS.COLUMNS.oValue,
    SubjectType: DATATYPES.POST_URL_KEY,
    ObjectType: DATATYPES.BOOLEAN,  // reminder: provide 1 or 0 for boolean values
    OneToOne: true,
    Friendly: 'video values'
  },

  SAVING: {
    getSogs: function(set, entDefnName) {
      if (!set) { return []; }
      const subset = APPSCHEMA.SAVING.getSubset(set, entDefnName);
      if (!subset) { return []; }
      return subset.sogs;
    },
    
    getSubset: function(set, entDefnName) {
      return set.subsets.find(function(s) { return s.entityDefn.Name === entDefnName; });
    },
    
    // onlyIfNewer is true if this is a 'sync' context where we are careful to avoid overwriting with older data.
    // false is fine (and faster) for an ordinary save (where a timestamp check is unnecessary)
    newSavableSet: function(entityDefns, onlyIfNewer) {
      const subsets = [];
      for (let i = 0; i < entityDefns.length; i++) {
        subsets.push(APPSCHEMA.SAVING.newSavableSubset(entityDefns[i]));
      }
      
      return { 
        // data
        subsets: subsets, 
        onlyIfNewer: onlyIfNewer
      };
    },
    
    // soPairs stands for subject, object pairs; together with graph and knowledge of entity type, that's enough to create db records
    newSavableSubset: function(entityDefn) {
      return {
        uid: crypto.randomUUID(),
        entityDefn: entityDefn,
        sogs: []
      };
    }
  }

};