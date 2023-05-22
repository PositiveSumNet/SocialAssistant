// saving profiles (not tied to connection)

/*
source is

TWITTER Person: handle, displayName, description, pageType, owner, imgCdnUrl, img64Url, accounts
  where
  - handle and owner include @ symbol if the source site convention does
  - img64Url is attached via background.js
  - each account is { emails, urls, mdons } per STR.extractAccounts
*/

var TWITTER_PROFILE_SAVE_MAPPER = {
  
  // the entity definitions relevant for saving followers/connections
  getEntDefns: function() {
    
    return [
      APPSCHEMA.SocialProfileDisplayName,
      APPSCHEMA.SocialProfileDescription,
      APPSCHEMA.SocialProfileImgSourceUrl,
      APPSCHEMA.SocialProfileImgBinary,
      APPSCHEMA.SocialProfileLinkMastodonAccount,
      APPSCHEMA.SocialProfileLinkExternalUrl,
      APPSCHEMA.SocialProfileLinkEmailAddress
    ];
  },
  
  // pageType is part of the "interface" but not used for this one
  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TWITTER_PROFILE_SAVE_MAPPER.getEntDefns();
    // passing false for onlyIfNewer because this is a save context (definitely newer than whatever is in the db) 
    // as opposed to a sync context (where we could be syncing in data that is older than our db)
    const set = DBORM.SAVING.newSavableSet(entDefns, false);
    
    // now map the records into each subset based on connection-specific mapping logic
    // subject | object | graph
    
    const displayNames = records.map(function(x) {
      return {s: x.handle, o: x.displayName, g: graph};
    });
    
    const descriptions = records.map(function(x) {
      return {s: x.handle, o: x.description, g: graph};
    });

    const imgCdns = records.map(function(x) {
      return {s: x.handle, o: x.imgCdnUrl, g: graph};
    });

    const img64s = records.filter(function(x) { return x.img64Url && x.img64Url.length > 0; }).map(function(x) {
      return {s: x.handle, o: x.img64Url, g: graph};
    });
    
    const mdons = [];
    const urls = [];
    const emails = [];
    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      if (record.accounts && record.accounts.mdons) {
        record.accounts.mdons.forEach(x => mdons.push({s: record.handle, o: x, g: graph}));
      }
      if (record.accounts && record.accounts.urls) {
        record.accounts.urls.forEach(x => urls.push({s: record.handle, o: x, g: graph}));
      }
      if (record.accounts && record.accounts.emails) {
        record.accounts.emails.forEach(x => emails.push({s: record.handle, o: x, g: graph}));
      }
    }
    
    set.getSubset(APPSCHEMA.SocialProfileDisplayName.Name).sogs = displayNames;
    set.getSubset(APPSCHEMA.SocialProfileDescription.Name).sogs = descriptions;
    set.getSubset(APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs = imgCdns;
    set.getSubset(APPSCHEMA.SocialProfileImgBinary.Name).sogs = img64s;
    set.getSubset(APPSCHEMA.SocialProfileLinkMastodonAccount.Name).sogs = mdons;
    set.getSubset(APPSCHEMA.SocialProfileLinkExternalUrl.Name).sogs = urls;
    set.getSubset(APPSCHEMA.SocialProfileLinkEmailAddress.Name).sogs = emails;

    return set;
  }
};