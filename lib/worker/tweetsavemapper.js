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
      APPSCHEMA.SocialPostText,
      APPSCHEMA.SocialPostCardText,
      APPSCHEMA.SocialPostCardShortUrl,
      APPSCHEMA.SocialPostCardFullUrl,
      APPSCHEMA.SocialPostCardImgSourceUrl,
      APPSCHEMA.SocialPostCardImgBinary,
      APPSCHEMA.SocialPostRegImgSourceUrl,
      APPSCHEMA.SocialPostRegImgBinary,
      APPSCHEMA.SocialPostSearchBlob,
      APPSCHEMA.SocialPostCardSearchBlob
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TWEET_SAVE_MAPPER.getEntDefns();
    const set = DBORM.SAVING.newSavableSet(entDefns, false);

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      TWEET_SAVE_MAPPER.mapRecordIntoSet(record, set, graph);
    }

    return set;
  },

  mapRecordIntoSet: function(record, set, graph) {

    const aProfileNames = [];
    const aProfileImgSourceUrls = [];
    const aProfileImgBinaries = [];
    const pTimes = [];
    const pAuthorHandles = [];
    const pTexts = [];
    const pReplyToUrlKeys = [];
    const pReposters = [];
    const pQuoteOfs = [];
    const pRegImgSrcUrls = [];
    const pRegImgBinaries = [];
    const searchParts = [];

    let urlKey = record[SAVABLE_TWEET_ATTR.urlKey];
    // ensure the bare minimum properties
    if (!urlKey || !record[SAVABLE_TWEET_ATTR.authorHandle] || !record[SAVABLE_TWEET_ATTR.postedUtc]) {
      console.log('invalid tweet');
      console.log(record);
      return;
    }
    
    searchParts.push(urlKey);
    // post author handle
    pAuthorHandles.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.authorHandle], g: graph});
    searchParts.push(record[SAVABLE_TWEET_ATTR.authorHandle]);
    // author's name
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.authorName])) {
      aProfileNames.push({s: record[SAVABLE_TWEET_ATTR.authorHandle], o: record[SAVABLE_TWEET_ATTR.authorName], g: graph});
      searchParts.push(record[SAVABLE_TWEET_ATTR.authorName]);
    }
    // author's image (only nitter does this inline)
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.authorImgCdnUrl])) {
      aProfileImgSourceUrls.push({s: record[SAVABLE_TWEET_ATTR.authorHandle], o: record[SAVABLE_TWEET_ATTR.authorImgCdnUrl], g: graph});
      let img64 = TWEET_SAVE_MAPPER.getMatchingImg64(record, record[SAVABLE_TWEET_ATTR.authorImgCdnUrl]);
      if (img64) {
        aProfileImgBinaries.push({s: record[SAVABLE_TWEET_ATTR.authorHandle], o: img64, g: graph});
      }
    }
    // post's time
    pTimes.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.postedUtc], g: graph});
    // if it's a reply
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.replyToUrlKey])) {
      pReplyToUrlKeys.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.replyToUrlKey], g: graph});
    }
    // the text
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.postText])) {
      pTexts.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.postText], g: graph});
      searchParts.push(record[SAVABLE_TWEET_ATTR.postText]);
    }
    // if it's a retweet
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.retweetedBy])) {
      pReposters.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.retweetedBy], g: graph});
    }
    // if it's a quote tweet
    if (record[SAVABLE_TWEET_ATTR.quoteTweet] && record[SAVABLE_TWEET_ATTR.quoteTweet][SAVABLE_TWEET_ATTR.urlKey]) {
      pQuoteOfs.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.quoteTweet][SAVABLE_TWEET_ATTR.urlKey], g: graph});
      // only nests down a single level
      let quoteTweet = record[SAVABLE_TWEET_ATTR.quoteTweet];
      TWEET_SAVE_MAPPER.mapRecordIntoSet(quoteTweet, set, graph);
      if (STR.hasLen(quoteTweet[SAVABLE_TWEET_ATTR.postText])) {
        searchParts.push(quoteTweet[SAVABLE_TWEET_ATTR.postText]);
      }
      if (STR.hasLen(quoteTweet[SAVABLE_TWEET_ATTR.authorHandle])) {
        searchParts.push(quoteTweet[SAVABLE_TWEET_ATTR.authorHandle]);
      }
      if (STR.hasLen(quoteTweet[SAVABLE_TWEET_ATTR.authorName])) {
        searchParts.push(quoteTweet[SAVABLE_TWEET_ATTR.authorName]);
      }
    }
    // if it has a media card
    if (record[SAVABLE_TWEET_ATTR.card]) {
      TCARD_SAVE_MAPPER.mapRecordIntoSet(record[SAVABLE_TWEET_ATTR.card], set, graph);
    }
    // if it has images directly on the post (as nitter does; whereas twitter processes these as their own pagetype)
    if (record[SAVABLE_TWEET_ATTR.postImgs] && record[SAVABLE_TWEET_ATTR.postImgs].length > 0) {
      for (let i = 0; i < record[SAVABLE_TWEET_ATTR.postImgs].length; i++) {
        let postImg = record[SAVABLE_TWEET_ATTR.postImgs][i];
        let imgCdnUrl = postImg[SAVABLE_IMG_ATTR.imgCdnUrl];
        pRegImgSrcUrls.push({s: urlKey, o: imgCdnUrl, g: graph});
        if (postImg[SAVABLE_IMG_ATTR.img64Url]) {
          pRegImgBinaries.push({s: urlKey, o: postImg[SAVABLE_IMG_ATTR.img64Url], g: graph});
        }
        else {
          let img64 = TWEET_SAVE_MAPPER.getMatchingImg64(record, imgCdnUrl);
          if (img64) {
            pRegImgBinaries.push({s: urlKey, o: img64, g: graph});
          }
        }
      }
    }

    set.getSubset(APPSCHEMA.SocialProfileDisplayName.Name).sogs.push(...aProfileNames);
    set.getSubset(APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs.push(...aProfileImgSourceUrls);
    set.getSubset(APPSCHEMA.SocialProfileImgBinary.Name).sogs.push(...aProfileImgBinaries);
    set.getSubset(APPSCHEMA.SocialPostTime.Name).sogs.push(...pTimes);
    set.getSubset(APPSCHEMA.SocialPostAuthorHandle.Name).sogs.push(...pAuthorHandles);
    set.getSubset(APPSCHEMA.SocialPostText.Name).sogs.push(...pTexts);
    set.getSubset(APPSCHEMA.SocialPostReplyToUrlKey.Name).sogs.push(...pReplyToUrlKeys);
    set.getSubset(APPSCHEMA.SocialPostReposter.Name).sogs.push(...pReposters);
    set.getSubset(APPSCHEMA.SocialPostQuoteOf.Name).sogs.push(...pQuoteOfs);
    set.getSubset(APPSCHEMA.SocialPostRegImgSourceUrl.Name).sogs.push(...pRegImgSrcUrls);
    set.getSubset(APPSCHEMA.SocialPostRegImgBinary.Name).sogs.push(...pRegImgBinaries);

    const searchBlob = searchParts.filter(function(p) { return STR.hasLen(p); }).join('\n');
    set.getSubset(APPSCHEMA.SocialPostSearchBlob.Name).sogs.push({s: urlKey, o: searchBlob, g: graph});
  },

  getMatchingImg64(record, imgCdnUrl) {
    if (!record || !record[SAVABLE_IMG_ATTR.imgInfos]) {
      return null;
    }

    for (let i = 0; i < record[SAVABLE_IMG_ATTR.imgInfos].length; i++) {
      let imgInfo = record[SAVABLE_IMG_ATTR.imgInfos][i];
      if (imgInfo[SAVABLE_IMG_ATTR.imgCdnUrl] == imgCdnUrl) {
        return imgInfo[SAVABLE_IMG_ATTR.img64Url];
      }
    }

    return null;
  }
};

var TCARD_SAVE_MAPPER = {

  getEntDefns: function() {
    return [
      APPSCHEMA.SocialPostCardText,
      APPSCHEMA.SocialPostCardShortUrl,
      APPSCHEMA.SocialPostCardFullUrl,
      APPSCHEMA.SocialPostCardImgSourceUrl,
      APPSCHEMA.SocialPostCardImgBinary,
      APPSCHEMA.SocialPostCardSearchBlob
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TCARD_SAVE_MAPPER.getEntDefns();
    const set = DBORM.SAVING.newSavableSet(entDefns, false);

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      TCARD_SAVE_MAPPER.mapRecordIntoSet(record, set, graph);
    }

    return set;
  },

  mapRecordIntoSet: function(record, set, graph) {
    const urlKey = record[TWEET_CARD_ATTR.postUrlKey];
    
    if (!urlKey) { 
      console.log('invalid card');
      return; 
    }
    
    const pCardTexts = [];
    const pCardShortUrls = [];
    const pCardFullUrls = [];
    const pCardImgSrcUrls = [];
    const pCardImgBinaries = [];
    const searchParts = [];

    searchParts.push(urlKey);
    if (STR.hasLen(record[TWEET_CARD_ATTR.cardText])) {
      pCardTexts.push({s: urlKey, o: record[TWEET_CARD_ATTR.cardText], g: graph});
      searchParts.push(record[TWEET_CARD_ATTR.cardText]);
    }
    if (STR.hasLen(record[TWEET_CARD_ATTR.shortSourceUrl])) {
      pCardShortUrls.push({s: urlKey, o: record[TWEET_CARD_ATTR.shortSourceUrl], g: graph});
    }
    if (STR.hasLen(record[TWEET_CARD_ATTR.fullSourceUrl])) {
      pCardFullUrls.push({s: urlKey, o: record[TWEET_CARD_ATTR.fullSourceUrl], g: graph});
      searchParts.push(record[TWEET_CARD_ATTR.fullSourceUrl]);
    }
    if (STR.hasLen(record[TWEET_CARD_ATTR.imgCdnUrl])) {
      let imgCdnUrl = record[TWEET_CARD_ATTR.imgCdnUrl];
      pCardImgSrcUrls.push({s: urlKey, o: imgCdnUrl, g: graph});
      let img64;
      if (STR.hasLen(record[SAVABLE_IMG_ATTR.imgCdnUrl])) {
        img64 = record[SAVABLE_IMG_ATTR.imgCdnUrl];
      }
      else {
        img64 = TWEET_SAVE_MAPPER.getMatchingImg64(record, imgCdnUrl);
      }
      if (img64) {
        pCardImgBinaries.push({s: urlKey, o: img64, g: graph});
      }
    }

    set.getSubset(APPSCHEMA.SocialPostCardText.Name).sogs.push(...pCardTexts);
    set.getSubset(APPSCHEMA.SocialPostCardShortUrl.Name).sogs.push(...pCardShortUrls);
    set.getSubset(APPSCHEMA.SocialPostCardFullUrl.Name).sogs.push(...pCardFullUrls);
    set.getSubset(APPSCHEMA.SocialPostCardImgSourceUrl.Name).sogs.push(...pCardImgSrcUrls);
    set.getSubset(APPSCHEMA.SocialPostCardImgBinary.Name).sogs.push(...pCardImgBinaries);

    const searchBlob = searchParts.filter(function(p) { return STR.hasLen(p); }).join('\n');
    set.getSubset(APPSCHEMA.SocialPostCardSearchBlob.Name).sogs.push({s: urlKey, o: searchBlob, g: graph});
  }
};

var TPOST_MEDIA_SAVE_MAPPER = {

  getEntDefns: function() {
    return [
      APPSCHEMA.SocialPostRegImgSourceUrl,
      APPSCHEMA.SocialPostRegImgBinary
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TPOST_MEDIA_SAVE_MAPPER.getEntDefns();
    const set = DBORM.SAVING.newSavableSet(entDefns, false);

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let urlKey = record[TWEET_POST_IMG_ATTR.postUrlKey];
      let imgCdnUrl = record[TWEET_POST_IMG_ATTR.imgCdnUrl];
      let img64 = record[TWEET_POST_IMG_ATTR.img64Url];

      if (STR.hasLen(imgCdnUrl)) {
        set.getSubset(APPSCHEMA.SocialPostRegImgSourceUrl.Name).sogs.push({s: urlKey, o: imgCdnUrl, g: graph});
      }
      if (STR.hasLen(img64)) {
        set.getSubset(APPSCHEMA.SocialPostRegImgBinary.Name).sogs.push({s: urlKey, o: img64, g: graph});
      }
    }

    return set;
  }
};

var TWEET_AUTHOR_IMG_SAVE_MAPPER = {

  getEntDefns: function() {
    return [
      APPSCHEMA.SocialProfileImgSourceUrl,
      APPSCHEMA.SocialProfileImgBinary
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TWEET_AUTHOR_IMG_SAVE_MAPPER.getEntDefns();
    const set = DBORM.SAVING.newSavableSet(entDefns, false);

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let handle = record[TWEET_AUTHOR_IMG_ATTR.handle];
      if (STR.hasLen(handle)) {
        let imgCdnUrl = record[TWEET_AUTHOR_IMG_ATTR.imgCdnUrl];
        let img64 = record[TWEET_AUTHOR_IMG_ATTR.img64Url];

        if (STR.hasLen(imgCdnUrl)) {
          set.getSubset(APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs.push({s: handle, o: imgCdnUrl, g: graph});
        }
        if (STR.hasLen(img64)) {
          set.getSubset(APPSCHEMA.SocialProfileImgBinary.Name).sogs.push({s: handle, o: img64, g: graph});
        }
      }
    }

    return set;
  }
};