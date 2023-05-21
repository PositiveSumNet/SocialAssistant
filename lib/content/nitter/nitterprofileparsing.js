var NITTER_PROFILE_PARSER = {
  parseToTempStorage: function() {
    const parsedUrl = URLPARSE.getParsedUrl();
    if (parsedUrl.pageType != PAGETYPE.NITTER.PROFILE) { return; }
    const atHandle = STR.ensurePrefix(parsedUrl.owner, '@');
    const descriptionElm = document.head.querySelector('meta[property="og:description"]');
    const displayNameElm = document.head.querySelector('meta[property="og:title"]');
    const imgSrcElm = document.head.querySelector('meta[property="twitter:image:src"]');
    
    const description = descriptionElm ? descriptionElm.content : undefined;
    const displayName = displayNameElm ? displayNameElm.content : undefined;
    const imgCdnUrl = imgSrcElm ? imgSrcElm.content : undefined;

    // see connsaver.js or constants.js PERSON_ATTR for Person schema
    const person = {
      handle: atHandle,
      displayName: displayName,
      description: description,
      pageType: parsedUrl.pageType,
      imgCdnUrl: imgCdnUrl
    };

    const savables = [];
    savables.push(person);

    chrome.runtime.sendMessage(
    {
      actionType: MSGTYPE.TOBACKGROUND.SAVE,
      payload: savables
    }, 
    function(response) {
      console.log('saved to cache!');
      console.log(response);
    });
  }
};