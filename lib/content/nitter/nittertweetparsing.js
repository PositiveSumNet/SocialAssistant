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

    // const quoted = NEETPARSE.getQuotedTweet(tweetElm);
    // if (quoted) {
    //   tweet.quoteTweet = quoted;
    // }
    
    // tweet.hasMore = NEETPARSE.getThreadHasMore(tweetElm, postText, tweet.urlKey);

    return tweet;
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