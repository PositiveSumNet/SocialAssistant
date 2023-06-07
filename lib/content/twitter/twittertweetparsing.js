/******************************************************/
// parsing a tweet
// TWITTER ThreadPost: postRelativeUrl (ux), authorHandle, postIdentifier, postedWhen, replyToPostUrl
// TWITTER Retweet: threadPostUrl, retweetByHandle
// (could also store atMentions but might not be worth it)
// tweet is an <article> and
// Array.from(document.querySelectorAll('a')).filter(function(e) { return e.getAttribute('href').indexOf('/status/') > -1; });
// reveals e.g. "/scafaria/status/1665507318031630337"
// and has child <time datetime="2023-06-05T11:52:30.000Z">59m</time>
// Replies: look for authorHandle matches tweet stream owner and div[dir=ltr] with innerText "Replying to @mention1, @mention2" where prior post includes them. In that case, it's a replyTo that prior post.
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

/*
  {
    urlKey: "/scafaria/status/1665507318031630337"
  }
*/

var TWEETPARSE = {
  
  // tweetElm is article[data-testid=tweet]
  buildTweetFromElm: function(tweetElm) {
    
  },

  // the top headline of a tweet, containing author info, tweet link, and time
  getAuthorHeadlineElm: function(tweetElm) {
    return tweetElm.querySelector('div[data-testid="User-Name"]');
  },

  getTweetRelativeUrl: function(timestampElm) {
    return ES6.findUpTag(timestampElm, 'a').href;
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
    if (!STR.sameText(anchor.href, href)) { return undefined; }
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
  
  getAuthorImgCdnUrl: function(authorElm) {
    const tweetElm = ES6.findUpTag(authorElm, 'article');
    if (!tweetElm) { return undefined; }
    const imgElm = tweetElm.querySelector('div[data-testid="Tweet-User-Avatar"] img');
    if (!imgElm) { return undefined; }
    return imgElm.getAttribute('src');
  }

};