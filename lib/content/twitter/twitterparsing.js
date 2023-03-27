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