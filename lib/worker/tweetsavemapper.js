// pageType is part of the "interface" but not used for these

var TWEET_SAVE_MAPPER = {

  getEntDefns: function() {
    return [
      // author
      APPSCHEMA.SocialProfileDisplayName,
      APPSCHEMA.SocialProfileImgSourceUrl,
      APPSCHEMA.SocialProfileImgBinary,
      // the post itself
      APPSCHEMA.SocialPostTime,
      APPSCHEMA.SocialPostAuthorHandle,
      APPSCHEMA.SocialPostReplyToUrlKey,
      APPSCHEMA.SocialPostReposter,
      APPSCHEMA.SocialPostQuoteOf,
      APPSCHEMA.SocialPostCardText,
      APPSCHEMA.SocialPostCardShortUrl,
      APPSCHEMA.SocialPostCardFullUrl,
      APPSCHEMA.SocialPostCardImgSourceUrl,
      APPSCHEMA.SocialPostCardImgBinary,
      APPSCHEMA.SocialPostRegImgSourceUrl,
      APPSCHEMA.SocialPostRegImgBinary
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TWEET_SAVE_MAPPER.getEntDefns();
    const set = DBORM.SAVING.newSavableSet(entDefns, false);

    const aProfileNames = [];
    const aProfileImgSourceUrls = [];
    const aProfileImgBinaries = [];
    const pTimes = [];
    const pAuthorHandles = [];
    const pReplyToUrlKeys = [];
    const pReposters = [];
    const pQuoteOfs = [];
    const pCardTexts = [];
    const pCardShortUrls = [];
    const pCardFullUrls = [];
    const pCardImgSrcUrls = [];
    const pCardImgBinaries = [];
    const pRegImgSrcUrls = [];
    const pRegImgBinaries = [];

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let urlKey = record[SAVABLE_TWEET_ATTR.urlKey];
      // ensure the bare minimum properties
      if (urlKey && record[SAVABLE_TWEET_ATTR.authorHandle] && record[SAVABLE_TWEET_ATTR.postedUtc]) {
        
      }
    }
  }
};

var TCARD_SAVE_MAPPER = {

  mapSavableSet: function(records, pageType, graph) {
    
  }
};

var TPOST_MEDIA_SAVE_MAPPER = {

  mapSavableSet: function(records, pageType, graph) {
    
  }
};

var TWEET_AUTHOR_IMG_SAVE_MAPPER = {

  mapSavableSet: function(records, pageType, graph) {
    
  }
};