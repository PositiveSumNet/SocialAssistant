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

const sameText = function(a, b, insensitive = true) {
  if (a === b) {
    return true;
  }
  
  if (insensitive && a && b) {
    return a.toLowerCase() === b.toLowerCase();
  }
  else {
    return false;
  }
}

const buildLinkedImg = function(img) {
  if (!img) return;
  const a = findUpTag(img, 'a');
  if (!a) return;
  const href = a.getAttribute('href');
  const imgSrc = img.getAttribute('src');
  if (!href || !imgSrc) return;
  return {href: href, imgSrc: imgSrc};
}

// stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
const findUpTag = function(el, tag) {
  while (el.parentNode) {
    el = el.parentNode;
    if (sameText(el.tagName, tag)) {
      return el;
    }
  }
  return null;
}
