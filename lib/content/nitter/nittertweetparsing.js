var NEETPARSE = {

  buildTweetFromElm: function(tweetElm, parsedUrl) {
    // see SAVABLE_TWEET_ATTR
    const tweet = { };
    tweet.pageType = PAGETYPE.TWITTER.TWEETS;
    const imgUrls = [];

    tweet.urlKey = NEETPARSE.getTweetRelativeUrl(tweetElm);
    if (!tweet.urlKey) {
      return null;
    }

    tweet.authorHandle = NEETPARSE.getAuthorHandle(tweetElm);
    tweet.authorName = NEETPARSE.getAuthorName(tweetElm);
    tweet.authorImgCdnUrl = NEETPARSE.getAuthorCdnImgUrl(tweetElm);
    
    if (tweet.authorImgCdnUrl) {
      imgUrls.push(tweet.authorImgCdnUrl);
    }
    
    tweet.postedUtc = NEETPARSE.getTimestampValue(tweetElm);

    // see if replying to a post
    const threadInfo = NEETPARSE.THREADING.getThreadInfo(tweetElm, parsedUrl, tweet.urlKey);
    tweet.replyToUrlKey = threadInfo[THREAD_INFO.replyToUrlKey];
    tweet.threadUrlKey = threadInfo[THREAD_INFO.threadUrlKey];

    const retweetedBy = NEETPARSE.getRetweetedByHandle(tweetElm);
    if (retweetedBy) {
      tweet.retweetedBy = retweetedBy;
    }

    const postText = NEETPARSE.getTweetText(tweetElm);
    if (postText) {
      tweet.postText = postText;
    }

    const card = NEETPARSE.getTweetCard(tweetElm);
    if (card) {
      tweet.card = card;
      tweet.card.postUrlKey = tweet.urlKey;
      if (tweet.card.imgCdnUrl) {
        imgUrls.push(tweet.card.imgCdnUrl);
      }
    }

    // see TWEET_POST_IMG_ATTR
    tweet.postImgs = NEETPARSE.getTweetImageInfos(tweetElm, tweet.urlKey, false);
    for (let i = 0; i < tweet.postImgs.length; i++) {
      imgUrls.push(tweet.postImgs[i].imgCdnUrl);
    }

    const quoted = NEETPARSE.getQuotedTweet(tweetElm, parsedUrl);
    if (quoted) {
      tweet.quoteTweet = quoted;
    }
    
    // we aren't planning to go from a thread conversation detail page into deeper rabbit-holes
    if (!parsedUrl.threadDetailId) {
      tweet.hasMore = threadInfo[THREAD_INFO.unfurlRequired] || NEETPARSE.getThreadHasMore(tweetElm, tweet.urlKey);
    }

    RECORDING.infuseImgCdns(tweet, imgUrls);

    return tweet;
  },

  getPostUrlKeyForQuoteTweet: function(qtTweetElm) {
    const anchor = qtTweetElm.querySelector('a.quote-link');
    if (!anchor) { return null; }
    return STR.getUrlSansHashAndQueryString(anchor.getAttribute('href'));
  },

  getQuotedTweet: function(tweetElm, parsedUrl) {
    const qtElm = tweetElm.querySelector('.quote');

    if (!qtElm || qtElm.classList.contains('unavailable')) {
      return null;
    }

    const qt = { };

    // might be not found in the case of a quote tweet
    urlKey = NEETPARSE.getPostUrlKeyForQuoteTweet(qtElm);
    if (urlKey && urlKey.length > 0) {
      qt.urlKey = urlKey;
    }

    const authorHandleElm = qtElm.querySelector('.tweet-name-row a.username');
    if (!authorHandleElm) { return null; }
    qt.authorHandle = authorHandleElm.innerText;
    qt.authorName = ES6.getUnfurledText(qtElm.querySelector('.tweet-name-row a.fullname'));
    qt.postedUtc = NEETPARSE.getQuoteTweetTimestampValue(tweetElm);

    const tweetText = NEETPARSE.getQuoteTweetText(tweetElm);
    if (tweetText) {
      qt.postText = tweetText;
    }

    qt.postImgs = NEETPARSE.getTweetImageInfos(tweetElm, urlKey, true);

    // we aren't planning to go from a thread conversation detail page into deeper rabbit-holes
    if (!parsedUrl.threadDetailId) {
      qt.hasMore = NEETPARSE.getQuoteTweetThreadHasMore(tweetElm);
    }

    return qt;
  },

  getThreadHasMore: function(tweetElm, urlKey) {
    const showMoreAnchor = tweetElm.querySelector('.tweet-body>a.show-thread');
    if (showMoreAnchor && showMoreAnchor.innerText.toLowerCase().indexOf('show') > -1) {
      return true;
    }
    else {
      // sometimes 'i' is used instead of 'username' within the anchor href
      const tweetId = STR.getTweetIdFromUrlKey(urlKey);
      const lookFor = `/status/${tweetId}`;
      const anchor = document.body.querySelector(`a.more-replies-text[href*="${lookFor}"]`);
      if (anchor) {
        return true;
      }
      else {
        return false;
      }
    }
  },

  getQuoteTweetThreadHasMore: function(tweetElm) {
    const showMoreAnchor = tweetElm.querySelector('.tweet-body .quote a.show-thread');
    return showMoreAnchor && showMoreAnchor.innerText.toLowerCase().indexOf('show') > -1;
  },

  getTweetImageInfos: function(tweetElm, postUrlKey, ofQuoteTweet) {
    
    const infos = [];
    
    const attachmentsElm = (ofQuoteTweet == true) 
      ? tweetElm.querySelector('.tweet-body .quote .attachments')
      : tweetElm.querySelector('.tweet-body>.attachments');

    if (!attachmentsElm) { return infos; }

    // queued up to play (depends on nitter settings)
    const imgPlayableVideos = Array.from(attachmentsElm.querySelectorAll('.video-container video'));
    for (let i = 0; i < imgPlayableVideos.length; i++) {
      let imgPlayableVideo = imgPlayableVideos[i];
      
      infos.push({
        postUrlKey: postUrlKey,
        isEmbeddedVideo: true,
        imgCdnUrl: imgPlayableVideo.poster
      });
    }

    // until user clicks to enable playback
    const imgShuntedVideos = Array.from(attachmentsElm.querySelectorAll('.video-container img'));
    for (let i = 0; i < imgShuntedVideos.length; i++) {
      let imgShuntedVideo = imgShuntedVideos[i];

      infos.push({
        postUrlKey: postUrlKey,
        isEmbeddedVideo: true,
        imgCdnUrl: imgShuntedVideo.src
      });
    }

    const imgSansVideos = Array.from(attachmentsElm.querySelectorAll('.attachments .image img'));
    for (let i = 0; i < imgSansVideos.length; i++) {
      let imgSansVideo = imgSansVideos[i];

      infos.push({
        postUrlKey: postUrlKey,
        isEmbeddedVideo: false,
        imgCdnUrl: imgSansVideo.src
      });
    }

    return infos;
  },

  // see TWEET_CARD_ATTR
  getTweetCard: function(tweetElm) {
    const a = tweetElm.querySelector('.tweet-body a.card-container');
    if (!a) { return null;}
    
    const card = {};
    card.fullSourceUrl = a.href;
    
    const img = a.querySelector('.card-image img');
    if (img) {
      card.imgCdnUrl = img.src;
    }

    const txtElm = a.querySelector('.card-content');
    if (txtElm) {
      card.cardText = txtElm.innerText;
    }

    return card;
  },

  getQuoteTweetText: function(tweetElm) {
    const textElm = tweetElm.querySelector('.tweet-body .quote .quote-text');
    if (!textElm) { return null; }
    let txt = ES6.getUnfurledText(textElm, true);
    return txt;
  },

  getTweetText: function(tweetElm) {
    const textElm = tweetElm.querySelector('.tweet-body .tweet-content');
    if (!textElm) { return null; }
    let txt = ES6.getUnfurledText(textElm, true);
    return txt;
  },

  // the first handle being replied to
  getReplyingToHandle: function(tweetElm) {
    const repElm = tweetElm.querySelector('.replying-to');
    if (!repElm) { return null; }
    let repText = repElm.innerText;
    if (!repText || !repText.toLowerCase().startsWith('replying to')) { return null; }
    repText = STR.stripPrefix(repText, 'Replying to ');
    let handles = repText.split(' ');
    let handle = handles[0].trim();
    if (!handle.startsWith('@')) { return null; }
    return handle;
  },

  getRetweetedByHandle: function(tweetElm) {
    const rtElm = tweetElm.querySelector('.tweet-body .retweet-header');
    if (!rtElm) { return null; }
    // nitter doesn't render the retweeted-by handle, but it's always the owner of the stream context
    const parsedUrl = URLPARSE.parseUrl(document.location.href);
    if (!parsedUrl || !parsedUrl.owner || parsedUrl.owner.length == 0) { return null; }
    return STR.ensurePrefix(parsedUrl.owner, '@');
  },

  getQuoteTweetTimestampValue(tweetElm) {
    const elm = tweetElm.querySelector('.tweet-body .quote .tweet-name-row .tweet-date a');
    const rawTime = elm.getAttribute('title');
    if (!rawTime || rawTime.length == 0) { return null; }
    return STR.nitterTimeToIso(rawTime);
  },

  getTimestampValue(tweetElm) {
    const elm = tweetElm.querySelector('.tweet-body .tweet-header .tweet-name-row .tweet-date a');
    const rawTime = elm.getAttribute('title');
    if (!rawTime || rawTime.length == 0) { return null; }
    return STR.nitterTimeToIso(rawTime);
  },

  getAuthorName: function(tweetElm) {
    const elm = tweetElm.querySelector('.tweet-body .tweet-header .tweet-name-row a.fullname');
    const name = elm.innerText;
    if (!name || name.length == 0) { return null; }
    return name;
  },

  getAuthorHandle: function(tweetElm) {
    const elm = tweetElm.querySelector('.tweet-body .tweet-header .tweet-name-row a.username');
    const handle = elm.innerText;
    if (!handle || handle.length == 0) { return null; }
    return STR.ensurePrefix(handle, '@');
  },

  getAuthorCdnImgUrl: function(tweetElm) {
    const img = tweetElm.querySelector('.tweet-body .tweet-header .tweet-avatar img.avatar');
    if (!img) { return null; }
    return img.src;
  },

  constructMainTweetRelativeUrl: function(tweetElm) {
    if (!ES6.findUpClass(tweetElm, 'main-tweet')) {
      return undefined;
    }

    // look to the page; either of:
    // https://nitter.net/username/status/12345#m
    // https://nitter.net/i/status/12345
    // the "i" variant is tricky
    let url = document.location.href;
    url = STR.stripUrlHashSuffix(url);
    url = STR.stripQueryString(url);
    url = STR.stripHttpWwwPrefix(url);
    let parts = url.split('/');

    if (parts.length != 4 || !STR.sameText(parts[2], 'status')) {
      return undefined;
    }

    let owner = parts[1];
    const threadId = parts[3];

    if (owner == 'i') {
      // need to dig into the element
      owner = NEETPARSE.getAuthorHandle(tweetElm);
    }

    return STR.makeTweetRelativeUrl(owner, threadId);
  },

  getTweetRelativeUrl: function(tweetElm) {
    if (ES6.findUpClass(tweetElm, 'main-tweet')) {
      // the main-tweet on a nitter thread detail page lacks the tweet-link
      // instead, look to the page url
      return NEETPARSE.constructMainTweetRelativeUrl(tweetElm);
    }

    const anchor = tweetElm.querySelector('.tweet-link');
    if (!anchor) {
      // e.g. the '.timeline-item.more-replies' link
      return null;
    }

    let urlKey = anchor.getAttribute('href');
    
    // nitter links often navigate to /username/status/12345#m 
    // where the div id of m stands for 'main' (to aid navigation).
    // But we want an urlKey that's consistent with twitter, so it's stripped here
    urlKey = STR.stripUrlHashSuffix(urlKey);
    urlKey = STR.stripQueryString(urlKey);
    return STR.stripSuffix(urlKey, '/');
  },

  getReplyToUrlKey(tweetElm, parsedUrl, tweetUrlKey) {
    if (!parsedUrl.threadDetailId) {
      // on timeline stream
      if (!tweetElm.classList.contains('thread')) {
        return null;
      }
  
      const prior = ES6.previousElementNodeSibling(tweetElm);
      if (!prior) { 
        return null;
      }
      
      return NEETPARSE.getTweetRelativeUrl(prior);
    }
    else {
      // on conversation detail page
      const prior = ES6.previousElementNodeSibling(tweetElm);
      if (prior) {
        return NEETPARSE.getTweetRelativeUrl(prior);
      }
      else if (parsedUrl.owner) {
        // This happens when it's the start of a particular comment thread.
        // It doesn't mean there's no reply-to. It means it's replying to the main post, which we have via parsedUrl
        const urlKey = STR.makeTweetRelativeUrl(parsedUrl.owner, parsedUrl.threadDetailId);
        if (STR.sameText(urlKey, tweetUrlKey)) {
          // we don't want it to say it's replying to itself
          return null;
        }
        else {
          return urlKey;
        }
      }
      else {
        return null;
      }
    }
  },

  isMainTweet: function(tweetElm) {
    if (!tweetElm) { return false; }
    const parent = ES6.findUpClass(tweetElm, 'main-tweet');
    if (parent) {
      return true;
    }
    else {
      return false;
    }
  },

  THREADING: {
    // returns a THREAD_INFO
    getThreadInfo: function(tweetElm, parsedUrl, tweetUrlKey) {
      if (!parsedUrl.threadDetailId) {
        // on timeline stream
        return NEETPARSE.THREADING.getStreamThreadInfo(tweetElm);
      }
      else {
        return NEETPARSE.THREADING.getPostPageThreadInfo(tweetUrlKey);
      }
    },

    getStreamThreadInfo: function(tweetElm) {
      const replyingToHandle = NEETPARSE.getReplyingToHandle(tweetElm);
      const response = {};
      
      if (STR.hasLen(replyingToHandle)) {
        // that's all we can learn at this level in nitter; that an offscreen navigation to thread detail page is required
        response[THREAD_INFO.unfurlRequired] = true;
      }
      
      return response;
    },

    getPostPageThreadInfo: function(tweetUrlKey) {
      const response = {};
      if (!STR.hasLen(tweetUrlKey)) { return response; }
      const tweetElms = Array.from(document.querySelectorAll('.timeline-item'));
      if (tweetElms.length == 0) { return response; }
      const threadUrlKey = NEETPARSE.getTweetRelativeUrl(tweetElms[0]);
      let replyToUrlKey;
      let mainUrlKey;

      for (let i = 0; i < tweetElms.length; i++) {
        let thisElm = tweetElms[i];
        let thisUrlKey = NEETPARSE.getTweetRelativeUrl(thisElm);
        
        if (thisUrlKey == tweetUrlKey) {
          // we've come to our subject tweet element, so we're ready to make a determination
          break;
        }

        if (NEETPARSE.isMainTweet(thisElm)) {
          mainUrlKey = thisUrlKey;
        }

        if (thisElm.classList.contains('thread-last')) {
          // default reply context
          replyToUrlKey = mainUrlKey || threadUrlKey;
        }
        else {
          // next tweet is assumed to be replying to this one
          replyToUrlKey = thisUrlKey;
        }
      }

      if (STR.hasLen(replyToUrlKey)) {
        response[THREAD_INFO.replyToUrlKey] = replyToUrlKey;
      }

      return response;
    },

    getPostPageThreadInfoOld: function(tweetUrlKey) {
      const tweetElms = Array.from(document.querySelectorAll('.timeline-item'));
      let threadUrlKey;
      let priorUrlKey;
      let priorAuthorHandle;
      let replyToUrlKey;
      for (let i = 0; i < tweetElms.length; i++) {
        let thisElm = tweetElms[i];
        let thisUrlKey = NEETPARSE.getTweetRelativeUrl(thisElm);
        
        if (i == 0) {
          threadUrlKey = thisUrlKey;
        }
        
        if (tweetUrlKey && thisUrlKey == tweetUrlKey) {
          // we've come to our subject tweet element, so we're ready to make a determination
          let replyingToHandle = NEETPARSE.getReplyingToHandle(thisElm);
          if (STR.hasLen(replyingToHandle)) {
            // see if we're replying to the prior tweet author
            if (replyingToHandle == priorAuthorHandle) {
              replyToUrlKey = priorUrlKey;
            }
            else {
              // else deem it to be a reply to the first tweet of the thread
              replyToUrlKey = threadUrlKey;
            }
          }
          break;
        }
        
        priorUrlKey = thisUrlKey;
        priorAuthorHandle = NEETPARSE.getAuthorHandle(thisElm);
      }

      const response = {};
      if (STR.hasLen(threadUrlKey)) {
        response[THREAD_INFO.threadUrlKey] = threadUrlKey;
      }
      if (STR.hasLen(replyToUrlKey)) {
        response[THREAD_INFO.replyToUrlKey] = replyToUrlKey;
      }
      // console.log(tweetUrlKey);
      // console.log(response);
      return response;
    }
  }
};