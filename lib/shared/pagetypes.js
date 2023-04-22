// the type of page the user is looking at
var PAGETYPE = {
  TWITTER: {
    FOLLOWERS: 'followersOnTwitter',
    FOLLOWING: 'followingOnTwitter'
  },
  
  MASTODON: {
    FOLLOWERS: 'followersOnMastodon',
    FOLLOWING: 'followingOnMastodon'
  },
  
  getListMemberEntDefn: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
      case PAGETYPE.MASTODON.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWING:
              return APPSCHEMA.SocialListMember;
      default:
        return undefined;
    }
  },

  // note: linkedin or fb (symmetric) would use SocialConnection
  // this method will expand to include "Post" and other top-level concepts
  getRootEntDefn: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWERS:
          return APPSCHEMA.SocialConnHasFollower;
      case PAGETYPE.TWITTER.FOLLOWING:
      case PAGETYPE.MASTODON.FOLLOWING:
        return APPSCHEMA.SocialConnIsFollowing;
      default:
        return undefined;
    }
  },
  
  // note: linkedin or fb (symmetric) would not have one (mutual follow is inherent)
  getReciprocalEntDefn: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWERS:
          return APPSCHEMA.SocialConnIsFollowing;
      case PAGETYPE.TWITTER.FOLLOWING:
      case PAGETYPE.MASTODON.FOLLOWING:
          return APPSCHEMA.SocialConnHasFollower;
      default:
        return undefined;
    }
  },
  
  getSite: function(pageType) {
    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return SITE.TWITTER;
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return SITE.MASTODON;
      default:
        return undefined;
    }
  }
};