var NEETPARSE = {

  buildTweetFromElm: function(tweetElm, parsedUrl) {
    // see SAVABLE_TWEET_ATTR
    const tweet = { };
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
    const replyToUrlKey = NEETPARSE.getReplyToUrlKey(tweetElm, parsedUrl, tweet.urlKey);
    if (replyToUrlKey) {
      tweet.replyToUrlKey = replyToUrlKey;
    }

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
      if (tweet.card.imgCdnUrl) {
        imgUrls.push(tweet.card.imgCdnUrl);
      }
    }

    // see TWEET_POST_IMG_ATTR
    tweet.postImgs = NEETPARSE.getTweetImageInfos(tweetElm, tweet.urlKey, false);
    for (let i = 0; i < tweet.postImgs.length; i++) {
      imgUrls.push(tweet.postImgs[i].imgCdnUrl);
    }

    const quoted = NEETPARSE.getQuoteTweet(tweetElm, parsedUrl);
    if (quoted) {
      tweet.quoteTweet = quoted;
    }
    
    // we aren't planning to go from a thread conversation detail page into deeper rabbit-holes
    if (!parsedUrl.threadDetailId) {
      tweet.hasMore = NEETPARSE.getThreadHasMore(tweetElm);
    }

    RECORDING.infuseImgCdns(tweet, imgUrls);

    return tweet;
  },

  getPostUrlKeyForQuoteTweet: function(qtTweetElm) {
    const anchor = qtTweetElm.querySelector('a.quote-link');
    if (!anchor) { return null; }
    return anchor.getAttribute('href');
  },

  getQuoteTweet: function(tweetElm, parsedUrl) {
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

  getThreadHasMore: function(tweetElm) {
    const showMoreAnchor = tweetElm.querySelector('.tweet-body>a.show-thread');
    return showMoreAnchor && showMoreAnchor.innerText.toLowerCase().indexOf('show') > -1;
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

  getRetweetedByHandle: function(tweetElm) {
    const rtElm = tweetElm.querySelector('.tweet-body .retweet-header');
    if (!rtElm) { return null; }
    // nitter doesn't render the retweeted-by handle, but it's always the owner of the stream context
    const parsedUrl = URLPARSE.getParsedUrl();
    if (!parsedUrl || !parsedUrl.owner || parsedUrl.owner.length == 0) { return null; }
    return STR.ensurePrefix(parsedUrl.owner, '@');
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
  }
};