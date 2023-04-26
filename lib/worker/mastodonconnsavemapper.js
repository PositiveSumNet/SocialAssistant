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
      APPSCHEMA.SocialProfileLinkEmailAddress
    ];
  },
  
  mapSavableSet: function(records, pageType, graph) {
    const connEntDefn = PAGETYPE.getRootEntDefn(pageType);
    const entDefns = MASTODON_CONN_SAVE_MAPPER.getEntDefns(pageType);
    // passing false for onlyIfNewer because this is a save context (definitely newer than whatever is in the db) 
    // as opposed to a sync context (where we could be syncing in data that is older than our db)
    const set = DBORM.SAVING.newSavableSet(entDefns, false);
    
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
    
    set.getSubset(connEntDefn.Name).sogs = connections;
    set.getSubset(APPSCHEMA.SocialProfileDisplayName.Name).sogs = displayNames;
    set.getSubset(APPSCHEMA.SocialProfileDescription.Name).sogs = descriptions;
    set.getSubset(APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs = imgCdns;
    set.getSubset(APPSCHEMA.SocialProfileLinkExternalUrl.Name).sogs = urls;
    set.getSubset(APPSCHEMA.SocialProfileLinkEmailAddress.Name).sogs = emails;
    
    return set;
  }
};