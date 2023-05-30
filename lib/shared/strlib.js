var STR = {
  
  toBase64: function(str) {
    return btoa(str);
  },

  fromBase64: function(b64) {
    return atob(b64);
  },

  nowIso: function(epochMs) {
    const dt = epochMs ? new Date(epochMs) : new Date(Date.now());
    return dt.toISOString();
  },

  isValidIsoDate: function(dt) {
    return dt && REGEX_ISODATE.test(dt);
  },

  fromFancyTimeToSeconds: function(timeText) {
    const parts = timeText.split(':');

    if (parts.length == 0) {
      return 0;
    }
    else if (parts.length == 1) {
      return parseInt(parts[0]);
    }
    else if (parts.length == 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    else if (parts.length == 3) {
      return parseInt(parts[0]) * 60 * 60 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
  },

  // stackoverflow.com/questions/3733227/javascript-seconds-to-minutes-and-seconds
  toFancyTimeFormat: function(duration) {
    // Hours, minutes and seconds
    // note: Math.floor shortcut is ~~
    const hrs = ~~(duration / 3600);
    const mins = ~~((duration % 3600) / 60);
    const secs = ~~duration % 60;
  
    // Output like "1:01" or "4:03:59" or "123:03:59"
    let ret = "";
  
    if (hrs > 0) {
      ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
    }
  
    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;
  
    return ret;
  },

    // unicode characters 2028 and 2029 render as l-sep and p-sep instead of new-line characters in Chrome on Windows
  // replace with e.g. '<br>'
  cleanNewLineCharacters: function(txt, replaceWith) {
    return txt.replace(/[\u2028-\u2029]/g,replaceWith);
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

  friendlyParsedUrl: function(parsedUrl) {
    switch (parsedUrl.pageType) {
      case PAGETYPE.TWITTER.FOLLOWING:
      case PAGETYPE.MASTODON.FOLLOWING:
        return `followed by ${parsedUrl.owner}`;
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWERS:
        return `followers of ${parsedUrl.owner}`;
      case PAGETYPE.TWITTER.PROFILE:
      case PAGETYPE.NITTER.PROFILE:
        return `profile of ${parsedUrl.owner}`;
    }
  },

  extractDomain: function(url) {
    if (!url) { return url; }
    url = STR.stripHttpWwwPrefix(url);
    const qMark = url.indexOf('?');
    const slash = url.indexOf('/');
    let hit = qMark;

    if (hit < 0 || (slash > -1 && slash < hit)) { 
      hit = slash; 
    }

    if (hit > -1) {
      return url.substring(0, hit);
    }
    else {
      return url;
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
  extractAccounts: function(texts, extractMdons = true, extractEmails = true, extractUrls = true) {
    let emails = [];
    let urls = [];
    let mdons = [];
    for (let i = 0; i < texts.length; i++) {
      let text = texts[i];

      if (extractEmails) {
        emails.push(...STR.extractEmails(text));
      }

      if (extractUrls) {
        urls.push(...STR.extractUrls(text));
      }

      if (extractMdons) {
        mdons.push(...STR.MASTODON.extractAccounts(text));
      }
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
  
  makeProfileUrl: function(fullHandle, site, linkViaUserHomeMastodonServer) {
    switch(site) {
      case SITE.MASTODON:
        return STR.MASTODON.makeProfileUrl(fullHandle, linkViaUserHomeMastodonServer);
      
      case SITE.TWITTER:
        fullHandle = STR.stripPrefix(fullHandle, '@');
        return `https://${site}.com/${fullHandle}`;

      default:
        return `https://${site}/${fullHandle}`;
    }
  },

  MASTODON: {
    
    // servers that use a syntax similar to mastodon but we know are not mastodon
    imposterServers: function() {
      return [
        'post.news',
        'spoutible.com',
        't2.social'
      ];
    },
    
    isImposterServer: function(server) {
      const imposters = STR.MASTODON.imposterServers();
      for (let i = 0; i < imposters.length; i++) {
        let imposter = imposters[i];
        if (STR.sameText(imposter, server)) {
          return true;
        }
      }

      return false;
    },

    looksLikeImposterProfileUrl: function(profileUrl) {
      const servers = STR.MASTODON.imposterServers();
      for (let i = 0; i < servers.length; i++) {
        let server = servers[i];
        if (profileUrl.toLowerCase().indexOf(server + '/') > -1) {
          return true;
        }
      }

      return false;
    },
    
    looksLikeImposterAccount: function(account) {
      const servers = STR.MASTODON.imposterServers();
      for (let i = 0; i < servers.length; i++) {
        let server = servers[i];
        if (account.toLowerCase().indexOf('@' + server) > -1) {
          return true;
        }
      }

      return false;
    },

    serverFromHandle: function(handle) {
      const parts = STR.stripPrefix(handle, '@').split('@');
      const server = parts[1];
      return server;
    },
    
    // see comment at splitUrl
    accountFromProfileUrl: function(url) {
      if (!url) { return undefined; };
      if (url.length === 0) { return ''; }
      
      const splitUrl = STR.MASTODON.splitUrl(url);
      const fullHandle = STR.MASTODON.standardizeAccount(splitUrl.handleOnly, splitUrl.server);
      return fullHandle;
    },
  
    makeProfileUrl: function(fullHandle, linkViaUserHomeMastodonServer) {
      // first parse the handle we were given
      const parts = STR.stripPrefix(fullHandle, '@').split('@');
      let server = parts[1];
      let handleOnly = STR.ensurePrefix(parts[0], '@');

      if (linkViaUserHomeMastodonServer && !STR.sameText(linkViaUserHomeMastodonServer, server)) {
        // create a type (b) link [see comment at splitUrl]
        return `https://${linkViaUserHomeMastodonServer}/${STR.ensurePrefix(fullHandle, '@')}`;
      }
      else {
        return `https://${server}/${handleOnly}`;
      }
    },
  
    // (a) standard
    // https://toad.social/@scafaria ==> @scafaria@toad.social
    // (b) this format allows a direct follow
    // https://toad.social/@username@journa.host ==> @username@journa.host
    splitUrl: function(url) {
      const urlParts = url.split('@');
      let server = '';
      let handleOnly = '';

      if (urlParts.length === 2) {
        // (a) "https://mastodon.social/@spreadmastodon" ==> 'mastodon.social' and 'spreadmastodon'
        server = STR.stripSuffix(STR.stripHttpWwwPrefix(urlParts[0]),'/');
        handleOnly = STR.ensurePrefix(urlParts[1], '@');
      }
      else if (urlParts.length === 3) {
        // (b) https://toad.social/@username@journa.host ==> 'toad.social' and 'username@journa.host'
        server = urlParts[2];
        handleOnly = STR.ensurePrefix(urlParts[1], '@');
      }
      else {
        console.warn('Trouble splitting mdon url: ' + url);
      }
      
      return {server: server, handleOnly: handleOnly};
    },
  
    looksLikeAccountUrl: function(url) {
      if (!url) { return false; }
      
      if (STR.MASTODON.looksLikeImposterProfileUrl(url)) {
        return false;
      }

      url = STR.stripSuffixes(url, ['/']); // trim ending slash before evaluating
      
      // well-known url syntaxes that are not mastodon but use same profile syntax
      const imposters = ['post.news/@', '@post.news'];
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
  
    couldBeFullHandle: function(input) {
      if (!input) { return false; }
      input = STR.stripPrefix(input, '@');

      if (input.indexOf('@') < 0) {
        return false;
      }

      const parts = input.split('@');
      const server = parts[1];
      
      if (server.indexOf('.') < 0) {
        return false;
      }

      const serverPieces = server.split('.');
      return serverPieces[0].length > 0 && serverPieces[1].length > 0;
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
    
    standardizeAccount: function(handleOnly, domain) {
      return `@${handleOnly.trim().replace('@','')}@${domain.trim().replace('@','')}`;
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

        if (!STR.MASTODON.looksLikeImposterAccount(account)) {
          accounts.push(account);
        }
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

        if (!STR.MASTODON.looksLikeImposterAccount(account)) {
          accounts.push(account);
        }
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
        
        if (!STR.MASTODON.looksLikeImposterAccount(account)) {
          accounts.push(account);
        }
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
              let urlPiece = pieces[0].replaceAll('<', '').replaceAll('>', '');
              let amperSpot = urlPiece.lastIndexOf('&');
              if (amperSpot > -1) {
                let baseUrl = urlPiece.substring(0, amperSpot);
                let keyTerm = urlPiece.substring(amperSpot + 1);
                // split on equals
                let splitKey = keyTerm.split('=');
                let parmName = splitKey[0];
                let parmValue = splitKey[1];
                let parm = {parmName: parmName, parmValue: parmValue};
                // for now, seems like we can split at the ampersand
                let relWord = pieces[1].replaceAll('rel=', '').replaceAll(`"`, '');
                
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

      return paging;
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