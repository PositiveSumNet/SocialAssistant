var NEETPARSE = {

  buildTweetFromElm: function(tweetElm) {
    // see SAVABLE_TWEET_ATTR
    const tweet = { };
    tweet.urlKey = NEETPARSE.getTweetRelativeUrl(tweetElm);
    tweet.authorHandle = NEETPARSE.getAuthorHandle(tweetElm);
    tweet.authorName = NEETPARSE.getAuthorName(tweetElm);
    tweet.postedUtc = NEETPARSE.getTimestampValue(tweetElm);

    // see if replying to a post
    const replyToUrlKey = NEETPARSE.getReplyToUrlKey(tweetElm);
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
      // for twitter, this is a separate recording
      tweet.card = card;
    }

    // see TWEET_POST_IMG_ATTR
    const postImg = NEETPARSE.getTweetImageInfo(tweetElm, tweet.urlKey);
    if (postImg) {
      tweet.postImg = postImg;
    }

    // const quoted = NEETPARSE.getQuotedTweet(tweetElm);
    // if (quoted) {
    //   tweet.quoteTweet = quoted;
    // }
    
    // tweet.hasMore = NEETPARSE.getThreadHasMore(tweetElm, postText, tweet.urlKey);

    return tweet;
  },

  getTweetImageInfo: function(tweetElm, postUrlKey) {
    const imgPlayableVideo = tweetElm.querySelector('.attachments .video-container video');
    if (imgPlayableVideo) {
      return {
        postUrlKey: postUrlKey,
        isEmbeddedVideo: true,
        imgCdnUrl: imgPlayableVideo.poster
      };
    }

    // until user clicks to enable playback
    const imgShuntedVideo = tweetElm.querySelector('.attachments .video-container img');
    if (imgShuntedVideo) {
      return {
        postUrlKey: postUrlKey,
        isEmbeddedVideo: true,
        imgCdnUrl: imgShuntedVideo.src
      };
    }

    const imgSansVideo = tweetElm.querySelector('.attachments img');
    if (imgSansVideo) {
      return {
        postUrlKey: postUrlKey,
        isEmbeddedVideo: false,
        imgCdnUrl: imgSansVideo.src
      };
    }
    else {
      return null;
    }
  },

  // see TWEET_CARD_ATTR
  getTweetCard: function(tweetElm) {
    const a = tweetElm.querySelector('a.card-container');
    if (!a) { return null;}
    
    const card = {};
    card.fullSourceUrl = a.href;
    
    const img = a.querySelector('.card-image img');
    if (img) {
      card.imgCdnUrl = img.getAttribute('src');
    }

    const txtElm = a.querySelector('.card-content');
    if (txtElm) {
      card.cardText = txtElm.innerText;
    }
  },

  getTweetText: function(tweetElm) {
    const textElm = tweetElm.querySelector('.tweet-body .tweet-content');
    if (!textElm) { return null; }
    let txt = ES6.getUnfurledText(textElm);
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

  getReplyToUrlKey(tweetElm) {
    if (!tweetElm.classList.contains('thread')) {
      return null;
    }

    const prior = tweetElm.previousSibling;
    if (!prior || !ES6.isElementNode(prior)) { 
      return null;
    }
    
    return NEETPARSE.getTweetRelativeUrl(prior);
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

  getTweetRelativeUrl: function(tweetElm) {
    const anchor = tweetElm.querySelector('.tweet-link');
    let urlKey = anchor.getAttribute('href');
    // nitter links often navigate to /username/status/12345#m 
    // where the div id of m stands for 'main' (to aid navigation).
    // But we want an urlKey that's consistent with twitter, so it's stripped here
    urlKey = STR.stripUrlHashSuffix(urlKey);
    return urlKey;
  }
};