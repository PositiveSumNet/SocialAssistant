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
  }
  
};