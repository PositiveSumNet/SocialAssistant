var TWEETPARSE = {
  
  getTweetElms: function(scopeElem) {
    if (TPARSE.isTweetElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      // all img elms with src that starts with the tell-tale prefix
      return Array.from(scopeElem.querySelectorAll('article[data-testid="tweet"]'));
    }
  },

  // get all at once, instead of requiring caller to obtain the author and timestamp
  getTweetUrlKeyDirectly: function(tweetElm) {
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(tweetElm);
    if (!authorHeadlineElm) { return null; }
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm, tweetElm);
    if (!timestampElm) { return null; } // happens with ads
    return TWEETPARSE.getTweetRelativeUrl(timestampElm, tweetElm);
  },

  attachStat: function(tweet, parts, clue, prop) {
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      let pieces = part.split(' ');
      if (pieces.length == 2 && pieces[1] == clue) {
        let intVal = parseInt(pieces[0]);
        if (!isNaN(intVal)) {
          tweet[prop] = intVal;
        }
        return; // done
      }
    }
  },

  attachStats: function(tweet, tweetElm) {
    // 21 replies, 395 reposts, 795 likes, 1 bookmark, 12071 views
    const statElm = tweetElm.querySelector('div[aria-label*=" views"]');
    if (!statElm) { return; }
    const statText = statElm.getAttribute('aria-label');
    if (!STR.hasLen(statText)) { return; }
    const parts = statText.split(', ');
    TWEETPARSE.attachStat(tweet, parts, 'replies', SAVABLE_TWEET_ATTR.replyCount);
    TWEETPARSE.attachStat(tweet, parts, 'likes', SAVABLE_TWEET_ATTR.likeCount);
    TWEETPARSE.attachStat(tweet, parts, 'reposts', SAVABLE_TWEET_ATTR.reshareCount);
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

    const quoted = TWEETPARSE.getQuotedTweet(tweetElm, parsedUrl, tweet.urlKey);
    if (quoted) {
      tweet.quoteTweet = quoted;
    }
    
    // we aren't planning to go from a thread conversation detail page into deeper rabbit-holes
    // note that bookmarked posts are deemed important and we'll want to double-check for rest of thread
    if (!parsedUrl.threadDetailId) {
      tweet.hasMore = threadInfo[THREAD_INFO.unfurlRequired] || parsedUrl.bookmarked == true || TWEETPARSE.getThreadHasMore(tweetElm, postText, tweet.urlKey);
    }

    TWEETPARSE.attachStats(tweet, tweetElm);

    return tweet;
  },

  getQuotedTweet: function(tweetElm, parsedUrl, parentUrlKey) {
    // look for telltale sign of quote-tweet child
    const candidates = Array.from(tweetElm.querySelectorAll('div[dir="ltr"]'));
    let qtElm = null;
    for (let i = 0; i < candidates.length; i++) {
      let candidate = candidates[i];
      if (candidate.innerText == 'Quote') {
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

    // might be not found in the case of a quote tweet!
    urlKey = TWEETPARSE.getPostUrlKeyForQuoteTweet(qtElm);
    if (urlKey && urlKey.length > 0) {
      qt.urlKey = urlKey;
    }
    else {
      qt.urlKey = URLPARSE.buildVirtualQuoteUrlKey(parentUrlKey);
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
    else if (STR.looksLikePartOfThread(tweetText) == true) {
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
    while (el.parentNode) {
      el = el.parentNode;
      if (ES6.isElementNode(el)) {
        if (STR.sameText(el.tagName, 'article') && STR.sameText(el.getAttribute('data-testid'), 'tweet')) {
          // a regular tweet
          return {
            elm: el,
            quoted: false
          }
        }
        else if (el.getAttribute('tabindex', '0') && el.previousSibling && ES6.isElementNode(el.previousSibling) && el.previousSibling.innerText == 'Quote') {
          // a quote tweet
          return {
            elm: el,
            quoted: true
          }
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
        return STR.cleanTweetUrlKey(href);
      }
    }

    // sometimes the quote tweet lacks its own urlKey; fall-back instead to a virtual urlKey
    const parentTweetElm = ES6.findUpTag(qtTweetElm, 'article');
    const parentUrlKey = TWEETPARSE.getTweetUrlKeyDirectly(parentTweetElm);
    return URLPARSE.buildVirtualQuoteUrlKey(parentUrlKey);
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

  extractCardText: function(cardAnchor) {
    let text = cardAnchor.getAttribute('aria-label');
    if (!STR.hasLen(text)) {
      text = cardAnchor.innerText;
    }
    return text;
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
    card.cardText = (anchor) ? TWEETPARSE.extractCardText(anchor) : container.innerText;
    card.urlKey = postUrlKey;
    return card;
  },

  // TWEET_POST_IMG_ATTR
  // { urlKey: '/scafaria/status/123', imgCdnUrl: 'htt...' }
  buildTweetPostImgInfo: function(imgElm) {
    const imgCdnUrl = imgElm.getAttribute('src');
    const postUrlKey = TWEETPARSE.getPostUrlKeyFromChildElm(imgElm);
    if (!postUrlKey) { return null; }

    return {
      urlKey: postUrlKey,
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
      urlKey: postUrlKey,
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
      if (txt && txt.toLowerCase().endsWith('reposted')) {
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
    let href = anchor.getAttribute('href');
    href = (href.toLowerCase().indexOf('status') < 0) ? undefined : href;
    href = STR.cleanTweetUrlKey(href);
    return href;
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
      // the extra check for sitting within an anchor is to avoid grabbing the time element for a quote-tweet
      timeElm = parentTweetElm.querySelector('a[href*="/status/"] time');
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
        return TWEETPARSE.THREADING.getStreamThreadInfo(tweetElm, parsedUrl, tweetUrlKey);
      }
      else {
        return TWEETPARSE.THREADING.getPostPageThreadInfo(tweetElm);
      }
    },
    
    // trickier when we're not on a thread detail page
    getStreamThreadInfo: function(tweetElm, parsedUrl, tweetUrlKey) {
      const response = {};
      let container = ES6.findUpByAttrValue(tweetElm, 'data-testid', 'cellInnerDiv');
      let replyToUrlKey;
      let priorUrlKey = tweetUrlKey;
      let threadUrlKey;
      let hitMoreRepliesDiv = false;
      let repliesToPrior = TWEETPARSE.getIsReplyToPriorInStream(container);

      if (repliesToPrior) {
        // we'll look back far enough that we should be able to find the thread container
        // (on the main page we only expect a couple shown, let alone 5)
        for (let i = 0; i < 5; i++) {
          container = container.previousSibling;
          if (!container || !ES6.isElementNode(container)) { 
            break; 
          }
          if (TWEETPARSE.isMoreRepliesDiv(container) == true) {
            hitMoreRepliesDiv = true;
          }
          else {
            let thisTweetElm = container.querySelector('article');
            let thisUrlKey;
            if (thisTweetElm) {
              // inside the container is a real tweet (or an ad!)
              thisUrlKey = TWEETPARSE.getTweetUrlKeyDirectly(thisTweetElm);
              // does this tweet reply to one that is above it? (if not, we're done)
              repliesToPrior = TWEETPARSE.getIsReplyToPriorInStream(container);
              if (STR.hasLen(thisUrlKey)) {
                // ok, it's a legit tweet (and we haven't been thrown off by a more-replies div)
                if (!hitMoreRepliesDiv && !STR.hasLen(replyToUrlKey)) {
                  replyToUrlKey = thisUrlKey;
                }
                if (repliesToPrior == false) {
                  threadUrlKey = thisUrlKey;
                  break;
                }
              }
              else {
                // happens with an ad; just continue...
              }
            }
            else {
              if (!STR.hasLen(threadUrlKey)) {
                threadUrlKey = priorUrlKey;
              }
              break;
            }
            if (thisUrlKey) {
              priorUrlKey = thisUrlKey;
            }
          }
        }
      }

      if (!STR.hasLen(threadUrlKey)) {
        // fallback to the tweet url *unless* this is the 'home' (or search) context, in which case we lack
        // sufficient context to be sure
        if (parsedUrl.originalPageType != PAGETYPE.TWITTER.HOME && parsedUrl.originalPageType != PAGETYPE.TWITTER.SEARCH) {
          threadUrlKey = tweetUrlKey;
        }
      }

      if (STR.hasLen(threadUrlKey)) {
        response[THREAD_INFO.threadUrlKey] = threadUrlKey;
      }
      if (STR.hasLen(replyToUrlKey)) {
        response[THREAD_INFO.replyToUrlKey] = replyToUrlKey;
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