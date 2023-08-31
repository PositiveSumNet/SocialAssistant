var RENDER = {

  POST: {
    renderRepostedBy: function(post, site) {
      
      if (!STR.hasLen(post.ReposterHandle)) {
        return '';
      }
      
      let handle = DOMPurify.sanitize(post.ReposterHandle);
      handle = STR.ensurePrefix(handle, '@');
      let displayName = DOMPurify.sanitize(post.ReposterName || handle);
      displayName = RENDER.prepareDisplayText(displayName, false);
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());

      return `
      <span class='repostedBy'>
        <span><i class='bi-repeat'></i> Reposted by </span>
        <a href='${profileUrl}' target='_blank'>
          <span class='repostedByName'>${displayName}</span>
          <span class='basicSep'> / </span>
          <span class='repostedByHandle'>${handle}</span>
        </a>
      </span>
      `;
    },

    renderStats: function(post) {
      let replyCount = post[POST_SEL.ReplyCount];
      let likeCount = post[POST_SEL.LikeCount];
      let reshareCount = post[POST_SEL.ReshareCount];

      let clsOtherReply = ' ';
      let clsOtherLike = ' ';
      let clsOtherReshare = ' ';

      if (!replyCount) {
        replyCount = '';
        clsOtherReply = ' lightfont';
      }
      if (!likeCount) {
        likeCount = '';
        clsOtherLike = ' lightfont';
      }
      if (!reshareCount) {
        reshareCount = '';
        clsOtherReshare = ' lightfont';
      }

      return `
      <span class='postStats text-secondary' data-toggle='tooltip' title='Number of replies, likes, and re-posts as of the time recorded'>
        <span class='replyCount${clsOtherReply}'><i class='bi-chat-left'></i> ${replyCount}</span>
        <span class='basicSep'> | </span>
        <span class='likeCount${clsOtherLike}'><i class='bi-heart'></i> ${likeCount}</span>
        <span class='basicSep'> | </span>
        <span class='reshareCount${clsOtherReshare}'><i class='bi-repeat'></i> ${reshareCount}</span>
      </span>
      `;
    },

    renderPostTime: function(post) {
      const dt = new Date(post.PostTime);
      if (isNaN(dt)) { return ''; }
      
      return `
      <span class='postTime'>
        <a href='${STR.expandTweetUrl(post.PostUrlKey)}' target='_blank'>${dt.toLocaleString()}</a>
      </span>
      `;
    },

    renderReplyTo: function(post, site) {
      if (!post.ReplyToTweet) { return ''; }

      const authorElm = RENDER.POST.renderAuthorName(post.ReplyToTweet.AuthorHandle, post.ReplyToTweet.AuthorName, site, 'replyToAuthorName', 'replyToAuthorHandle', 'replyToAuthorAnchor');

      let postText = STR.ellipsed(post.ReplyToTweet.PostText, 300);
      postText = DOMPurify.sanitize(postText);

      const postTimeElm = RENDER.POST.renderPostTime(post.ReplyToTweet);

      return `
      <div class='replyToPost small'>
        <div class='replyToAuthor'>
          <span>Replying to </span>
          ${authorElm}
          <span class='basicSep'> | </span>
          <a href='${STR.expandTweetUrl(post.PostUrlKey)}' target='_blank'><i class='bi-twitter'></i></a>
          ${postTimeElm}
        </div>
        <div class='replyToContent'>
          ${postText}
        </div>
      </div>
      `;
    },

    renderPostImage: function(imgCdnUrl, img64Url) {
      if (!img64Url) { return ''; }
      imgCdnUrl = DOMPurify.sanitize(imgCdnUrl);
      img64Url = DOMPurify.sanitize(img64Url);

      let imgSrc = '';
      if (img64Url) {
        imgSrc = IMAGE.writeBase64Src(imgCdnUrl, img64Url);
      }

      return `<div class='postContentImg'><img alt='src-img' src='${imgSrc}' style='max-width:400px;max-height:400px;'/></div>`;
    },

    renderPostContent: function(post) {
      
      const postText = RENDER.prepareDisplayText(post.PostText, true, 'urlOnly');

      let cardElm = '';
      if (STR.hasLen(post.CardText) || STR.hasLen(post.CardImg64Url)) {
        const cardText = STR.hasLen(post.CardText) ? RENDER.prepareDisplayText(post.CardText, true, 'urlOnly') : '';
        const cardUrl = post.CardFullUrl || post.CardShortUrl || STR.expandTweetUrl(post.PostUrlKey);
        const imgUrl = RENDER.POST.renderPostImage(post.CardImgCdnUrl, post.CardImg64Url);

        cardElm = `
        <a class='postCard' href='${cardUrl}' target='_blank'>
          <span class='postCardText'>${cardText}</span>
          ${imgUrl}
        </a>
        `;
      }

      let regImgsHtml = '';
      if (post.Images) {
        for (let i = 0; i < post.Images.length; i++) {
          let regImg = post.Images[i];

          regImgsHtml = `
          ${regImgsHtml}
          ${RENDER.POST.renderPostImage(null, regImg.RegImg64Url)}
          `;
        }
      }

      return `
      <div class='postContent'>
        <div class='postDirectText'>${DOMPurify.sanitize(postText)}</div>
        ${cardElm}
        ${regImgsHtml}
      </div>
      `;
    },
    
    renderPostAuthorImg: function(post, site) {
      let handle = DOMPurify.sanitize(post.AuthorHandle);
      handle = STR.ensurePrefix(handle, '@');

      let imgCdnUrl = DOMPurify.sanitize(post.AuthorImgCdnUrl);
      let img64Url = DOMPurify.sanitize(post.AuthorImg64Url);
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());

      let imgSrc = '/images/noprofilepic.png';
      if (img64Url) {
        imgSrc = IMAGE.writeBase64Src(imgCdnUrl, img64Url);
      }

      return `
      <a class='postAuthorLink' href='${profileUrl}' target='_blank'>
        <img class='postAuthorImg' alt='${handle}' src='${imgSrc}'/>
      </a>`;
    },

    renderAuthorName: function(handle, displayName, site, clsAuthorName, clsAuthorHandle, clsAnchor) {
      handle = DOMPurify.sanitize(handle);
      handle = STR.ensurePrefix(handle, '@');
      displayName = DOMPurify.sanitize(displayName || handle);
      displayName = RENDER.prepareDisplayText(displayName, false);
      
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());

      return `
      <a href='${profileUrl}' target='_blank' class='${clsAnchor}'>
        <span class='${clsAuthorName}'>${displayName}</span>
        <span class='basicSep'> / </span>
        <span class='${clsAuthorHandle}'>${handle}</span>
      </a>
      `;
    },

    renderPostBody: function(post, site) {
      const reposterElm = RENDER.POST.renderRepostedBy(post, site);
      const postTimeElm = RENDER.POST.renderPostTime(post);
      const replyToElm = RENDER.POST.renderReplyTo(post, site);
      const contentElm = RENDER.POST.renderPostContent(post);
      const statsElm = RENDER.POST.renderStats(post);

      return `
        <div class='container'>
          <div>
            ${reposterElm}
          </div>
          <div class='postHeadline row'>
            <div class='col-sm-auto' style='padding-right:0px;'>
              ${RENDER.POST.renderPostAuthorImg(post, site, 'postAuthorLink', 'postAuthorImg')}
            </div>
            <div class='col'>
              <div class='row'>
                <div>
                  ${RENDER.POST.renderAuthorName(post.AuthorHandle, post.AuthorName, site, 'postAuthorName', 'postAuthorHandle', 'postAuthorLink')}
                  <span class='basicSep'> | </span>
                  <a href='${STR.expandTweetUrl(post.PostUrlKey)}' target='_blank'><i class='bi-twitter'></i></a>
                  ${postTimeElm}
                </div>
              </div>
              <div class='row'>
                ${statsElm}
              </div>
            </div>
          </div>
          <div class='row'>
            ${contentElm}
            ${replyToElm}
          </div>
        </div>
        `;
    },
    
    renderPost: function(post, site) {
      const body = RENDER.POST.renderPostBody(post, site);
      let qt = '';
      if (post.QuoteTweet) {
        qt = RENDER.POST.renderPostBody(post.QuoteTweet, site);
        qt = `
        <div class='quotedPost'>
        ${qt}
        </div>
        `;
      }

      return `
      <div class='socialPost row striped pt-1'>
        ${body}
        ${qt}
      </div>`;
    }
  },

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
    const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());
    
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
      const mdonLinkCls = site === SITE.MASTODON ? ` class='${CLS.MASTODON.ACCOUNT_LINK}'` : '';
      img = `<a href='${profileUrl}' target='_blank'${mdonLinkCls}>${img}</a>`;
    }

    const sansAt = STR.stripPrefix(handle, '@');
    const preparedDisplayName = RENDER.prepareDisplayText(displayName, withAnchors, renderAnchorsRule);
    let preparedDetail = RENDER.prepareDisplayText(detail, withAnchors, renderAnchorsRule);
  
    if (filtered === true) {
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

      let followOneCls = '';
      let followOneInitialText = '';
      let followOneStyle = 'float:right;';

      if (person.ImFollowingOnMdon == true) {
        followOneCls = `text-success ${CLS.MASTODON.FOLLOW_ONE_CONTAINER} ${CLS.MASTODON.FOLLOWING_ALREADY}`;
        // ready to render (no additional information required for the follow-on renderFollowOnMastodonButtons step that's based on a placeholder approach)
        followOneStyle = `${followOneStyle}display:block;`;
        followOneInitialText = 'Following';
      }
      else {
        followOneCls = `${CLS.MASTODON.FOLLOW_ONE_CONTAINER} ${CLS.MASTODON.FOLLOW_ONE_PLACEHOLDER}`;
        followOneStyle = `${followOneStyle}display:none;`;
      }

      return `<div class='person row striped pt-1' ${roleInfo}>
      <div class='col-sm-auto'><a href='#' class='canstar' data-testid='${sansAt}'><i class='${starCls}'></i></a></div>
      <div class='col-sm-auto personImg'>${img}</div>
      <div class='col personLabel'>
        <div>
          <span class='personHandle'>${renderedHandle}</span>${followInfo}
          <div class='${followOneCls}' style='${followOneStyle}'><i class='bi-mastodon'></i> <span class='${CLS.MASTODON.FOLLOW_ONE_SPAN}'>${followOneInitialText}</span></div>
        </div>
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
    
    return `<a href='${url}' target='_blank' class='${CLS.MASTODON.ACCOUNT_LINK}'>${display}</a>`;
  },

  // regex101.com/r/ac4fG5/1
  // @scafaria@toad.social
  renderMastodon1Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_MDON1, function(match, handle, domain) {
      if (STR.MASTODON.isImposterServer(domain)) {
        // the regex isn't perfect; also needs to rule out imposter servers
        return match;
      }
      else {
        return RENDER.renderMastodonAnchor(match, handle, domain);
      }
    });
  },

  // toad.social/@scafaria or https://toad.social/@scafaria
  renderMastodon2Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_MDON2, function(match, http, www, domain, handle) {
      if (STR.MASTODON.isImposterServer(domain)) {
        // the regex isn't perfect; also needs to rule out imposter servers
        return match;
      }
      else {
        return RENDER.renderMastodonAnchor(match, handle, domain);
      }
    });
  },

  // scafaria@toad.social
  // note the missed starting @ -- and instead of trying to keep up with all the server instances
  // we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
  renderMastodon3Anchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_MDON3, function(match, handle, domain) {
      if (STR.MASTODON.isImposterServer(domain)) {
        // the regex isn't perfect; also needs to rule out imposter servers
        return match;
      }
      else {
        return RENDER.renderMastodonAnchor(match, handle, domain);
      }
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