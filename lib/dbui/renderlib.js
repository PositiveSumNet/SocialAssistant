const getMdonServer = function() {
  return localStorage.getItem('mdonServer');
}

const renderEmailAnchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_emailRexCapture, function(match) {
    let email = match.trim().replace(' at ', '@').replace('(at)', '@').replace(' dot ', '.').replace('(dot)', '.');
    return `<a href='mailto:${email}' target='_blank'>${match}</a>`;
  });
}

// simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
const renderUrlAnchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_urlRexCapture, function(url) {
    if (looksLikeMastodonAccountUrl(url) === true) { return url; }
    let display = stripHttpWwwPrefix(url);
    url = stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
    const maxLen = 30;
    if (display.length > maxLen) {
      display = display.substring(0, maxLen) + '...';
    }
    return `<a href='${url}' target='_blank'>${display}</a>`;
  });
}

const renderMastodonAnchor = function(display, handle, domain) {
    const maxLen = 30;
    display = stripHttpWwwPrefix(display);
    if (display.length > maxLen) {
      display = display.substring(0, maxLen) + '...';
    }
    
    let homeServer = getMdonServer();
    if (!couldBeMastodonServer(homeServer)) {
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
}

// regex101.com/r/ac4fG5/1
// @scafaria@toad.social
const renderMastodon1Anchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_mastodon1RexCapture, function(match, handle, domain) {
    return renderMastodonAnchor(match, handle, domain);
  });
}

// toad.social/@scafaria or https://toad.social/@scafaria
const renderMastodon2Anchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_mastodon2RexCapture, function(match, http, www, domain, handle) {
    return renderMastodonAnchor(match, handle, domain);
  });
}

// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const renderMastodon3Anchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_mastodon3RexCapture, function(match, handle, domain) {
    return renderMastodonAnchor(match, handle, domain);
  });
}

const prepareDisplayText = function(txt, withAnchors = true) {
  if (!txt) { return txt; }
  txt = injectFlagEmojis(txt);
  
  if (withAnchors) {
    
    const renderRule = getPersonRenderAnchorsRule();
    
    if (renderRule === 'urlOnly' || renderRule === 'all') {
      txt = renderUrlAnchors(txt);
    }
    
    if (renderRule === 'emailOnly' || renderRule === 'all') {
      txt = renderEmailAnchors(txt);
    }
    
    if (renderRule === 'mdonOnly' || renderRule === 'all') {
      txt = renderMastodon1Anchors(txt);
      txt = renderMastodon2Anchors(txt);
      txt = renderMastodon3Anchors(txt);
    }
  }
  
  return txt;
}
