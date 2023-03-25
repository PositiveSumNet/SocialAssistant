const _emailRexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+(@| at |\(at\))[A-Za-z0-9.-]+(\.| dot |\(dot\))[A-Za-z]{2,4})\b/g;
const _urlRexCapture = /http[s]?:\/\/[^\s]+/g;
// @scafaria@toad.social
const _mastodon1RexCapture = /(?:^|\s|\()@([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\b/g;
// toad.social/@scafaria
const _mastodon2RexCapture = /(?:^|\s|\()(https?:\/\/)?(www\.)?([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\/@([A-Za-z0-9._%+-]+)\b/g;
// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const _mastodon3RexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.(social|online))\b/g;

var STR = {
  
  stripSuffix: function(txt, suffix) {
    if (!txt) { return txt; }
    
    if (txt.endsWith(suffix)) {
      txt = txt.substring(0, txt.length - suffix.length);
    }
    
    return txt;
  },

  stripSuffixes: function(txt, suffixes) {
    if (!txt) { return txt; }
    
    for (let i = 0; i < suffixes.length; i++) {
      let suffix = suffixes[i];
      txt = STR.stripSuffix(txt, suffix);
    }
    
    return txt;
  },
  
  sameText: function(a, b, insensitive = true) {
    if (a === b) {
      return true;
    }
    
    if (insensitive && a && b) {
      return a.toLowerCase() === b.toLowerCase();
    }
    else {
      return false;
    }
  },
  
  looksLikeMastodonAccountUrl: function(url) {
    if (!url) { return false; }
    url = STR.stripSuffixes(url, ['/']); // trim ending slash before evaluating
    
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
  },

  stripHttpWwwPrefix: function(url) {
    if (!url) { return url; }
    return url.replace('https://','').replace('http://','').replace('www.','');
  },

  couldBeMastodonServer: function(url) {
    if (!url) { return false; }
    url = STR.stripSuffixes(url, ['/']); // trim ending slash before evaluating
    url = STR.stripHttpWwwPrefix(url);
    const slashParts = url.split('/');
    if (slashParts.length > 1) { return false; }  // there's more attached
    const dotParts = url.split('.');
    return dotParts.length === 2;  // toad.social
  },

  extractEmails: function(text) {
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
  },

  extractUrls: function(text) {
    // simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
    
    if (!text) { return []; }
    
    const matches = Array.from(text.matchAll(_urlRexCapture));
    const urls = [];
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      let url = match[0];
      url = STR.stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
      if (!STR.looksLikeMastodonAccountUrl(url)) {
        urls.push(url);
      }
    }
    
    return urls.filter(function(u) { return u && u.length > 0; });
  },
  
  standardizeMastodonAccount: function(handle, domain) {
    return `@${handle.trim().replace('@','')}@${domain.trim().replace('@','')}`;
  },
  
  extractMastodonFormat1s: function(text) {
    if (!text) { return []; }
    
    const matches = Array.from(text.matchAll(_mastodon1RexCapture));
    const accounts = [];
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      let handle = match[1];
      let domain = match[2];
      let account = STR.standardizeMastodonAccount(handle, domain);
      accounts.push(account);
    }
    return accounts;
  },
  
  extractMastodonFormat2s: function(text) {
    if (!text) { return []; }
    
    const matches = Array.from(text.matchAll(_mastodon2RexCapture));
    const accounts = [];
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      let domain = match[3];  // note: the 1 slot is http, the 2 slot is 222, then comes domain at 3 and handle at 4
      let handle = match[4];
      let account = STR.standardizeMastodonAccount(handle, domain);
      accounts.push(account);
    }
    
    return accounts;
  },
  
  extractMastodonFormat3s: function(text) {
    if (!text) { return []; }
    
    const matches = Array.from(text.matchAll(_mastodon3RexCapture));
    const accounts = [];
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      let handle = match[1];
      let domain = match[2];
      let account = STR.standardizeMastodonAccount(handle, domain);
      accounts.push(account);
    }
    
    return accounts;
  },

  extractMastodonAccounts: function(text) {
    const arr = [];
    arr.push(...STR.extractMastodonFormat1s(text));
    arr.push(...STR.extractMastodonFormat2s(text));
    arr.push(...STR.extractMastodonFormat3s(text));
    return ES6.distinctify(arr);
  },

  // pass in e.g. display name plus description
  extractAccounts: function(texts) {
    let emails = [];
    let urls = [];
    let mdons = [];
    for (let i = 0; i < texts.length; i++) {
      let text = texts[i];
      emails.push(...STR.extractEmails(text));
      urls.push(...STR.extractUrls(text));
      mdons.push(...STR.extractMastodonAccounts(text));
    }
    
    return {
      emails: ES6.distinctify(emails),
      urls: ES6.distinctify(urls),
      mdons: ES6.distinctify(mdons)
    };
  },

  inferImageFileExt: function(url) {
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
}
