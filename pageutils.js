const getParsedUrl = function() {
  return parseUrl(window.location.href);
}

const parseUrl = function(url) {

  var pageType;
  var site;
  
  if (url && url.replace("mobile.", "").startsWith('https://twitter.com/')) {
    if (url.endsWith('/following')) {
      pageType = 'followingOnTwitter';
      site = 'twitter';
    }
    else if (url.endsWith('/followers')) { 
      pageType = 'followersOnTwitter';
      site = 'twitter';
    }
  }
  
  if (pageType == 'followingOnTwitter' || pageType == 'followersOnTwitter') {
    const urlParts = url.split('/');
    const owner = urlParts[urlParts.length - 2];
    
    return {
      pageType: pageType,
      site: site,
      owner: owner
    };
  }
  else {
    return null;
  }
}

// from an element within a twitter profile list item, navigate up to the parent 'UserCell'
const findUpTwitterUserCell = function(el) {
  while (el.parentNode) {
    el = el.parentNode;
    let role = el.getAttribute('data-testid');
    if (role === 'UserCell') {
      return el;
    }
  }
  return null;
}

const findTwitterDescriptionWithinUserCell = function(cell) {
  const div = cell.lastElementChild.lastElementChild.lastElementChild;
  const dirAttr = div.getAttribute('dir');
  
  if (dirAttr === 'auto') {
    return div;
  }
  else {
    return null;
  }
}

// accounts for emojis
const getUnfurledText = function(elem) {
  let elems = getDepthFirstTree(elem);
  
  const elps = '…'; // twitter ellipses
  let concat = '';
  
  for (let i = 0; i < elems.length; i++) {
    let e = elems[i];
    let txt = '';
    if (e.tagName && e.tagName.toLowerCase() === 'img') {
      let altAttr = e.getAttribute('alt');  // possible emoji
      if (isEmoji(altAttr)) {
        txt = altAttr;
      }
    }
    else if (e.nodeType == 3 && e.data && e.data != elps) {
      // text node
      txt = e.data;
    }
    
    concat = `${concat}${txt}`;
  }

  return concat;
}