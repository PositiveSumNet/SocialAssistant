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
// stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
const findUpTag = function(el, tag, selfCheck = true) {
  if(selfCheck === true && el && sameText(el.tagName, tag)) { return el; }
  while (el.parentNode) {
    el = el.parentNode;
    if (sameText(el.tagName, tag)) {
      return el;
    }
  }
  return null;
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

// accounts for emojis and abbreviated hyperlinks
const getUnfurledTwitterText = function(elm) {
  const es = Array.from(elm.getElementsByTagName('*'));
  const elps = '…'; // twitter ellipses
  const texts = [];
  let prior = '';
  
  for (let i=0; i < es.length; i++) {
    let e = es[i];
    let tagName = e.tagName.toLowerCase();
    let text = '';
    
    if (tagName === 'span' && !e.ariaHidden) {
      // not interested in the hidden 'https://' associated with ariaHidden
      // not interested in the ellipses
      if (e.innerText != elps) {
        text = e.innerText;
      }
    }
    else if (tagName === 'a') {
      text = e.innerText;
      
      if (prior.length > 0 && prior === text) {
        // skip this; anchor is redundant to the span that contains it
        text = '';
      }
      else {
        // the anchor text is relevant (and defaults to innerText); check for the interesting scenario of abbreviated anchor
        let nextSpan = e.nextSibling;
        if (nextSpan && nextSpan.innerText === elps) {
          // innerText is abbreviated; expect a twitter link as the only way to reliably get there
          text = `(${text}${elps} | ${e.getAttribute('href')})`;
        }
      }
    }
    else if (tagName === 'img') {
      // emojis
      text = e.getAttribute('alt');
    }
    
    if (text && text.length > 0) {
      texts.push(text);
      prior = text;
    }
  }
  
  const concat = texts.join('');
  return concat;
}