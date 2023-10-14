var STR = {
  
  isTruthy: function(str) {
    if (!str || !STR.hasLen(str.toString())) { return false; }
    return str.toString().toLowerCase() == 'true' || str.toString() == '1';
  },

  dateFromMmDdYyyy: function(str) {
    if (!STR.hasLen(str)) { return null; }
    let parts = str.split('/');
    if (parts.length == 1) {
      parts = str.split('-');
    }
    if (parts.length != 3) { return null; }
    const mm = parseInt(parts[0]);
    const dd = parseInt(parts[1]);
    const yyyy = parseInt(parts[2]);
    if (isNaN(mm) || isNaN(dd) || isNaN(yyyy)) { return null; }
    const dt = new Date(`${yyyy}-${mm}-${dd}`);
    return dt;
  },

  ellipsed: function(str, len) {
    if (!str) { return str; }
    if (str.length > len) {
      if (len > 10) {
        str = str.substring(0, len - 3);
        str = `${str}...`;
      }
      else {
        str = str.substring(0, len);
      }
    }

    return str;
  },

  // this is meant to assess whether passed-in values are "substantive"
  hasLen: function(str) {
    if (str === false) {
      // explicitly passing in false is considered "substantive" for our purposes
      return true;
    }
    else if (str && !str.length) {
      // in case passed in an integer or boolean instead of a string (length comes back undefined)
      return str.toString().length > 0;
    }
    else if (!str || str.length == 0) {
      return false;
    }
    else {
      return true;
    }
  },

  appendSpaced: function(txt, appendThis) {
    if (!appendThis) { return txt; }
    if (!STR.hasLen(txt)) { return appendThis; }
    return `${txt} ${appendThis}`;
  },
  
  appendLine: function(txt, appendThis) {
    if (!appendThis) { return txt; }
    if (!STR.hasLen(txt)) { return appendThis; }
    return `${txt}\n${appendThis}`;
  },

  // stackoverflow.com/questions/73419876/javascript-replace-all-emoji-in-a-string-to-unicode-and-back
  // also read re "deprecated" but "ok for this use case"
  // stackoverflow.com/questions/30631927/converting-to-base64-in-javascript-without-deprecated-escape-call
  encodeTextEmojis: function(plainText) {
    return unescape(encodeURIComponent(plainText));
  },

  decodeBase64Emojis: function(b64) {
    return decodeURIComponent(escape(b64));
  },
  
  // stackoverflow.com/questions/73419876/javascript-replace-all-emoji-in-a-string-to-unicode-and-back
  toBase64: function(str, adjustEmojis) {
    if (adjustEmojis == true) {
      str = STR.encodeTextEmojis(str);
    }
    return btoa(str);
  },

  fromBase64: function(b64, adjustEmojis) {
    if (adjustEmojis == true) {
      b64 = STR.decodeBase64Emojis(b64);
    }
    return atob(b64);
  },

  toHoursMinutesSeconds: function(seconds) {
    if (isNaN(seconds)) { return ''; }

    if (seconds < 0) { 
      seconds = -1 * seconds;
    }

    if (seconds < 30) {
      return 'a few seconds';
    }
    else if (seconds < 60) {
      return '< 1 minute';
    }
    else if (seconds < 120) {
      return 'about a minute';
    }
    else if (seconds < 300) {
      return 'a few minutes';
    }
    else if (seconds < 3600) {
      const minutes = parseInt(seconds / 60);
      const remainingSeconds = parseInt(seconds - (minutes * 60));
      return `${minutes} minutes, ${remainingSeconds} seconds`;
    }
    else if (seconds < 60 * 60 * 24) {
      const hours = parseInt(seconds / 3600);
      let remainingSeconds = (seconds - (hours * 60 * 60));
      let remainingMinutes = parseInt(remainingSeconds / 60);
      return `${hours} hours, ${remainingMinutes} minutes`;
    }
    else {
      const days = parseInt(seconds / (60 * 60 * 24));
      let remainingSeconds = (seconds - (days * 60 * 60 * 24));
      let remainingHours = parseInt(remainingSeconds / 3600);
      return `${days} days, ${remainingHours} hours`;
    }
  },

  secondsAgo: function(dt) {
    if (isNaN(dt)) { return null; }
    const ago = parseInt((Date.now() - dt) / 1000);
    return ago;
  },

  timeVsNowFriendly: function(dt) {
    if (isNaN(dt)) { return ''; }
    const gapSeconds = (Date.now() - dt) / 1000;
    let absGap = gapSeconds;
    let inFuture = false;
    
    if (gapSeconds < 0) {
      // dt is in the future
      absGap = -1 * gapSeconds;
      inFuture = true;
    }

    let time = STR.toHoursMinutesSeconds(absGap);
    if (inFuture == true) {
      return `${time} from now`;
    }
    else {
      return `${time} ago`;
    }
  },

  nowIso: function(epochMs) {
    const dt = epochMs ? new Date(epochMs) : new Date(Date.now());
    return dt.toISOString();
  },

  nitterTimeToIso: function(nitterTime) {
    // Apr 12, 2022 · 5:04 PM UTC
    nitterTime = nitterTime.replace('· ', '');
    const dt = new Date(nitterTime);
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
    if (!txt || txt.length == 0 || !prefix || prefix.length == 0) { return txt; }
    
    const hit = insensitive ? txt.toLowerCase().startsWith(prefix.toLowerCase()) : txt.startsWith(prefix);
    if (hit) {
      txt = txt.substring(prefix.length);
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
  
  normalizeSpaces: function(txt) {
    return (txt) ? txt.replace(/\n/g, " ").replace(/\s\s+/g, ' ') : txt;
  },

  isShortUrl: function(url) {
    return url && url.indexOf('//t.co/') > -1;
  },

  sameText: function(a, b, caseInsensitive = true) {
    if (a === b) {
      return true;
    }
    
    if (caseInsensitive == true && a && b) {
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

  getUrlSansHashAndQueryString: function(url) {
    return STR.stripQueryString(STR.stripUrlHashSuffix(url));
  },

  concatSubtopicRatingTag: function(subtopicName, rating) {
    return `${subtopicName}${SUBTOPIC_RATING_DELIM}${rating}`;
  },

  // a SocialPostSubtopicRating oValue is of the format e.g. MySubtopic-3
  splitSubtopicRatingTag: function(tag) {
    let subtopic = null;
    let rating = null;
    const hit = (STR.hasLen(tag)) ? tag.lastIndexOf(SUBTOPIC_RATING_DELIM) : null;
    if (hit && hit > -1) {
      subtopic = tag.substring(0, hit);
      rating = parseInt(tag.substring(hit + 1, tag.length));
      if (isNaN(rating)) {
        rating = null;
      }
    }

    return {
      subtopic: subtopic,
      rating: rating
    }
  },

  stripUrlHashSuffix: function(url) {
    if (!url) { return url; }
    const parts = url.split('#');
    return parts[0];
  },

  getUrlHashSuffix: function(url) {
    const parts = url.split('#');
    return (parts.length == 2) ? parts[1] : null;
  },

  stripQueryString: function(url) {
    const parts = url.split('?');
    return parts[0];
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
    else if (url.indexOf('.jpg') > -1) {
      return 'jpg';
    }
    else if (url.indexOf('.jpeg') > -1) {
      return 'jpeg';
    }
    else if (url.indexOf('.gif') > -1) {
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

  tryGetUrlKey: function(fullUrl, domains) {
    if (!domains || domains.length == 0) { return null; }
    fullUrl = STR.stripHttpWwwPrefix(fullUrl);
    for (let i = 0; i < domains.length; i++) {
      let domain = domains[i];
      if (fullUrl.startsWith(domain)) {
        return STR.stripPrefix(fullUrl, domain);
      }
    }
    return null;
  },

  expandTweetUrl: function(urlKey, domain) {
    domain = domain || X_COM_URL;
    if (domain == 'twitter.com') {
      domain = X_COM_URL;
    }
    return `https://${domain}${urlKey}`;
  },

  buildSquidlrUrl: function(urlKey, resolution) {
    // squidlr doesn't benefit from the #quoted suffix that we've attached to quote tweet urlKeys anyway, and we need to append a different hash suffix...
    urlKey = STR.stripUrlHashSuffix(urlKey);
    const xUrl = STR.expandTweetUrl(urlKey, X_COM_URL);
    return `https://${SQUIDLR_URL}/download?url=${xUrl}#${resolution}`;
  },

  cleanTweetUrlKey: function(href) {
    href = STR.stripSuffix(href, '/history');     // happens when a tweet has been edited, e.g. see "/ChrisDJackson/status/1700935165550219736"
    href = STR.getUrlSansHashAndQueryString(href);
    return href;
  },

  // NOTE: caller should ensure that owner isn't "i" which happens sometimes when referring to the owner of the page being viewed
  makeTweetRelativeUrl: function(owner, threadId) {
    return `/${owner}/status/${threadId}`;
  },

  getTweetIdFromUrlKey: function(urlKey) {
    if (!urlKey) { return null; }
    urlKey = STR.stripUrlHashSuffix(urlKey);
    if (urlKey.indexOf('/status/') < 0) { return null; }
    const parts = urlKey.split('/');
    return parts[parts.length - 1]; // last part
  },

  looksLikePartOfThread: function(text) {
    if (!STR.hasLen(text)) { return false; }
    // see if it starts with "1. text..." approach
    const regex1 = /^[0-9]+\.\s/g;
    const match1 = text.match(regex1);
    if (match1 && match1.length > 0) {
      return true;
    }
    else if (text.indexOf('🧵') > -1 || text.indexOf('👆') > -1 || text.indexOf('👇') > -1 || text.indexOf('☝') > -1) {
      return true;
    }
    else if (text.toLowerCase().indexOf('thread') > -1) {
      return true;
    }
    else if (text.startsWith('...')) {
      return true;
    }
    else if (text.endsWith('...')) {
      return true;
    }
    else {
      // look for the 1/n indicator
      const regex2 = /[0-9]\//g;
      const match2 = text.match(regex2);
      return (match2 && match2.length > 0);
    }
  },

  // returned value excludes ending slash
  getPathFromFullName: function(fullName) {
    if (!STR.hasLen(fullName)) { return null; }
    const pos = fullName.lastIndexOf('/');
    if (pos < 0) { return null; }
    return fullName.substring(0, pos);
  },

  getFileNameFromFullName: function(fullName) {
    if (!STR.hasLen(fullName)) { return null; }
    const pos = fullName.lastIndexOf('/');
    if (pos < 0) { return fullName; }
    return fullName.substring(pos + 1);
  },

  // lower-case
  nextAlphaMarker: function(prior) {
    if (!STR.hasLen(prior)) {
      return 'a';
    }
    const priorCode = prior.toLowerCase().charCodeAt(0);
    
    // a is 97, z is 122
    if (priorCode < 97) { 
      return 'a'; 
    }
    else if (priorCode > 121) {
      // z or higher; return our special marker
      return LAST_TEXT;
    }
    else {
      return String.fromCharCode(priorCode + 1);
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