const distinctify = function(arr) {
  const set = new Set();
  for (let i = 0; i < arr.length; i++) {
    set.add(arr[i]);
  }
  return Array.from(set);
}

const _emailRexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+(@| at |\(at\))[A-Za-z0-9.-]+(\.| dot |\(dot\))[A-Za-z]{2,4})\b/g;
const extractEmails = function(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_emailRexCapture));
  const emails = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let email = match[1];   // the 1st capture group is clean (excludes the negative lookback of the match param at position 0)
    let clean = email.trim().replace(' at ', '@').replace('(at)', '@').replace(' dot ', '.').replace('(dot)', '.');
    emails.push(clean);
  }
  
  return emails;
}

// stackoverflow.com/questions/31760030/extracting-for-url-from-string-using-regex
// makeuseof.com/regular-expressions-validate-url/
const _urlRexCapture = /((https?:\/\/|www\.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/=]*))\b/g;
const extractUrls = function(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_urlRexCapture));
  const urls = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let url = match[1];
    urls.push(url);
  }
  
  return urls;
}

const standardizeMastodonAccount = function(handle, domain) {
  return `@${handle.trim().replace('@','')}@${domain.trim().replace('@','')}`;
}

const _mastodon1RexCapture = /@\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\b/g;
const extractMastodonFormat1s = function(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_mastodon1RexCapture));
  const accounts = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let handle = match[1];
    let domain = match[2];
    let account = standardizeMastodonAccount(handle, domain);
    accounts.push(account);
  }
  return accounts;
}

// toad.social/@scafaria
const _mastodon2RexCapture = /\b([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\/@([A-Za-z0-9._%+-]+)\b/g;
const extractMastodonFormat2s = function(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_mastodon2RexCapture));
  const accounts = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let domain = match[1];
    let handle = match[2];
    let account = standardizeMastodonAccount(handle, domain);
    accounts.push(account);
  }
  
  return accounts;
}

// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const _mastodon3RexCapture = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.(social|online))\b/g;
const extractMastodonFormat3s = function(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_mastodon3RexCapture));
  const accounts = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let handle = match[1];
    let domain = match[2];
    let account = standardizeMastodonAccount(handle, domain);
    accounts.push(account);
  }
  
  return accounts;
}

const extractMastodonAccounts = function(text) {
  const arr = [];
  arr.push(...extractMastodonFormat1s(text));
  arr.push(...extractMastodonFormat2s(text));
  arr.push(...extractMastodonFormat3s(text));
  return distinctify(arr);
}

// pass in e.g. display name plus description
const extractAccounts = function(texts) {
  let emails = [];
  let urls = [];
  let mdons = [];
  for (let i = 0; i < texts.length; i++) {
    let text = texts[i];
    emails.push(...extractEmails(text));
    urls.push(...extractUrls(text));
    mdons.push(...extractMastodonAccounts(text));
  }
  
  return {
    emails: distinctify(emails),
    urls: distinctify(urls),
    mdons: distinctify(mdons)
  };
}

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

const stripSuffix = function(txt, suffix) {
  if (!txt) { return txt; }
  
  if (txt.endsWith(suffix)) {
    txt = txt.substring(0, txt.length - suffix.length);
  }
  
  return txt;
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

// www.wisdomgeek.com/development/web-development/javascript/how-to-check-if-a-string-contains-emojis-in-javascript/
const _emojiRegex = /\p{Emoji}/u;
const isEmoji = function(txt) {
  if (!txt || txt.length === 0) {
    return false;
  }
  
  return _emojiRegex.test(txt);
}

const getDepthFirstTree = function(elem, elems = null) {
  elems = elems ?? [];
  elems.push(elem);
  
  for (let i = 0; i < elem.childNodes.length; i++) {
    let child = elem.childNodes[i];
    getDepthFirstTree(child, elems);
  }
  
  return elems;
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