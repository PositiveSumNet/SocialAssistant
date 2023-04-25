var STR = {
  
  nowIso: function(epochMs) {
    const dt = epochMs ? new Date(epochMs) : new Date(Date.now());
    return dt.toISOString();
  },

  isValidIsoDate: function(dt) {
    return dt && REGEX_ISODATE.test(dt);
  },

  appendSpaced: function(txt, appendThis) {
    if (!appendThis) { return txt; }
    return `${txt} ${appendThis}`;
  },
  
  ensurePrefix: function(txt, prefix, insensitive = true) {
    if (!txt || txt.length == 0) { return txt; }
    
    const hit = insensitive ? txt.toLowerCase().startsWith(prefix.toLowerCase()) : txt.startsWith(prefix);
    if (!hit) {
      txt = `${prefix}${txt}`;
    }
    
    return txt;
  },
  
  ensureSuffix: function(txt, suffix, insensitive = true) {
    if (!txt || txt.length == 0) { return txt; }
    
    const hit = insensitive ? txt.toLowerCase().endsWith(suffix.toLowerCase()) : txt.endsWith(suffix);
    if (!hit) {
      txt = `${txt}${suffix}`;
    }
    
    return txt;
  },
  
  stripPrefix: function(txt, prefix, insensitive = true) {
    if (!txt || txt.length == 0) { return txt; }
    
    const hit = insensitive ? txt.toLowerCase().startsWith(prefix.toLowerCase()) : txt.startsWith(prefix);
    if (hit) {
      txt = txt.substring(1);
    }
    
    return txt;
  },
  
  stripSuffix: function(txt, suffix, insensitive = true) {
    if (!txt || txt.length == 0) { return txt; }
    
    const hit = insensitive ? txt.toLowerCase().endsWith(suffix.toLowerCase()) : txt.endsWith(suffix);
    if (hit) {
      txt = txt.substring(0, txt.length - suffix.length);
    }
    
    return txt;
  },

  stripSuffixes: function(txt, suffixes, insensitive = true) {
    if (!txt || txt.length == 0) { return txt; }
    
    for (let i = 0; i < suffixes.length; i++) {
      let suffix = suffixes[i];
      txt = STR.stripSuffix(txt, suffix, insensitive);
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

  stripHttpWwwPrefix: function(url) {
    if (!url) { return url; }
    return url.replace('https://','').replace('http://','').replace('www.','');
  },

  extractEmails: function(text) {
    if (!text) { return []; }
    
    const matches = Array.from(text.matchAll(REGEX_EMAIL));
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
    
    const matches = Array.from(text.matchAll(REGEX_URL));
    const urls = [];
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      let url = match[0];
      url = STR.stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
      if (!STR.MASTODON.looksLikeAccountUrl(url)) {
        urls.push(url);
      }
    }
    
    return urls.filter(function(u) { return u && u.length > 0; });
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
      mdons.push(...STR.MASTODON.extractAccounts(text));
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
  },
  
  makeProfileUrl: function(fullHandle, site) {
    switch(site) {
      case SITE.MASTODON:
        return STR.MASTODON.makeProfileUrl(fullHandle);
      
      case SITE.TWITTER:
        fullHandle = STR.stripPrefix(fullHandle, '@');
        return `https://${site}/${fullHandle}`;

      default:
        return `https://${site}/${fullHandle}`;
    }
  },

  MASTODON: {
    accountFromProfileUrl: function(url) {
      if (!url) { return undefined; };
      if (url.length === 0) { return ''; }
  
      const splitUrl = STR.MASTODON.splitUrl(url);
      const fullHandle = STR.MASTODON.standardizeAccount(splitUrl.handleOnly, splitUrl.server);
      return fullHandle;
    },
  
    makeProfileUrl: function(fullHandle) {
      const parts = STR.stripPrefix(fullHandle, '@').split('@');
      server = STR.ensurePrefix(parts[1], 'https://');
      fullHandle = STR.ensurePrefix(parts[0], '@');
      return `${server}/${fullHandle}`;
    },
  
    splitUrl: function(url) {
      const urlParts = url.split('@');
      // "https://mastodon.social/@spreadmastodon" ==> 'mastodon.social' and 'spreadmastodon'
      const server = STR.stripSuffix(STR.stripHttpWwwPrefix(urlParts[0]),'/');
      const handleOnly = STR.ensurePrefix(urlParts[1], '@');
      return {server: server, handleOnly: handleOnly};
    },
  
    looksLikeAccountUrl: function(url) {
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
  
    couldBeServer: function(url) {
      if (!url) { return false; }
      url = STR.stripSuffixes(url, ['/']); // trim ending slash before evaluating
      url = STR.stripHttpWwwPrefix(url);
      const slashParts = url.split('/');
      if (slashParts.length > 1) { return false; }  // there's more attached
      const dotParts = url.split('.');
      return dotParts.length === 2;  // toad.social
    },
    
    standardizeAccount: function(handle, domain) {
      return `@${handle.trim().replace('@','')}@${domain.trim().replace('@','')}`;
    },
    
    extractFormat1s: function(text) {
      if (!text) { return []; }
      
      const matches = Array.from(text.matchAll(REGEX_MDON1));
      const accounts = [];
      for (let i = 0; i < matches.length; i++) {
        let match = matches[i];
        let handle = match[1];
        let domain = match[2];
        let account = STR.MASTODON.standardizeAccount(handle, domain);
        accounts.push(account);
      }
      return accounts;
    },
    
    extractFormat2s: function(text) {
      if (!text) { return []; }
      
      const matches = Array.from(text.matchAll(REGEX_MDON2));
      const accounts = [];
      for (let i = 0; i < matches.length; i++) {
        let match = matches[i];
        let domain = match[3];  // note: the 1 slot is http, the 2 slot is 222, then comes domain at 3 and handle at 4
        let handle = match[4];
        let account = STR.MASTODON.standardizeAccount(handle, domain);
        accounts.push(account);
      }
      
      return accounts;
    },
    
    extractFormat3s: function(text) {
      if (!text) { return []; }
      
      const matches = Array.from(text.matchAll(REGEX_MDON3));
      const accounts = [];
      for (let i = 0; i < matches.length; i++) {
        let match = matches[i];
        let handle = match[1];
        let domain = match[2];
        let account = STR.MASTODON.standardizeAccount(handle, domain);
        accounts.push(account);
      }
      
      return accounts;
    },
  
    extractAccounts: function(text) {
      const arr = [];
      arr.push(...STR.MASTODON.extractFormat1s(text));
      arr.push(...STR.MASTODON.extractFormat2s(text));
      arr.push(...STR.MASTODON.extractFormat3s(text));
      return ES6.distinctify(arr);
    },

    // sample: <https://toad.social/api/v1/accounts/123/following?limit=80&max_id=2900>; rel="next", <https://toad.social/api/v1/accounts/123/following?limit=80&since_id=3000>; rel="prev"
    // { baseUrl: 'https://toad.social/api/v1/accounts/123/following?limit=80', next: { parmName: max_id, parmValue: 2900 }, prev: { parmName: since_id, parmValue: 3000 } }
    parsePagingHeader: function(linkHeader) {
      
      let paging = {
        baseUrl: '',
        next: {},
        prev: {}
      };

      if (linkHeader && linkHeader.length > 0) {
        const parts = linkHeader.split(', ');
        if (parts.length === 2) {
          parts.forEach(function(part) {
            let pieces = part.split('; ');
            if (pieces.length === 2) {
              let urlPiece = pieces[0].replace('<', '').replace('>', '');
              let amperSpot = urlPiece.lastIndexOf('&');
              if (amperSpot > -1) {
                let baseUrl = urlPiece.substring(0, amperSpot - 1);
                let keyTerm = urlPiece.substring(amperSpot);
                // split on equals
                let splitKey = keyTerm.split('=');
                let parmName = splitKey[0];
                let parmValue = splitKey[1];
                let parm = {parmName: parmName, parmValue: parmValue};
                // for now, seems like we can split at the ampersand
                let relWord = pieces[1].replace('rel=', '').replace(`"`, '');
                
                if (relWord === 'next') {
                  paging.next = parm;
                }
                else if (relWord === 'prev') {
                  paging.prev = parm;
                }

                paging.baseUrl = baseUrl;
              }
            }
          });
        }
      }
    },

    // { apiCallsRemaining: .., apiLimitResetAt: ..., paging: paging }
    parseResponseHeaders: function(response) {
      // docs.joinmastodon.org/methods/accounts/#following
      // docs.joinmastodon.org/api/rate-limits/
      // generally 300 per 5 minutes
      const apiCallsRemaining = response.headers.get('x-ratelimit-remaining');
      // when the rate limit will reset
      const apiLimitResetAt = response.headers.get('x-ratelimit-reset');

      // look for paging
      const linkHeader = response.headers.get('link');
      const paging = STR.MASTODON.parsePagingHeader(linkHeader);

      return {
        apiCallsRemaining: apiCallsRemaining,
        apiLimitResetAt: apiLimitResetAt,
        paging: paging
      }
    }
  }
};