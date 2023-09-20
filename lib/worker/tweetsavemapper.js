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
      APPSCHEMA.SocialPostThreadUrlKey,
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
      APPSCHEMA.SocialPostCardSearchBlob,
      APPSCHEMA.SocialPostEmbedsVideo,
      APPSCHEMA.SocialPostReplyCount,
      APPSCHEMA.SocialPostLikeCount,
      APPSCHEMA.SocialPostReshareCount
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TWEET_SAVE_MAPPER.getEntDefns();
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, false);

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
    const pEmbedVids = [];
    const pReplyToUrlKeys = [];
    const pThreadUrlKeys = [];
    const pReposters = [];
    const pQuoteOfs = [];
    const pRegImgSrcUrls = [];
    const pRegImgBinaries = [];
    const searchParts = [];
    const sReplyCounts = [];
    const sLikeCounts = [];
    const sReshareCounts = [];

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
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.threadUrlKey])) {
      pThreadUrlKeys.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.threadUrlKey], g: graph});
    }
    // the text
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.postText])) {
      pTexts.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.postText], g: graph});
      searchParts.push(record[SAVABLE_TWEET_ATTR.postText]);
    }
    // if it embeds video
    if (STR.isTruthy(record[SAVABLE_TWEET_ATTR.embedsVideo])) {
      pEmbedVids.push({s: urlKey, o: 1, g: graph});
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
      TCARD_SAVE_MAPPER.mapRecordIntoSet(record[SAVABLE_TWEET_ATTR.card], set, graph, record);
    }
    // if it has images directly on the post (as nitter does; whereas twitter processes these as their own pagetype)
    if (record[SAVABLE_TWEET_ATTR.postImgs] && record[SAVABLE_TWEET_ATTR.postImgs].length > 0) {
      for (let i = 0; i < record[SAVABLE_TWEET_ATTR.postImgs].length; i++) {
        let postImg = record[SAVABLE_TWEET_ATTR.postImgs][i];
        let imgCdnUrl = postImg[SAVABLE_IMG_ATTR.imgCdnUrl];
        let isEmbedVid = STR.isTruthy(postImg[SAVABLE_IMG_ATTR.isEmbeddedVideo]);
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
        if (isEmbedVid == true) {
          pEmbedVids.push({s: urlKey, o: 1, g: graph});
        }
      }
    }

    // stats
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.replyCount])) {
      sReplyCounts.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.replyCount], g: graph});
    }
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.likeCount])) {
      sLikeCounts.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.likeCount], g: graph});
    }
    if (STR.hasLen(record[SAVABLE_TWEET_ATTR.reshareCount])) {
      sReshareCounts.push({s: urlKey, o: record[SAVABLE_TWEET_ATTR.reshareCount], g: graph});
    }

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileDisplayName.Name).sogs.push(...aProfileNames);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs.push(...aProfileImgSourceUrls);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileImgBinary.Name).sogs.push(...aProfileImgBinaries);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostTime.Name).sogs.push(...pTimes);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostAuthorHandle.Name).sogs.push(...pAuthorHandles);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostText.Name).sogs.push(...pTexts);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostEmbedsVideo.Name).sogs.push(...pEmbedVids);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostReplyToUrlKey.Name).sogs.push(...pReplyToUrlKeys);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostThreadUrlKey.Name).sogs.push(...pThreadUrlKeys);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostReposter.Name).sogs.push(...pReposters);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostQuoteOf.Name).sogs.push(...pQuoteOfs);
    
    // these are one-to-many entities; but we don't want duplicates and we expect to provide a complete set here
    const regImgSrcUrlSubset = APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostRegImgSourceUrl.Name);
    const regImgBinarySubset = APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostRegImgBinary.Name);
    regImgSrcUrlSubset[SUBSET_IS_COMPLETE] = true;
    regImgBinarySubset[SUBSET_IS_COMPLETE] = true;
    regImgSrcUrlSubset.sogs.push(...pRegImgSrcUrls);
    regImgBinarySubset.sogs.push(...pRegImgBinaries);
    
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostReplyCount.Name).sogs.push(...sReplyCounts);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostLikeCount.Name).sogs.push(...sLikeCounts);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostReshareCount.Name).sogs.push(...sReshareCounts);

    const searchBlob = searchParts.filter(function(p) { return STR.hasLen(p); }).join('\n');
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostSearchBlob.Name).sogs.push({s: urlKey, o: searchBlob, g: graph});
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
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, false);

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      TCARD_SAVE_MAPPER.mapRecordIntoSet(record, set, graph);
    }

    return set;
  },

  // pass parent (tweet) record too
  mapRecordIntoSet: function(record, set, graph, parent) {
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
      if (STR.hasLen(record[SAVABLE_IMG_ATTR.img64Url])) {
        img64 = record[SAVABLE_IMG_ATTR.img64Url];
      }
      else {
        // NOTE: the entity holding the bag of images is the parent tweet, not the card
        img64 = TWEET_SAVE_MAPPER.getMatchingImg64(parent, imgCdnUrl);
      }
      if (img64) {
        pCardImgBinaries.push({s: urlKey, o: img64, g: graph});
      }
    }

    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardText.Name).sogs.push(...pCardTexts);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardShortUrl.Name).sogs.push(...pCardShortUrls);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardFullUrl.Name).sogs.push(...pCardFullUrls);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardImgSourceUrl.Name).sogs.push(...pCardImgSrcUrls);
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardImgBinary.Name).sogs.push(...pCardImgBinaries);

    const searchBlob = searchParts.filter(function(p) { return STR.hasLen(p); }).join('\n');
    APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostCardSearchBlob.Name).sogs.push({s: urlKey, o: searchBlob, g: graph});
  }
};

var TPOST_MEDIA_SAVE_MAPPER = {

  getEntDefns: function() {
    return [
      APPSCHEMA.SocialPostRegImgSourceUrl,
      APPSCHEMA.SocialPostRegImgBinary,
      APPSCHEMA.SocialPostEmbedsVideo
    ];
  },

  mapSavableSet: function(records, pageType, graph) {
    const entDefns = TPOST_MEDIA_SAVE_MAPPER.getEntDefns();
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, false);

    const regImgSrcUrlSubset = APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostRegImgSourceUrl.Name);
    const regImgBinarySubset = APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostRegImgBinary.Name);
    regImgSrcUrlSubset[SUBSET_IS_COMPLETE] = true;
    regImgBinarySubset[SUBSET_IS_COMPLETE] = true;

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let urlKey = record[TWEET_POST_IMG_ATTR.postUrlKey];
      let imgCdnUrl = record[TWEET_POST_IMG_ATTR.imgCdnUrl];
      let img64 = record[TWEET_POST_IMG_ATTR.img64Url];
      let isEmbeddedVideo = record[TWEET_POST_IMG_ATTR.isEmbeddedVideo];

      if (STR.hasLen(imgCdnUrl)) {
        regImgSrcUrlSubset.sogs.push({s: urlKey, o: imgCdnUrl, g: graph});
      }
      if (STR.hasLen(img64)) {
        regImgBinarySubset.sogs.push({s: urlKey, o: img64, g: graph});
      }
      if (STR.isTruthy(isEmbeddedVideo)) {
        APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialPostEmbedsVideo.Name).sogs.push({s: urlKey, o: 1, g: graph});
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
    const set = APPSCHEMA.SAVING.newSavableSet(entDefns, false);

    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let handle = record[TWEET_AUTHOR_IMG_ATTR.handle];
      if (STR.hasLen(handle)) {
        let imgCdnUrl = record[TWEET_AUTHOR_IMG_ATTR.imgCdnUrl];
        let img64 = record[TWEET_AUTHOR_IMG_ATTR.img64Url];

        if (STR.hasLen(imgCdnUrl)) {
          APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileImgSourceUrl.Name).sogs.push({s: handle, o: imgCdnUrl, g: graph});
        }
        if (STR.hasLen(img64)) {
          APPSCHEMA.SAVING.getSubset(set, APPSCHEMA.SocialProfileImgBinary.Name).sogs.push({s: handle, o: img64, g: graph});
        }
      }
    }

    return set;
  }
};