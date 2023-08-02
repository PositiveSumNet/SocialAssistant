var NITTER_PROFILE_PARSER = {
  parseToTempStorage: function() {
    const parsedUrl = RECORDING.getParsedUrl();
    if (parsedUrl.pageType != PAGETYPE.TWITTER.PROFILE) { return; }
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

    const followingCountElm = document.body.querySelector('ul.profile-statlist>li.following>span.profile-stat-num');
    const followersCountElm = document.body.querySelector('ul.profile-statlist>li.followers>span.profile-stat-num');

    if (followingCountElm) {
      const fcnt = ES6.getElementTextAsInt(followingCountElm);
      if (fcnt > 0) {
        person.followingCount = fcnt;
      }
    }
    if (followersCountElm) {
      const fcnt = ES6.getElementTextAsInt(followersCountElm);
      if (fcnt > 0) {
        person.followersCount = fcnt;
      }
    }

    person.accounts = STR.extractAccounts([person.displayName, person.description]);

    const savables = [];
    // not focused on photos
    person.skipImg64 = true;
    savables.push(person);

    console.log('Scraped to save: ' + atHandle);

    chrome.runtime.sendMessage(
    {
      // caches to temp storage
      actionType: MSGTYPE.TOBACKGROUND.SAVE,
      payload: savables
    }, 
    function(response) {
      if (_isBackgroundRecordingUrl == true) {
        BGFETCH_REQUEST.onCompleteBgScrape();
      }
    });
  }
};