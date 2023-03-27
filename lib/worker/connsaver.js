// saving CONNECTION records

/*
Person: handle, displayName, description, pageType, owner, imgCdnUrl, img64Url, accounts
  where
  - handle and owner include @ symbol if the source site convention does
  - img64Url is attached via background.js
  - each account is { emails, urls, mdons } per STR.extractAccounts

*/

var CONNSAVER = {
  
  // each record is a Person
  save: function(db, records, cacheKeys, pageType) {
    const savableSet = CONNSAVEMAP.mapSavableSet(records, pageType);
    // ...
  }
  
};