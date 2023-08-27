var TWEETPARSE = {
  
  // get all at once, instead of requiring caller to obtain the author and timestamp
  getTweetUrlKeyDirectly: function(tweetElm) {
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(tweetElm);
    if (!authorHeadlineElm) { return null; }
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm, tweetElm);
    if (!timestampElm) { return null; } // happens with ads
    return TWEETPARSE.getTweetRelativeUrl(timestampElm, tweetElm);
  },

  buildTweetFromElm: function(tweetElm, parsedUrl) {
    // note: author image loads with a delay, so is handled separately via getTweetAuthorImgElms
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(tweetElm);
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm, tweetElm);

    // see SAVABLE_TWEET_ATTR
    const tweet = { };
    tweet.pageType = PAGETYPE.TWITTER.TWEETS;
    
    // e.g. "/scafaria/status/1665507318031630337"
    tweet.urlKey = TWEETPARSE.getTweetRelativeUrl(timestampElm, tweetElm);

    if (!tweet.urlKey) {
      return null;
    }

    tweet.authorHandle = TWEETPARSE.getAuthorHandle(authorHeadlineElm);
    tweet.authorName = TWEETPARSE.getAuthorName(authorHeadlineElm, tweet.authorHandle);
    // e.g. "2023-06-07T16:40:45.000Z"
    tweet.postedUtc = TWEETPARSE.getTimestampValue(timestampElm);
    
    // see if replying to a post
    const threadInfo = TWEETPARSE.THREADING.getThreadInfo(tweetElm, parsedUrl, tweet.urlKey);
    tweet.replyToUrlKey = threadInfo[THREAD_INFO.replyToUrlKey];
    tweet.threadUrlKey = threadInfo[THREAD_INFO.threadUrlKey];

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
      tweet.hasMore = threadInfo[THREAD_INFO.unfurlRequired] || TWEETPARSE.getThreadHasMore(tweetElm, postText, tweet.urlKey);
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
    // sometimes 'i' is used instead of 'username' within the anchor href
    const tweetId = STR.getTweetIdFromUrlKey(urlKey);
    const lookFor = `/status/${tweetId}`;
    if (tweetText && tweetText.trim().endsWith('Show more')) {
      return true;
    }
    else {
      const anchors = Array.from(tweetElm.querySelectorAll('a'));
      for (let i = 0; i < anchors.length; i++) {
        let anchor = anchors[i];
        if (anchor.innerText == 'Show this thread') {
          let href = anchor.getAttribute('href');
          return href.indexOf(lookFor) > -1;
        }
      }
    }

    if (STR.hasLen(tweetId)) {
      const anchors = Array.from(document.body.querySelectorAll(`a[href*="${lookFor}"]`));
      for (let i = 0; i < anchors.length; i++) {
        let anchor = anchors[i];
        if (anchor.innerText.indexOf('more replies') > -1) {
          return true;
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
      // the extra check re /photo/ is for cases where navigating up from a photo of a quote tweet navigates to just the photo's link
      if (href.indexOf('/status/') > -1 && href.indexOf('/photo/') < 0) {
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
      const postUrlKey = TWEETPARSE.getTweetRelativeUrl(timestampElm, tweetElmInfo.elm);
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

  // the top headline of a tweet, containing author info, tweet link, and time
  getAuthorHeadlineElm: function(tweetElm) {
    return tweetElm.querySelector('div[data-testid="User-Name"]');
  },

  getTweetRelativeUrl: function(timestampElm, tweetElm) {
    if (!timestampElm) {
      // this happens with Ads. It's fine. Can uncomment to debug if needed.
      // console.log('No timestamp found for:');
      // console.log(tweetElm.outerHTML.substring(0, 300));
      return null;
    }
    const anchor = ES6.findUpTag(timestampElm, 'a');
    if (!anchor) {
      // this happens with Ads. It's fine.
      // console.log('No timestamp from anchor for:');
      // console.log(tweetElm.outerHTML.substring(0, 300));
      return null;
    }
    var href = anchor.getAttribute('href');
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
  },

  isMoreRepliesDiv: function(container) {
    if (container.innerText.indexOf('more replies') < 0) {
      return false;
    }

    const a = container.querySelector('a[href*="/status/"]');
    if (!a) {
      return false;
    }
    else {
      return true;
    }
  },

  hasReplyToPriorLine: function(divElm) {
    const style = getComputedStyle(divElm);
    // can make this more robust as needed (looking for the line that connects to prior)
    return style.width == '2px' && style.backgroundColor && style.backgroundColor.startsWith('rgb(20');  // rgb(207, 217, 222)
  },

  // look for the vertical line connecting to the prior tweet; walk the tree looking for it
  getIsReplyToPriorInStream: function(container) {
    let tweetElm = container.querySelector('article');
    let divElm = tweetElm;
    for (let i = 0; i < 10; i++) {
      divElm = divElm.firstElementChild;
      if (!divElm) { 
        return false; 
      }
      else if (TWEETPARSE.hasReplyToPriorLine(divElm) == true) {
        return true;
      }
    }

    return false;
  },

  THREADING: {
    // returns a THREAD_INFO
    getThreadInfo: function(tweetElm, parsedUrl, tweetUrlKey) {
      if (!parsedUrl.threadDetailId) {
        // on timeline stream
        return TWEETPARSE.THREADING.getStreamThreadInfo(tweetElm, tweetUrlKey);
      }
      else {
        return TWEETPARSE.THREADING.getPostPageThreadInfo(tweetElm);
      }
    },
    
    // trickier when we're not on a thread detail page
    getStreamThreadInfo: function(tweetElm, tweetUrlKey) {
      const response = {};
      let container = ES6.findUpByAttrValue(tweetElm, 'data-testid', 'cellInnerDiv');
      // look for prior sibling element
      // we'll look back far enough that we should be able to find the thread container
      // (on the main page we only expect a couple shown, let alone 5)
      if (!container) { return response; }
      let priorUrlKey;
      for (let i = 0; i < 5; i++) {
        // do we want to keep looking up a level?
        if (TWEETPARSE.isMoreRepliesDiv(container) == true) {
          // note: if we're at the "more replies" container, just go up a level
          container = container.previousSibling;
        }
        else {
          let repliesToPrior = TWEETPARSE.getIsReplyToPriorInStream(container);
          if (!repliesToPrior) {
            break;
          }
  
          container = container.previousSibling;
          if (!container || !ES6.isElementNode(container)) { break; }
          let thisTweetElm = container.querySelector('article');
          if (thisTweetElm) {
            // inside the container is a real tweet (or an ad!)
            // if we haven't yet identified the repliedTo, then this is it
            let thisUrlKey = TWEETPARSE.getTweetUrlKeyDirectly(thisTweetElm);
            if (STR.hasLen(thisUrlKey)) {
              if (!response[THREAD_INFO.replyToUrlKey]) {
                response[THREAD_INFO.replyToUrlKey] = thisUrlKey;
              }
              priorUrlKey = thisUrlKey;
            }
            // don't break yet; keep looking for threadUrlKey
          }
          else if (TWEETPARSE.isMoreRepliesDiv(container) == true) {
            // we can't assume that the reply is to this url, so replyToUrlKey is left null to be safe; 
            // we'll let it keep going (next one ought to be the thread url key btw)
          }
          else {
            break;
          }
        }
      }

      if (!STR.hasLen(response[THREAD_INFO.threadUrlKey])) {
        response[THREAD_INFO.threadUrlKey] = priorUrlKey || tweetUrlKey;
      }
      
      return response;
    },

    getPostPageThreadInfo: function(tweetElm) { 
      const response = {};
      const firstTweeet = document.querySelector('article');
      response[THREAD_INFO.threadUrlKey] = TWEETPARSE.getTweetUrlKeyDirectly(firstTweeet);
      let container = ES6.findUpByAttrValue(tweetElm, 'data-testid', 'cellInnerDiv');
      if (!container) { return response; }
      // it shouldn't take more than a few tries to get past ads or other junk
      for (let i = 0; i < 3; i++) {
        container = container.previousSibling;
        if (!container || !ES6.isElementNode(container)) { break; }
        let thisTweetElm = container.querySelector('article');
        if (thisTweetElm) {
          // inside the container is a real tweet (or an ad!)
          // if we haven't yet identified the repliedTo, then this is it
          let thisUrlKey = TWEETPARSE.getTweetUrlKeyDirectly(thisTweetElm);
          if (STR.hasLen(thisUrlKey)) {
            response[THREAD_INFO.replyToUrlKey] = thisUrlKey;
            break;
          }
          // continue if this was e.g. an ad
        }
        else if (TWEETPARSE.isMoreRepliesDiv(container) == true) {
          // we can't assume that the reply is to this url, so replyToUrlKey is left null to be safe; 
          break;
        }
        else if (!thisTweetElm || !STR.hasLen(thisTweetElm.innerText)) {
          // an empty separator div was hit; done analyzing thread
          break;
        }
      }

      return response;
    }
  }
};