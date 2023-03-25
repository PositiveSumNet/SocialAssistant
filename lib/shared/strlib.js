function stripSuffix(txt, suffix) {
  if (!txt) { return txt; }
  
  if (txt.endsWith(suffix)) {
    txt = txt.substring(0, txt.length - suffix.length);
  }
  
  return txt;
}

function stripSuffixes(txt, suffixes) {
  if (!txt) { return txt; }
  
  for (let i = 0; i < suffixes.length; i++) {
    let suffix = suffixes[i];
    txt = stripSuffix(txt, suffix);
  }
  
  return txt;
}

function sameText(a, b, insensitive = true) {
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

function looksLikeMastodonAccountUrl(url) {
  if (!url) { return false; }
  url = stripSuffixes(url, ['/']); // trim ending slash before evaluating
  
  // well-knownurls that are not mastodon but use same profile syntax
  const imposters = ['post.news/@'];
  for (let i = 0; i < imposters.length; i++) {
    let imposter = imposters[i];
    if (url.toLowerCase().includes(imposter)) {
      return false;
    }
  }

  const parts = url.split('/');
  if (parts.length === 0) { return false; }
  const last = parts[parts.length-1];
  return last.startsWith('@');
}

function stripHttpWwwPrefix(url) {
  if (!url) { return url; }
  return url.replace('https://','').replace('http://','').replace('www.','');
}

function couldBeMastodonServer(url) {
  if (!url) { return false; }
  url = stripSuffixes(url, ['/']); // trim ending slash before evaluating
  url = stripHttpWwwPrefix(url);
  const slashParts = url.split('/');
  if (slashParts.length > 1) { return false; }  // there's more attached
  const dotParts = url.split('.');
  return dotParts.length === 2;  // toad.social
}

const _emailRexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+(@| at |\(at\))[A-Za-z0-9.-]+(\.| dot |\(dot\))[A-Za-z]{2,4})\b/g;
function extractEmails(text) {
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

// simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
const _urlRexCapture = /http[s]?:\/\/[^\s]+/g;
function extractUrls(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_urlRexCapture));
  const urls = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let url = match[0];
    url = stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
    if (!looksLikeMastodonAccountUrl(url)) {
      urls.push(url);
    }
  }
  
  return urls.filter(function(u) { return u && u.length > 0; });
}

function standardizeMastodonAccount(handle, domain) {
  return `@${handle.trim().replace('@','')}@${domain.trim().replace('@','')}`;
}

const _mastodon1RexCapture = /(?:^|\s|\()@([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\b/g;
function extractMastodonFormat1s(text) {
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
const _mastodon2RexCapture = /(?:^|\s|\()(https?:\/\/)?(www\.)?([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\/@([A-Za-z0-9._%+-]+)\b/g;
function extractMastodonFormat2s(text) {
  if (!text) { return []; }
  
  const matches = Array.from(text.matchAll(_mastodon2RexCapture));
  const accounts = [];
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i];
    let domain = match[3];  // note: the 1 slot is http, the 2 slot is 222, then comes domain at 3 and handle at 4
    let handle = match[4];
    let account = standardizeMastodonAccount(handle, domain);
    accounts.push(account);
  }
  
  return accounts;
}

// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const _mastodon3RexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.(social|online))\b/g;
function extractMastodonFormat3s(text) {
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

function extractMastodonAccounts(text) {
  const arr = [];
  arr.push(...extractMastodonFormat1s(text));
  arr.push(...extractMastodonFormat2s(text));
  arr.push(...extractMastodonFormat3s(text));
  return distinctify(arr);
}

// pass in e.g. display name plus description
function extractAccounts(texts) {
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

function inferImageFileExt(url) {
  if (!url) {
    return 'png';
  }
  else if (url.endsWith('.jpg')) {
    return 'jpg';
  }
  else if (url.endsWith('.jpeg')) {
    return 'jpeg';
  }
  else if (url.endsWith('.gif')) {
    return 'gif';
  }
  else {
    return 'png';
  }
}

