var TWEETPARSE = {
  
  buildTweetFromElm: function(tweetElm, parsedUrl) {
    // note: author image loads with a delay, so is handled separately via getTweetAuthorImgElms
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(tweetElm);
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm, tweetElm);

    // see SAVABLE_TWEET_ATTR
    const tweet = { };
    tweet.pageType = PAGETYPE.TWITTER.TWEETS;
    
    // e.g. "/scafaria/status/1665507318031630337"
    tweet.urlKey = TWEETPARSE.getTweetRelativeUrl(timestampElm);

    if (!tweet.urlKey) {
      return null;
    }

    tweet.authorHandle = TWEETPARSE.getAuthorHandle(authorHeadlineElm);
    tweet.authorName = TWEETPARSE.getAuthorName(authorHeadlineElm, tweet.authorHandle);
    // e.g. "2023-06-07T16:40:45.000Z"
    tweet.postedUtc = TWEETPARSE.getTimestampValue(timestampElm);
    
    // see if replying to a post
    const replyToUrlKey = TWEETPARSE.getReplyToUrlKey(tweetElm);
    if (replyToUrlKey) {
      tweet.replyToUrlKey = replyToUrlKey;
    }

    const retweetedBy = TWEETPARSE.getRetweetedByHandle(tweetElm);
    if (retweetedBy) {
      tweet.retweetedBy = retweetedBy;
    }

    const postText = TWEETPARSE.getTweetText(tweetElm);
    if (postText) {
      tweet.postText = postText;
    }

    const quoted = TWEETPARSE.getQuotedTweet(tweetElm, parsedUrl);
    if (quoted) {
      tweet.quoteTweet = quoted;
    }
    
    // we aren't planning to go from a thread conversation detail page into deeper rabbit-holes
    if (!parsedUrl.threadDetailId) {
      tweet.hasMore = TWEETPARSE.getThreadHasMore(tweetElm, postText, tweet.urlKey);
    }

    return tweet;
  },

  getQuotedTweet: function(tweetElm, parsedUrl) {
    // look for telltale sign of quote-tweet child
    const candidates = Array.from(tweetElm.querySelectorAll('div[dir="ltr"]'));
    let qtElm = null;
    for (let i = 0; i < candidates.length; i++) {
      let candidate = candidates[i];
      if (candidate.innerText == 'Quote Tweet') {
        let sibl = candidate.nextSibling;
        if (sibl && ES6.isElementNode(sibl) && sibl.getAttribute('tabindex') == '0') {
          qtElm = sibl;
          break;
        }
      }
    }
    
    if (!qtElm) {
      return null;
    }

    const qt = { };

    // might be not found in the case of a quote tweet
    urlKey = TWEETPARSE.getPostUrlKeyForQuoteTweet(qtElm);
    if (urlKey && urlKey.length > 0) {
      qt.urlKey = urlKey;
    }

    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(qtElm);
    const timestampElm = TWEETPARSE.getTimestampElm(qtElm);
    qt.authorHandle = TWEETPARSE.getAuthorHandleFromQuoteTweet(authorHeadlineElm);
    // too hard to get this reliably; commenting out
    // qt.authorName = TWEETPARSE.getAuthorName(authorHeadlineElm, qt.authorHandle);
    qt.postedUtc = TWEETPARSE.getTimestampValue(timestampElm);

    const tweetText = TWEETPARSE.getTweetText(qtElm);
    if (tweetText) {
      qt.postText = tweetText;
      
      // we aren't planning to go from a thread conversation detail page into deeper rabbit-holes
      if (!parsedUrl.threadDetailId) {
        qt.hasMore = TWEETPARSE.getThreadHasMore(qtElm, qt.postText, qt.urlKey);
      }
    }

    return qt;
  },

  getThreadHasMore: function(tweetElm, tweetText, urlKey) {
    if (tweetText && tweetText.trim().endsWith('Show more')) {
      return true;
    }
    else {
      const anchors = Array.from(tweetElm.querySelectorAll('a'));
      for (let i = 0; i < anchors.length; i++) {
        let anchor = anchors[i];
        if (anchor.innerText == 'Show this thread') {
          let href = anchor.getAttribute('href');
          return href == urlKey;
        }
      }
    }

    return false;
  },

  getAuthorHandleFromQuoteTweet: function(qtAuthorHeadlineElm) {
    const elm = qtAuthorHeadlineElm.querySelector('div[tabindex="-1"]');
    if (elm && elm.innerText.startsWith('@')) {
      return elm.innerText;
    }
    else {
      return null;
    }
  },

  getParentTweetElmInfo: function(el) {
    // check first for if it's a quote tweet
    while (el.parentNode && el.parentNode.nodeType == 1 /* element */) {
      el = el.parentNode;
      if (STR.sameText(el.tagName, 'article') && STR.sameText(el.getAttribute('data-testid'), 'tweet')) {
        // a regular tweet
        return {
          elm: el,
          quoted: false
        }
      }
      else if (el.getAttribute('tabindex', '0') && el.previousSibling && ES6.isElementNode(el.previousSibling) && el.previousSibling.innerText == 'Quote Tweet') {
        // a quote tweet
        return {
          elm: el,
          quoted: true
        }
      }
    }
  
    return null;
  },

  getPostUrlKeyForQuoteTweet: function(qtTweetElm) {
    const anchors = Array.from(qtTweetElm.querySelectorAll('a'));
    for (let i = 0; i < anchors.length; i++) {
      let anchor = anchors[i];
      let href = anchor.getAttribute('href');
      if (href.indexOf('/status/') > -1) {
        return href;
      }
    }

    return null;
  },

  getPostUrlKeyFromChildElm: function(childElm) {
    const tweetElmInfo = TWEETPARSE.getParentTweetElmInfo(childElm);
    if (!tweetElmInfo || !tweetElmInfo.elm) { return null; }

    if (tweetElmInfo.quoted == true) {
      // this image is part of a quote tweet; the tweet link won't be found in the author headline timestamp
      // look instead for 'show more' link
      return TWEETPARSE.getPostUrlKeyForQuoteTweet(tweetElmInfo.elm);
    }
    else {
      const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(tweetElmInfo.elm);
      const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm, tweetElmInfo.elm);
      const postUrlKey = TWEETPARSE.getTweetRelativeUrl(timestampElm);
      return postUrlKey;
    }
  },

  // see TWEET_CARD_ATTR
  buildTweetCard: function(imgElm) {
    const card = {};

    const postUrlKey = TWEETPARSE.getPostUrlKeyFromChildElm(imgElm);
    if (!postUrlKey) { return null; }
    
    // could pass in an svg elm instead
    if (imgElm.hasAttribute('src')) {
      card.imgCdnUrl = imgElm.getAttribute('src');
    }

    const container = ES6.findUpByAttrValue(imgElm, 'data-testid', 'card.wrapper');
    
    const anchor = container.querySelector('a');
    if (anchor) {
      // typically a short t.co url
      if (STR.isShortUrl(anchor.href)) {
        card.shortSourceUrl = anchor.href;
      }
      else {
        card.fullSourceUrl = anchor.href;
      }
    }

    card.pageType = PAGETYPE.TWITTER.TWEET_CARDS;
    card.cardText = container.innerText;
    card.postUrlKey = postUrlKey;
    return card;
  },

  // TWEET_POST_IMG_ATTR
  // { postUrlKey: '/scafaria/status/123', imgCdnUrl: 'htt...' }
  buildTweetPostImgInfo: function(imgElm) {
    const imgCdnUrl = imgElm.getAttribute('src');
    const postUrlKey = TWEETPARSE.getPostUrlKeyFromChildElm(imgElm);
    if (!postUrlKey) { return null; }

    return {
      postUrlKey: postUrlKey,
      isEmbeddedVideo: false,
      pageType: PAGETYPE.TWITTER.TWEET_POST_MEDIA,
      imgCdnUrl: imgCdnUrl
    };
  },

  buildTweetPostEmbeddedVideoInfo: function(videoElm) {
    const imgCdnUrl = videoElm.poster;
    const postUrlKey = TWEETPARSE.getPostUrlKeyFromChildElm(videoElm);
    if (!postUrlKey) { return null; }

    return {
      postUrlKey: postUrlKey,
      isEmbeddedVideo: true,
      pageType: PAGETYPE.TWITTER.TWEET_POST_MEDIA,
      imgCdnUrl: imgCdnUrl
    };
  },

  // { handle: '@handle', imgCdnUrl: 'htt...'}
  buildAuthorCdnUrlPair: function(imgElm) {
    const anchor = ES6.findUpTag(imgElm, 'a', false);
    if (!anchor) {
      return undefined;
    }

    const href = anchor.getAttribute('href');
    const handle = STR.ensurePrefix(STR.stripPrefix(href, '/'), '@');

    if (handle.indexOf('/') > -1) {
      // invalid profile anchor
      return undefined;
    }

    return {
      handle: handle,
      pageType: PAGETYPE.TWITTER.TWEET_AUTHOR_IMG,
      imgCdnUrl: imgElm.getAttribute('src')
    };
  },

  getTweetText: function(tweetElm) {
    const div = tweetElm.querySelector('div[data-testid="tweetText"]');
    if (!div) { return null; }
    const txt = ES6.getUnfurledText(div);
    return txt;
  },

  getRetweetedByHandle: function(tweetElm) {
    const ltrs = Array.from(tweetElm.querySelectorAll('a[dir="ltr"]'));
    for (let i = 0; i < ltrs.length; i++) {
      let ltr = ltrs[i];
      let txt = ltr.innerText;
      if (txt && txt.toLowerCase().endsWith('retweeted')) {
        let href = ltr.getAttribute('href');
        let handle = STR.ensurePrefix(STR.stripPrefix(href, '/'), '@');
        return handle;
      }
    }

    return null;
  },

  getReplyToDiv: function(tweetElm) {
    const ltrs = Array.from(tweetElm.querySelectorAll('div[dir="ltr"]'));
    for (let i = 0; i < ltrs.length; i++) {
      let ltr = ltrs[i];
      // we don't want the user row
      let userNameParent = ES6.findUpByAttrValue('data-testid', 'User-Name');
      if (!userNameParent) {
        let txt = ltr.innerText;
        if (txt && txt.toLowerCase().startsWith('replying to')) {
          return ltr;
        }
      }
    }

    return null;
  },

  getReplyToUrlKey: function(tweetElm) {
    // see if we can find the 'replying to' line
    const replyToDiv = TWEETPARSE.getReplyToDiv(tweetElm);
    if (!replyToDiv) { return null; }
    const a = replyToDiv.querySelector('a[dir="ltr"]');  // the first one listed should be the prior tweet's author
    if (!a) { return null; }
    const replyToProfileUrl = a.getAttribute('href'); // e.g. "/scafaria" if replying to scafaria
    const replyToHandle = replyToProfileUrl.replace('/', '@');
    // now go up to the container holding the tweet
    const container = ES6.findUpByAttrValue(tweetElm, 'data-testid', 'cellInnerDiv');
    // now expect to find prior sibling element
    if (!container) { return null; }
    const priorContainer = container.previousSibling;
    if (!priorContainer || !ES6.isElementNode(priorContainer)) { return null; }
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(priorContainer);
    if (!authorHeadlineElm) { return null; }
    const authorHandle = TWEETPARSE.getAuthorHandle(authorHeadlineElm);
    if (!STR.sameText(replyToHandle, authorHandle)) { return null; }
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm, tweetElm);
    const urlKey = TWEETPARSE.getTweetRelativeUrl(timestampElm);
    // if later interested, we could also get the text ('replying to @user1 @user2...')
    // const replyingTo = STR.normalizeSpaces(replyToDiv.innerText);

    return urlKey;
  },

  // the top headline of a tweet, containing author info, tweet link, and time
  getAuthorHeadlineElm: function(tweetElm) {
    return tweetElm.querySelector('div[data-testid="User-Name"]');
  },

  getTweetRelativeUrl: function(timestampElm) {
    var href = ES6.findUpTag(timestampElm, 'a').getAttribute('href');
    return (href.toLowerCase().indexOf('status') < 0) ? undefined : href;
  },

  // 2023-06-05T20:10:22.000Z
  getTimestampValue: function(timestampElm) {
    return timestampElm.getAttribute('datetime');
  },

  // sometimes the time is rendered at the author headline, sometimes (when expanded) below the tweet
  getTimestampElm: function(authorHeadlineElm, parentTweetElm) {
    if (!authorHeadlineElm && !parentTweetElm) {
      return null;
    }
    
    let timeElm;
    if (authorHeadlineElm) {
      timeElm = authorHeadlineElm.querySelector('time');
    }

    if (parentTweetElm && !timeElm) {
      timeElm = parentTweetElm.querySelector('time');
    }
    
    return timeElm;
  },

  getAuthorName: function(authorHeadlineElm, authorHandle) {
    const href = authorHandle.replace('@', '/');
    // the first anchor is display name
    const anchor = authorHeadlineElm.querySelector('a');
    if (!STR.sameText(anchor.getAttribute('href'), href)) { return undefined; }
    const display = ES6.getUnfurledText(anchor);
    return display;
  },

  // e.g. '@scafaria'
  getAuthorHandle: function(authorHeadlineElm) {
    const anchors = Array.from(authorHeadlineElm.querySelectorAll('a'));
    const handleAnchor = anchors.find(function(a) {
      const viaHref = STR.stripPrefix(a.getAttribute('href'), '/');
      const viaTxt = STR.stripPrefix(a.innerText, '@');
      
      return STR.sameText(viaHref, viaTxt);
    });

    if (!handleAnchor) { return null; }
    const href = handleAnchor.getAttribute('href');
    const bareHandle = STR.stripPrefix(href, '/');
    return STR.ensurePrefix(bareHandle, '@');
  }
};