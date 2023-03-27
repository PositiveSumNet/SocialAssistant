/*
returns:

ISaver {
  void save(db, records, cacheKeys, pageType);
}

*/
var SAVERFACTORY = {
  
  getSaver: function(pageType) {
    switch(pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.TWITTER.FOLLOWING:
        return CONNSAVER;
      default:
        return undefined;
    }
  }
};