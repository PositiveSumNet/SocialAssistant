var RENDER = {

  renderEmailAnchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(_emailRexCapture, function(match) {
      let email = match.trim().replace(' at ', '@').replace('(at)', '@').replace(' dot ', '.').replace('(dot)', '.');
      return `<a href='mailto:${email}' target='_blank'>${match}</a>`;
    });
  },

  // simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
  renderUrlAnchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(_urlRexCapture, function(url) {
      if (STR.looksLikeMastodonAccountUrl(url) === true) { return url; }
      let display = STR.stripHttpWwwPrefix(url);
      url = STR.stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
      const maxLen = 30;
      if (display.length > maxLen) {
        display = display.substring(0, maxLen) + '...';
      }
      return `<a href='${url}' target='_blank'>${display}</a>`;
    });
  },

  renderMastodonAnchor: function(display, handle, domain) {
      const maxLen = 30;
      display = STR.stripHttpWwwPrefix(display);
      if (display.length > maxLen) {
        display = display.substring(0, maxLen) + '...';
      }
      
      let homeServer = SETTINGS.getMdonServer();
      if (!STR.couldBeMastodonServer(homeServer)) {
        homeServer = '';
      }
      
      let url;
      if (homeServer && homeServer.length > 0 && homeServer.toLowerCase() != domain.toLowerCase()) {
        // give an url that's clickable directly into a follow (can only follow from one's own home server)
        url = `https://${homeServer}/@${handle}@${domain}`;    
      }
      else {
        url = `https://${domain}/@${handle}`;    
      }
      
      return `<a href='${url}' target='_blank'>${display}</a>`;
  },

  // regex101.com/r/ac4fG5/1
  // @scafaria@toad.social
  renderMastodon1Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(_mastodon1RexCapture, function(match, handle, domain) {
      return RENDER.renderMastodonAnchor(match, handle, domain);
    });
  },

  // toad.social/@scafaria or https://toad.social/@scafaria
  renderMastodon2Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(_mastodon2RexCapture, function(match, http, www, domain, handle) {
      return RENDER.renderMastodonAnchor(match, handle, domain);
    });
  },

  // scafaria@toad.social
  // note the missed starting @ -- and instead of trying to keep up with all the server instances
  // we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
  renderMastodon3Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(_mastodon3RexCapture, function(match, handle, domain) {
      return RENDER.renderMastodonAnchor(match, handle, domain);
    });
  },

  prepareDisplayText: function(txt, withAnchors, renderAnchorsRule) {
    if (!txt) { return txt; }
    txt = EMOJI.injectFlagEmojis(txt);
    
    if (withAnchors) {
      
      if (renderAnchorsRule === 'urlOnly' || renderAnchorsRule === 'all') {
        txt = RENDER.renderUrlAnchors(txt);
      }
      
      if (renderAnchorsRule === 'emailOnly' || renderAnchorsRule === 'all') {
        txt = RENDER.renderEmailAnchors(txt);
      }
      
      if (renderAnchorsRule === 'mdonOnly' || renderAnchorsRule === 'all') {
        txt = RENDER.renderMastodon1Anchors(txt);
        txt = RENDER.renderMastodon2Anchors(txt);
        txt = RENDER.renderMastodon3Anchors(txt);
      }
    }
    
    return txt;
  }
  
}
