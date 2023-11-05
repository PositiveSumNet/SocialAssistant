/*
returns:

ISaveMapper {
  SavableSet mapSavableSet(records, pageType);
}

SavableSet is per APPSCHEMA.SAVING.newSavableSet

*/
var SAVEMAPPERFACTORY = {
  
  getSaveMapper: function(pageType) {
    switch(pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return TWITTER_CONN_SAVE_MAPPER;
      case PAGETYPE.TWITTER.PROFILE:
        return TWITTER_PROFILE_SAVE_MAPPER;
      case PAGETYPE.MASTODON.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWING:
        return MASTODON_CONN_SAVE_MAPPER;
      case PAGETYPE.TWITTER.TWEETS:
        return TWEET_SAVE_MAPPER;
      case PAGETYPE.TWITTER.TWEET_CARDS:
        return TCARD_SAVE_MAPPER;
      case PAGETYPE.TWITTER.TWEET_POST_MEDIA:
        return TPOST_MEDIA_SAVE_MAPPER;
      case PAGETYPE.TWITTER.TWEET_AUTHOR_IMG:
        return TWEET_AUTHOR_IMG_SAVE_MAPPER;
      default:
        return undefined;
    }
  }
};