// the type of page the user is looking at
var PAGETYPE = {
  TWITTER: {
    FOLLOWERS: 'followersOnTwitter',
    FOLLOWING: 'followingOnTwitter'
  },
  
  getConnectionEntDefn: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
        return APPSCHEMA.SocialConnHasFollower;
      case PAGETYPE.TWITTER.FOLLOWING:
        return APPSCHEMA.SocialConnIsFollowing;
      default:
        return undefined;
    }
  },
  
  getSite: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return SITE.TWITTER;
      default:
        return undefined;
    }
  },
  
  getSavableConcept: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return SAVABLE_CONCEPT.CONNECTION;
      default:
        return undefined;
    }
  }
};