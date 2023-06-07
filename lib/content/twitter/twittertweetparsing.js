/******************************************************/
// parsing a tweet
// TWITTER ThreadPost: urlKey (ux), authorHandle, postedWhen, replyToUrlKey
// TWITTER RePost: threadPostUrlKey, retweetByHandle
// Retweets: look for a[dir=ltr] with innerText ending with ' Retweeted' and where the a href is the stream owner
// Links (store delimited, MAX)
// card image... (see my VACANCY comment)
  // data-testid=card.wrapper
  // data-testid=card.layoutLarge.detail 
  // link: to.co needs resolving ... requires nitter
// author name and image (profile entity)
// OR: https://duckduckgo.com/?va=v&t=ha&q=!npr.org+how+the+far+right+tore+apart&ia=web
// which is ! npr.org how the far right tore apart
// for shortened link https://t.co/DgjnAx48se
/******************************************************/

var TWEETPARSE = {
  
  // tweetElm is article[data-testid=tweet]
  buildTweetFromElm: function(tweetElm) {

    // note: author image loads with a delay, so is handled separately via getTweetAuthorImgElms
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(tweetElm);
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm);

    const tweet = { };
    
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
    const replyToUrl = TWEETPARSE.getReplyToPostUrlKey(tweetElm);
    if (replyToUrl) {
      tweet.replyToUrlKey = replyToUrl;
    }

    const retweetedBy = TWEETPARSE.getRetweetedByHandle(tweetElm);
    if (retweetedBy) {
      tweet.retweetedBy = retweetedBy;
    }
    
    // more to come...
    return tweet;
  },

  // { handle: '@handle', cdnUrl: 'htt...'}
  buildAuthorCdnUrlPairFromElm: function(imgElm) {
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
      cdnUrl: imgElm.getAttribute('src')
    };
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

  getReplyToPostUrlKey: function(tweetElm) {
    // see if we can find the 'replying to' line
    const div = TWEETPARSE.getReplyToDiv(tweetElm);
    if (!div) { return null; }
    const a = div.querySelector('a[dir="ltr"]');
    if (!a) { return null; }
    const replyToProfileUrl = a.getAttribute('href'); // e.g. "/scafaria" if replying to scafaria
    const replyToHandle = replyToProfileUrl.replace('/', '@');
    // now go up to the container holding the tweet
    const container = ES6.findUpByAttrValue(tweetElm, 'data-testid', 'cellInnerDiv');
    // now expect to find prior sibling element
    if (!container) { return null; }
    const priorContainer = container.previousSibling;
    if (!priorContainer || priorContainer.nodeType != 1 /* element */) { return null; }
    const authorHeadlineElm = TWEETPARSE.getAuthorHeadlineElm(priorContainer);
    if (!authorHeadlineElm) { return null; }
    const authorHandle = TWEETPARSE.getAuthorHandle(authorHeadlineElm);
    if (!STR.sameText(replyToHandle, authorHandle)) { return null; }
    const timestampElm = TWEETPARSE.getTimestampElm(authorHeadlineElm);
    const urlKey = TWEETPARSE.getTweetRelativeUrl(timestampElm);
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

  getTimestampElm: function(authorHeadlineElm) {
    return authorHeadlineElm.querySelector('time');
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