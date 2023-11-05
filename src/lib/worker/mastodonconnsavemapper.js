// saving followers or connections
// where source is per PERSON_ATTR

var MASTODON_CONN_SAVE_MAPPER = {
  
  // the entity definitions relevant for saving followers/connections
  getEntDefns: function(pageType) {
    
    const connEntDefn = PAGETYPE.getRootEntDefn(pageType);
    
    return [
      connEntDefn,
      APPSCHEMA.SocialProfileDisplayName,
      APPSCHEMA.SocialProfileDescription,
      APPSCHEMA.SocialProfileImgSourceUrl,
      APPSCHEMA.SocialProfileLinkExternalUrl,
      APPSCHEMA.SocialProfileLinkEmailAddress,
      APPSCHEMA.SocialFollowerCount,
      APPSCHEMA.SocialFollowingCount
    ];
  },
  
  mapSavableSet: function(records, pageType, graph) {
    const connEntDefn = PAGETYPE.getRootEntDefn(pageType);
    const entDefns = MASTODON_CONN_SAVE_MAPPER.getEntDefns(pageType);
    // passing false for onlyIfNewer because this is a save context (definitely newer than whatever is in the db) 
    // as opposed to a sync context (where we could be syncing in data that is older than our db)
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, false);
    
    // now map the records into each subset based on connection-specific mapping logic
    // subject | object | graph
    
    const connections = records.map(function(x) {
      return {s: x.OwnerHandle, o: x.Handle, g: graph};
    });
    
    const displayNames = records.map(function(x) {
      return {s: x.Handle, o: x.DisplayName, g: graph};
    });
    
    const descriptions = records.map(function(x) {
      return {s: x.Handle, o: x.Detail, g: graph};
    });

    const imgCdns = records.map(function(x) {
      return {s: x.Handle, o: x.ImgCdnUrl, g: graph};
    });

    const followerCounts = records.map(function(x) {
      return {s: x.Handle, o: x.FollowersCount, g: graph};
    });

    const followingCounts = records.map(function(x) {
      return {s: x.Handle, o: x.FollowingCount, g: graph};
    });

    const urls = [];
    const emails = [];
    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let accounts = STR.extractAccounts([record.DisplayName, record.Detail], false);
      if (accounts.urls) {
        accounts.urls.forEach(x => urls.push({s: record.Handle, o: x, g: graph}));
      }
      if (accounts.emails) {
        accounts.emails.forEach(x => emails.push({s: record.Handle, o: x, g: graph}));
      }
    }
    
    APPSCHEMA.SAVING.getSubset(set, connEntDefn.Name).sogs = connections;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDisplayName.Name).sogs = displayNames;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDescription.Name).sogs = descriptions;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs = imgCdns;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileLinkExternalUrl.Name).sogs = urls;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileLinkEmailAddress.Name).sogs = emails;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialFollowerCount.Name).sogs = followerCounts;
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialFollowingCount.Name).sogs = followingCounts;
    
    return set;
  }
};