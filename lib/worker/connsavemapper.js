// saving followers or connections
var CONNSAVEMAP = {
  
  // the entity definitions relevant for saving followers/connections
  getEntDefns: function(pageType) {
    
    const connEntDefn = PAGETYPE.getConnectionEntDefn(pageType);
    
    return [
      connEntDefn,
      APPSCHEMA.SocialProfileDisplayName,
      APPSCHEMA.SocialProfileDescription,
      APPSCHEMA.SocialProfileImgSourceUrl,
      APPSCHEMA.SocialProfileImgBinary,
      APPSCHEMA.SocialProfileLinkMastodonAccount,
      APPSCHEMA.SocialProfileLinkExternalUrl,
      APPSCHEMA.SocialProfileLinkEmailAddress
    ];
  },
  
  mapSavableSet: function(records, pageType) {
    const connEntDefn = PAGETYPE.getConnectionEntDefn(pageType);
    const entDefns = CONNSAVEMAP.getEntDefns(pageType);
    const set = DBORM.newSavableSet(entDefns, pageType);
    
    // now map the records into each subset based on connection-specific mapping logic
    
    const connections = records.map(function(x) {
      return {s: x.owner, o: x.handle};
    });
    
    const displayNames = records.map(function(x) {
      return {s: x.handle, o: x.displayName};
    });
    
    const descriptions = records.map(function(x) {
      return {s: x.handle, o: x.description};
    });

    const imgCdns = records.map(function(x) {
      return {s: x.handle, o: x.imgCdnUrl};
    });

    const img64s = records.map(function(x) {
      return {s: x.handle, o: x.img64Url};
    });
    
    const mdons = [];
    const urls = [];
    const emails = [];
    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      if (record.accounts && record.accounts.mdons) {
        record.accounts.mdons.forEach(x => mdons.push({s: record.handle, o: x}));
      }
      if (record.accounts && record.accounts.urls) {
        record.accounts.urls.forEach(x => urls.push({s: record.handle, o: x}));
      }
      if (record.accounts && record.accounts.emails) {
        record.accounts.emails.forEach(x => emails.push({s: record.handle, o: x}));
      }
    }
    
    set.getSubset(connEntDefn.Name).soPairs = connections;
    set.getSubset(APPSCHEMA.SocialProfileDisplayName.Name).soPairs = displayNames;
    set.getSubset(APPSCHEMA.SocialProfileDescription.Name).soPairs = descriptions;
    set.getSubset(APPSCHEMA.SocialProfileImgSourceUrl.Name).soPairs = imgCdns;
    set.getSubset(APPSCHEMA.SocialProfileImgBinary.Name).soPairs = img64s;
    set.getSubset(APPSCHEMA.SocialProfileLinkMastodonAccount.Name).soPairs = mdons;
    set.getSubset(APPSCHEMA.SocialProfileLinkExternalUrl.Name).soPairs = urls;
    set.getSubset(APPSCHEMA.SocialProfileLinkEmailAddress.Name).soPairs = emails;
    
    return set;
  }
};