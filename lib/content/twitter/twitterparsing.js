/******************************************************/
// parsing twitter (general) - not specific to follows
/******************************************************/
var TPARSE = {
  
  PROFILE_IMAGES_HINT: 'profile_images/',
  
  getTwitterMainColumn: function(warn) {
    const elms = document.querySelectorAll('div[data-testid="primaryColumn"]');
    
    if (elms && elms.length === 1) {
      return elms[0];
    }
    else {
      if (warn === true) {
        console.warn('Cannot find twitter main column; page structure may have changed.');
      }
    }
  },

  isThrottled: function() {
    const elm = TPARSE.getThrottledRetryElem();
    return elm != undefined && elm != null;
  },

  // when throttled, a button labeled 'Retry' appears beneath the text 'Something went wrong. Try reloading.'
  getThrottledRetryElem: function() {
    const col = TPARSE.getTwitterMainColumn();
    if (!col) { return undefined; }
    const cells = col.querySelectorAll('div[data-testid="cellInnerDiv"]');
    if (!cells || cells.length === 0) { return undefined; }
    const lastCell = cells[cells.length-1];
    if (lastCell.innerText && lastCell.innerText.startsWith('Something went wrong. Try reloading.')) {
      const btn = lastCell.querySelector('div[role="button"]');
      if (btn && btn.innerText === 'Retry') {
        return btn;
      }
      else {
        return undefined;
      }
    }
    else {
      return undefined;
    }
  },

  getTwitterProfilePhotos: function(scopeElem) {
    if (TPARSE.isTwitterProfilePhoto(scopeElem)) {
      return [scopeElem];
    }
    else {
      // all img elms with src that starts with the tell-tale prefix
      return Array.from(scopeElem.querySelectorAll(`img[src*="${TPARSE.PROFILE_IMAGES_HINT}"]`));
    }
  },

  isTwitterProfilePhoto: function(elm) {
    const isPhoto = elm && STR.sameText(elm.tagName, 'img') && elm.getAttribute('src').includes(TPARSE.PROFILE_IMAGES_HINT);
    return isPhoto;
  },

  twitterHandleFromProfileUrl: function(url) {
    let trimmed = url.startsWith('/') ? url.substring(1) : url;
    
    if (!trimmed.startsWith('@')) {
      trimmed = '@' + trimmed;
    }
    
    return trimmed;
  },

  getTweetElms: function(scopeElem) {
    if (TPARSE.isTweetElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      // all img elms with src that starts with the tell-tale prefix
      return Array.from(scopeElem.querySelectorAll('article[data-testid="tweet"]'));
    }
  },

  isTweetElm: function(elm) {
    const isTweet = elm && STR.sameText(elm.tagName, 'article') && STR.sameText(elm.getAttribute('data-testid'), 'tweet');
    return isTweet;
  },

  getTweetCardImgElms: function(scopeElem) {
    if (TPARSE.isTweetCardImgElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      return Array.from(scopeElem.querySelectorAll('div[data-testid="card.wrapper"] img'));
    }
  },

  isTweetCardImgElm: function(elm) {
    const isImg = elm && STR.sameText(elm.tagName, 'img');
    if (!isImg) { return false; }
    const parent = ES6.findUpByAttrValue(elm, 'data-testid', 'card.wrapper');
    const isValid = (isImg == true && parent);
    return isValid;
  },

  // when there's only a placeholder (ugly) svg instead of a real img
  getTweetCardSvgElms: function(scopeElem) {
    if (TPARSE.isTweetCardSvgElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      return Array.from(scopeElem.querySelectorAll('div[data-testid="card.wrapper"] svg'));
    }
  },

  isTweetCardSvgElm: function(elm) {
    const isSvg = elm && STR.sameText(elm.tagName, 'svb');
    if (!isSvg) { return false; }
    const parent = ES6.findUpByAttrValue(elm, 'data-testid', 'card.wrapper');
    const isValid = (isImg == true && parent);
    return isValid;
  },

  getTweetPostImgElms: function(scopeElem) {
    if (TPARSE.isTweetPostImgElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      return Array.from(scopeElem.querySelectorAll('div[data-testid="tweetPhoto"] img')).filter(function(img) { 
        // handle video thumbnails separately
        return img.src.indexOf('video_thumb') < 0;
      });
    }
  },

  isTweetPostImgElm: function(elm) {
    const isImg = elm && STR.sameText(elm.tagName, 'img');
    if (!isImg) { return false; }
    const parent = ES6.findUpByAttrValue(elm, 'data-testid', 'tweetPhoto');
    const isValid = (isImg == true && parent && elm.src.indexOf('video_thumb') < 0);
    return isValid;
  },

  getTweetPostEmbeddedVideoElms: function(scopeElem) {
    if (TPARSE.isTweetPostEmbeddedVideoElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      return Array.from(scopeElem.querySelectorAll('div[data-testid="tweetPhoto"] video'));
    }
  },

  isTweetPostEmbeddedVideoElm: function(elm) {
    const isVideo = elm && STR.sameText(elm.tagName, 'video');
    if (!isVideo) { return false; }
    const parent = ES6.findUpByAttrValue(elm, 'data-testid', 'tweetPhoto');
    const isValid = (isVideo == true && parent);
    return isValid;
  },

  getTweetAuthorImgElms: function(scopeElem) {
    if (TPARSE.isTweetAuthorImgElm(scopeElem)) {
      return [scopeElem];
    }
    else {
      return Array.from(scopeElem.querySelectorAll('div[data-testid="Tweet-User-Avatar"] img'));
    }
  },

  isTweetAuthorImgElm: function(elm) {
    const isImg = elm && STR.sameText(elm.tagName, 'img');
    if (!isImg) { return false; }
    const avatarParent = ES6.findUpByAttrValue(elm, 'data-testid', 'Tweet-User-Avatar');
    const isValid = (isImg == true && avatarParent);
    return isValid;
  }
  
};