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
        return CONNSAVEMAPPER;
      default:
        return undefined;
    }
  }
};