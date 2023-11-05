// more tightly coupled to the rest of the UI than renderlib.js
var RENDERBIND_UI = {
  bindEvents: function() {
    // companion to the above pushState so that back button works
    window.addEventListener("popstate", async function(event) {
      if (_docLocSearch != document.location.search) {
        await RENDERBIND_UI.initialRender(true);
      }
    });
  },
  
  initialRender: async function(leaveHistoryStackAlone) {
    // app version
    document.getElementById('manifestVersion').textContent = chrome.runtime.getManifest().version;

    // ensure _topicTags are in place
    RENDER.POST.TAGGING.initTopicTags();
    
    const parms = URLPARSE.getQueryParms();

    let owner = parms[URL_PARM.OWNER];
    let pageType = parms[URL_PARM.PAGE_TYPE];
    let topic = parms[URL_PARM.TOPIC];
    let threadUrlKey = parms[URL_PARM.THREAD];

    if (!pageType) {
      pageType = SETTINGS.getCachedPageType();
    }
    
    let site;
    if (pageType) {
      site = PAGETYPE.getSite(pageType);
      SETTINGS.cacheSite(site);
    }
    else {
      site = SETTINGS.getCachedSite();
    }

    QUERYING_UI.PAGE_TYPE.updateUiForCachedSite();

    // pageType/direction
    let autoResolveOwner = true;
    pageType = pageType || SETTINGS.getCachedPageType() || PAGETYPE.TWITTER.FOLLOWING;

    switch (pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
      case PAGETYPE.MASTODON.FOLLOWERS:
          document.getElementById('cmbType').value = CONN_DIRECTION.FOLLOWERS;
        break;
      case PAGETYPE.TWITTER.FOLLOWING:
      case PAGETYPE.MASTODON.FOLLOWING:
          document.getElementById('cmbType').value = CONN_DIRECTION.FOLLOWING;
        break;
      case PAGETYPE.TWITTER.TWEETS:
        document.getElementById('cmbType').value = POSTS;
        autoResolveOwner = false;
        break;
      case PAGETYPE.MASTODON.TOOTS:
        // TEMPORARY - until mastodon toots are ready    
        document.getElementById('cmbType').value = CONN_DIRECTION.FOLLOWING; // POSTS;
        autoResolveOwner = false;
        break;
      case PAGETYPE.GITHUB.CONFIGURE:
      case PAGETYPE.GITHUB.BACKUP:
      case PAGETYPE.GITHUB.RESTORE:
        autoResolveOwner = false;
        break;
      default:
        break;
    }

    // set owner
    let waitForOwnerCallback = false;
    if (autoResolveOwner) {
      owner = owner || SETTINGS.getCachedOwner();
      
      if (!owner || owner.length === 0) {
        // we'll initialize to empty string, but 
        // we'll tell the _worker to call us back with the most sensible initial value
        const msg = { 
          actionType: MSGTYPE.TODB.SUGGEST_OWNER, 
          pageType: pageType
        };
        
        waitForOwnerCallback = true;
        _worker.postMessage(msg);
      }
    }

    // SEARCH
    document.getElementById('txtSearch').value = parms[URL_PARM.SEARCH] || '';

    // PAGING
    let page = parms[URL_PARM.PAGE];
    if (!page || isNaN(page) == true) {
      page = 1;
    }
    document.getElementById('txtPageNum').value = page;

    // post toggles
    // WITH_RETWEETS
    const optWithRetweets = document.getElementById('optWithRetweets');
    QUERYING_UI.FILTERS.setOptToggleBtn(optWithRetweets, parms[URL_PARM.WITH_RETWEETS] != 'false'); // default to true

    // TOPIC
    const optGuessTopics = document.getElementById('optGuessTopics');
    QUERYING_UI.FILTERS.setOptToggleBtn(optGuessTopics, parms[URL_PARM.GUESS_TOPICS] == 'true'); // default to false
    QUERYING_UI.FILTERS.TOPICS.setTopicFilterChoiceInUi(topic);
    // THREAD
    QUERYING_UI.THREAD.setOneThreadState(threadUrlKey);
    // post sort
    QUERYING_UI.ORDERING.setTopicSortInUi();

    QUERYING_UI.FILTERS.setQueryOptionVisibility();

    document.getElementById('txtOwnerHandle').value = STR.stripPrefix(owner, '@') || '';
    
    if (waitForOwnerCallback === false) {
      
      switch (site) {
        case SITE.GITHUB:
          await TABS_UI.SYNC.activateGithubTab(pageType);
          _docLocSearch = document.location.search; // aids our popstate behavior
          break;
        default:
          QUERYWORK_UI.executeSearch(owner, leaveHistoryStackAlone, topic);
          break;
      }
    }
  },
  
  renderPostStream: function(payload) {
    QUERYING_UI.initMainListUiElms();
    const plist = document.getElementById('paginated-list');
    let html = '';
    // rows
    const rows = payload.rows;
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
        // renderPost uses DOMPurify.sanitize
        html += RENDERBIND_UI.renderPost(row);
    }
  
    plist.innerHTML = html;
    QUERYING_UI.SEARCH.showSearchProgress(false);
    RENDERBIND_UI.onAddedRows(plist);
  
    _lastRenderedRequest = JSON.stringify(payload.request);
  },
  
  renderPost: function(post) {
    const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    const site = PAGETYPE.getSite(pageType);
    return RENDER.POST.renderPost(post, site);
  },

  renderConnections: function(payload) {
    QUERYING_UI.initMainListUiElms();
    const plist = document.getElementById('paginated-list');
    let html = '';
  
    // rows
    const rows = payload.rows;
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
        // renderPerson uses DOMPurify.sanitize
        html += RENDERBIND_UI.renderPerson(row, 'followResult');
    }
  
    plist.innerHTML = html;
  
    IMAGE.resolveDeferredLoadImages(plist);
    if (SETTINGS_UI.canRenderMastodonFollowOneButtons() === true) {
      MASTODON.renderFollowOnMastodonButtons(plist);
    }
    
    QUERYING_UI.SEARCH.showSearchProgress(false);
    RENDERBIND_UI.onAddedRows(plist);
    QUERYWORK_UI.requestTotalCount();
    
    _lastRenderedRequest = JSON.stringify(payload.request);
  },
  
  renderPerson: function(person, context) {
    const renderAnchorsRule = RENDERBIND_UI.getPersonRenderAnchorsRule();
    const filtered = QUERYING_UI.FILTERS.detailReflectsFilter();
    return RENDER.PERSON.renderPerson(person, context, renderAnchorsRule, filtered);
  },
  
  renderMatchedOwners: function(payload) {
    const owners = payload.owners;
    const listOwnerPivotPicker = document.getElementById('listOwnerPivotPicker');
    const txtOwnerHandle= document.getElementById('txtOwnerHandle');

    listOwnerPivotPicker.replaceChildren();
    
    if (owners.length === 1 && !_deletingOwner) {
      // exact match; pick it! (after an extra check that the user isn't 
      // trying to delete, in which case auto-complete would be annoying)
      txtOwnerHandle.value = STR.stripPrefix(owners[0].Handle, '@');
      QUERYWORK_UI.onChooseOwner();
    }
    else {
      for (i = 0; i < owners.length; i++) {
        // renderPerson uses DOMPurify.sanitize
        listOwnerPivotPicker.innerHTML += RENDERBIND_UI.renderPerson(owners[i], 'owner');
      }
      
      IMAGE.resolveDeferredLoadImages(listOwnerPivotPicker);
    }
  },
  
  onAddedRows: function(container) {
    // tag & rate
    Array.from(container.getElementsByClassName('postScoredTagger')).forEach(elm => RENDER.POST.TAGGING.configureTagAndRate(elm));
    Array.from(container.getElementsByClassName('postAnotherTag')).forEach(elm => RENDER.POST.TAGGING.configureAddAnotherTag(elm));
    Array.from(container.getElementsByClassName('postTagCancel')).forEach(elm => RENDER.POST.TAGGING.cancelTagEdits(elm));
    // view thread
    Array.from(container.getElementsByClassName('btnViewThread')).forEach(elm => QUERYING_UI.THREAD.configureViewThread(elm));
    // delete (and confirm)
    Array.from(container.getElementsByClassName('btnDelPost')).forEach(elm => QUERYING_UI.DELETION.configureDeletePost(elm));
    Array.from(container.getElementsByClassName('btnDelPostConfirm')).forEach(elm => QUERYING_UI.DELETION.configureDeletePostConfirmed(elm));
    Array.from(container.getElementsByClassName('btnDelPostCancel')).forEach(elm => QUERYING_UI.DELETION.configureDeletePostCanceled(elm));
    // simple favoriting
    Array.from(container.getElementsByClassName("canstar")).forEach(a => FAVORITING_UI.configureFavoriting(a));
    // video elements
    Array.from(container.querySelectorAll('.embedsVideo .videoHeader a')).forEach(a => RENDERBIND_UI.configureGetEmbeddedVideo(a));
  },
  
  renderSuggestedOwner: function(payload) {
    const owner = payload.owner;
    if (!owner || !owner.Handle || owner.Handle.length === 0) {
      return;
    }
    
    const value = document.getElementById('txtOwnerHandle').value;
    
    if (!value || value.length === 0) {
      document.getElementById('txtOwnerHandle').value = owner.Handle;
      // we're doing a page init and so far it's empty, so let's
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    }
  },

  // guides us as to which links to look for (e.g. so that if we're focused on mdon we don't distract the user with rendered email links)
  getPersonRenderAnchorsRule: function() {
    if (document.getElementById('optWithMdon').checked === true) {
      return RENDER_CONTEXT.ANCHORS.MDON_ONLY;
    }
    else if (document.getElementById('optWithEmail').checked === true) {
      return RENDER_CONTEXT.ANCHORS.EMAIL_ONLY;
    }
    else if (document.getElementById('optWithUrl').checked === true) {
      return RENDER_CONTEXT.ANCHORS.EXTURL_ONLY;
    }
    else {
      return RENDER_CONTEXT.ANCHORS.ALL;
    }
  },

  configureGetEmbeddedVideo: function(a) {
    a.onclick = async function(event) {
      event.preventDefault();
      await RENDERBIND_UI.onRequestEmbeddedVideo(a);
      return false;
    }
  },

  onRequestEmbeddedVideo: async function(a) {
    const postUrlKey = RENDER.POST.getPostUrlKey(a);
    const b64DataUri = await GITHUB.VIDEOS.resolveB64DataUri(postUrlKey);
    
    if (STR.hasLen(b64DataUri)) {
      const imgContainer = ES6.findUpClass(a, 'postContentImg');
      const mediaParent = imgContainer.querySelector('.mediaContainer');
      const imgElm = mediaParent.querySelector('img');
      const videoElm = ES6.swapImgForVideo(mediaParent, imgElm, b64DataUri);
      videoElm.loop = true;
    }
    else {
      // best we can do is launch it via squidlr
      const videoRes = SETTINGS.RECORDING.VIDEO_EXTRACTION.getPreferredVideoRes();
      const squidlrUrl = STR.buildSquidlrUrl(postUrlKey, videoRes, true);
      window.open(squidlrUrl, '_blank');
      a.querySelector('span').textContent = 'Video launched and downloaded in a separate tab. For inline viewing, try the Backups tab -> Upload Videos feature.';
      a.classList.remove('fw-bold');
      a.classList.add('small');
    }
  }
};