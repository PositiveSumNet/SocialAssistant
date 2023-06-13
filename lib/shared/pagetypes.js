// the type of page the user is looking at
var PAGETYPE = {
  // nitter uses this pageType too
  TWITTER: {
    FOLLOWERS: 'followersOnTwitter',
    FOLLOWING: 'followingOnTwitter',
    PROFILE: 'twitterProfile',
    TWEETS: 'tweets'
  },
  
  MASTODON: {
    FOLLOWERS: 'followersOnMastodon',
    FOLLOWING: 'followingOnMastodon'
  },
  
  getPageType: function(site, direction) {
    switch (site) {
      case SITE.TWITTER:
        switch (direction) {
          case CONN_DIRECTION.FOLLOWING:
            return PAGETYPE.TWITTER.FOLLOWING;
          case CONN_DIRECTION.FOLLOWERS:
            return PAGETYPE.TWITTER.FOLLOWERS;
          default:
            return undefined;
        }
        break;
      case SITE.MASTODON:
        switch (direction) {
          case CONN_DIRECTION.FOLLOWING:
            return PAGETYPE.MASTODON.FOLLOWING;
          case CONN_DIRECTION.FOLLOWERS:
            return PAGETYPE.MASTODON.FOLLOWERS;
          default:
            return undefined;
        }
        break;
      default:
        return undefined;
    }
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
      case PAGETYPE.TWITTER.PROFILE:
      case PAGETYPE.TWITTER.TWEETS:
        return SITE.TWITTER;
      case PAGETYPE.MASTODON.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWING:
        return SITE.MASTODON;
      default:
        return undefined;
    }
  }
};