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

var TWEETPARSE = {

  /*
    {
      
    }
  */
  buildTweetFromElm: function(elm) {
    // const imgSrc = img.getAttribute('src');
    // const imgAnchor = ES6.findUpTag(img, 'a', false);
    // const profileUrl = imgAnchor.getAttribute('href');
    // const atHandle = TPARSE.twitterHandleFromProfileUrl(profileUrl); 
    // const userCell = TFOLLOWPARSE.findUpTwitterUserCell(img);
    // // one is handle, one is description
    
    // const textAnchors = Array.from(userCell.getElementsByTagName('a')).filter(function(a) { return a != imgAnchor; });
    
    // const displayNameAnchor = textAnchors.find(function(a) { 
    //   return a.innerText && a.innerText.length > 0 && 
    //           a.innerText.toLowerCase() != atHandle.toLowerCase(); 
    // });
    
    // const displayName = ES6.getUnfurledText(displayNameAnchor);
    // const description = TFOLLOWPARSE.getTwitterProfileDescription(displayNameAnchor);
    
    // // include the @ symbol
    // // see connsaver.js or constants.js PERSON_ATTR for Person schema
    // const tweet = {
    //   handle: atHandle,
    //   displayName: displayName,
    //   description: description,
    //   pageType: parsedUrl.pageType,
    //   owner: STR.ensurePrefix(parsedUrl.owner, '@'),
    //   imgCdnUrl: imgSrc
    // };
    
    // person.accounts = STR.extractAccounts([person.displayName, person.description]);
    // return person;
  }

};