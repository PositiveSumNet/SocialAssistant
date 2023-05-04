/*
returns:

ISaveMapper {
  SavableSet mapSavableSet(records, pageType);
}

SavableSet is per DBORM.SAVING.newSavableSet

*/
var SAVEMAPPERFACTORY = {
  
  getSaveMapper: function(pageType) {
    switch(pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return TWITTER_CONN_SAVE_MAPPER;
      case PAGETYPE.MASTODON.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWING:
        return MASTODON_CONN_SAVE_MAPPER;
      default:
        return undefined;
    }
  }
};