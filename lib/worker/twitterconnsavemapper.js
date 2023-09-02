// saving followers or connections

/*
source is

TWITTER Person: handle, displayName, description, pageType, owner, imgCdnUrl, img64Url, accounts
  where
  - handle and owner include @ symbol if the source site convention does
  - img64Url is attached via background.js
  - each account is { emails, urls, mdons } per STR.extractAccounts
*/

var TWITTER_CONN_SAVE_MAPPER = {
  
  mapSavableSet: function(records, pageType, graph) {
    const set = TWITTER_PROFILE_SAVE_MAPPER.mapSavableSet(records, PAGETYPE.TWITTER.PROFILE, graph);
    const connEntDefn = PAGETYPE.getRootEntDefn(pageType);

    const connections = records.map(function(x) {
      return {s: x.owner, o: x.handle, g: graph};
    });
    
    set.subsets.unshift(APPSCHEMA.SAVING.newSavableSubset(connEntDefn));  // pushes to front of array
    APPSCHEMA.SAVING.getSubset(set, connEntDefn.Name).sogs = connections;
    
    return set;
  }
};