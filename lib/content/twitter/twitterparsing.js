/******************************************************/
// parsing twitter (general) - not specific to follows
/******************************************************/

const _twitterProfileImgSrcHint = 'profile_images/';

function getTwitterMainColumn(warn) {
  const elms = document.querySelectorAll('div[data-testid="primaryColumn"]');
  
  if (elms && elms.length === 1) {
    return elms[0];
  }
  else {
    if (warn === true) {
      console.warn('Cannot find twitter main column; page structure may have changed.');
    }
  }
}

 function isTwitterProfilePhoto(elm) {
  const isPhoto = elm && sameText(elm.tagName, 'img') && elm.getAttribute('src').includes(_twitterProfileImgSrcHint);
  return isPhoto;
}

function twitterHandleFromProfileUrl(url) {
  let trimmed = url.startsWith('/') ? url.substring(1) : url;
  
  if (!trimmed.startsWith('@')) {
    trimmed = '@' + trimmed;
  }
  
  return trimmed;
}

