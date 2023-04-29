var RENDER = {

  renderPerson: function(person, context, renderAnchorsRule, filtered) {
    let roleInfo = '';
    let imgSize = 92;
    let withDetail = true;
    let withAnchors = true;
    let avatarOnly = false;
    let linkImage = true;
    let imgClass = '';
  
    switch (context) {
      case RENDER_CONTEXT.PERSON.AUTHD_USER:
        imgSize = 46;
        withDetail = false;
        withAnchors = false;
        avatarOnly = true;
        imgClass = ` class='rounded-circle'`;
        linkImage = false;
        break;
      case RENDER_CONTEXT.PERSON.ACCOUNT_OWNER:
        imgSize = 46;
        roleInfo = ` role='button'`;  // clickable
        withDetail = false;
        withAnchors = false;
        linkImage = false;
        break;
      default:
        break;
    }
    
    // we select out from the DB the SCHEMA_CONSTANTS.COLUMNS.NamedGraph
    let site = person.Site || APPGRAPHS.getSiteFromGraph(person.NamedGraph) || SETTINGS.getCachedSite();
    let handle = DOMPurify.sanitize(person.Handle);
    let displayName = DOMPurify.sanitize(person.DisplayName);
    let detail = DOMPurify.sanitize(person.Detail);
    let imgCdnUrl = DOMPurify.sanitize(person.ImgCdnUrl);
    let img64Url = DOMPurify.sanitize(person.Img64Url);

    handle = STR.ensurePrefix(handle, '@');
    const profileUrl = STR.makeProfileUrl(handle, site);
    
    const imgStyling = `style='width:${imgSize}px;height:${imgSize}px;padding:2px;'`;

    let img = '';
    if (img64Url && img64Url.length > 50) {
      const imgSrc = IMAGE.writeBase64Src(imgCdnUrl, img64Url);
      img = `<img alt='${handle}' ${imgStyling}${imgClass} src='${imgSrc}'/>`;
    }
    // else if (imgCdnUrl && imgCdnUrl.length > 10 && !STR.looksLikeCdnRestrictedImg(imgCdnUrl)) {
    // COMMENTED OUT because images give ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep when rendered from external context
    // instead, we use deferred image load to base64 data per the "else"
    //  img = `<img ${imgStyling} src='${imgCdnUrl}'/>`;
    // }
    else {
      const data64Attr = (imgCdnUrl && IMAGE.shouldDeferLoadImages(site, imgCdnUrl)) ? IMAGE.writeDeferredLoadTag(imgCdnUrl) : '';
      img = `<img alt='${handle}' ${imgStyling}${imgClass} src='/images/noprofilepic.png' ${data64Attr}/>`;
    }
    
    if (linkImage) {
      img = `<a href='${profileUrl}' target='_blank'>${img}</a>`;
    }

    const sansAt = STR.stripPrefix(handle, '@');
    const preparedDisplayName = RENDER.prepareDisplayText(displayName, withAnchors, renderAnchorsRule);
    let preparedDetail = RENDER.prepareDisplayText(detail, withAnchors, renderAnchorsRule);
  
    if (context.filtered === true) {
      preparedDetail = `<b>${preparedDetail}</b>`;
    }
  
    detail = (withDetail === true && detail) ? `<div class='personDetail'>${preparedDetail}</div>` : ``;
    
    let renderedHandle = handle;
  
    // note: if we're focused on e.g. mdon, don't distract with link to twitter
    if (withAnchors && !filtered) {
      renderedHandle = `<a href='${profileUrl}' target='_blank'>${handle}</a>`;
    }
    
    let starCls = _starOffCls;
    if (person.InList == 1 && person.ListName === LIST_FAVORITES) {
      starCls = _starOnCls;
    }
    
    let followInfo = '';
    if (person.FollowingCount && person.FollowingCount > 0 && person.FollowersCount && person.FollowersCount > 0) {
      followInfo = `<span class='small text-secondary ps-2'>(following: ${person.FollowingCount} | followers: ${person.FollowersCount})</span>`;
    }

    if (avatarOnly) {

      const avatarTip = `Connected as ${handle} (${displayName})`;
      return `<span data-toggle='tooltip' title='${avatarTip}'>${img}</span>`;
    }
    else {

      return `<div class='person row striped pt-1' ${roleInfo}>
      <div class='col-sm-auto'><a href='#' class='canstar' data-testid='${sansAt}'><i class='${starCls}'></i></a></div>
      <div class='col-sm-auto personImg'>${img}</div>
      <div class='col personLabel'>
        <div><span class='personHandle'>${renderedHandle}</span>${followInfo}</div>
        <div class='personDisplay'>${preparedDisplayName ?? ''}</div>
        ${detail}
      </div>
    </div>`;

    }
  },

  renderEmailAnchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_EMAIL, function(match) {
      let email = match.trim().replace(' at ', '@').replace('(at)', '@').replace(' dot ', '.').replace('(dot)', '.');
      return `<a href='mailto:${email}' target='_blank'>${match}</a>`;
    });
  },

  // simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
  renderUrlAnchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_URL, function(url) {
      if (STR.MASTODON.looksLikeAccountUrl(url) === true) { return url; }
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
      if (!STR.MASTODON.couldBeServer(homeServer)) {
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
    
    return text.replace(REGEX_MDON1, function(match, handle, domain) {
      return RENDER.renderMastodonAnchor(match, handle, domain);
    });
  },

  // toad.social/@scafaria or https://toad.social/@scafaria
  renderMastodon2Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_MDON2, function(match, http, www, domain, handle) {
      return RENDER.renderMastodonAnchor(match, handle, domain);
    });
  },

  // scafaria@toad.social
  // note the missed starting @ -- and instead of trying to keep up with all the server instances
  // we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
  renderMastodon3Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_MDON3, function(match, handle, domain) {
      return RENDER.renderMastodonAnchor(match, handle, domain);
    });
  },

  prepareDisplayText: function(txt, withAnchors, renderAnchorsRule) {
    if (!txt) { return txt; }
    txt = EMOJI.injectFlagEmojis(txt);
    
    txt = STR.cleanNewLineCharacters(txt, '<br>');

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
  },

  saveTextFile: function(txt, filename) {
    var a = document.createElement('a');
    var file = new Blob( [txt], {type: 'text/plain'} );
    
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
  
    URL.revokeObjectURL(a.href);
    a.remove();
  }
  
};