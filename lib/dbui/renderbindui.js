// more tightly coupled to the rest of the UI than renderlib.js
var RENDERBIND_UI = {
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
    const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    // tag & rate
    Array.from(container.getElementsByClassName('postScoredTagger')).forEach(elm => RENDER.POST.TAGGING.configureTagAndRate(elm, pageType));
    Array.from(container.getElementsByClassName('postAnotherTag')).forEach(elm => RENDER.POST.TAGGING.configureAddAnotherTag(elm, pageType));
    // view thread
    Array.from(container.getElementsByClassName('btnViewThread')).forEach(elm => QUERYING_UI.THREAD.configureViewThread(elm));
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
    a.onclick = function(event) {
      const postUrlKey = RENDER.POST.getPostUrlKey(a);
      const videoRes = SETTINGS.RECORDING.VIDEO_EXTRACTION.getPreferredVideoRes();
      const squidlrUrl = STR.buildSquidlrUrl(postUrlKey, videoRes, true);
      window.open(squidlrUrl, '_blank');
      a.querySelector('span').textContent = 'Video launched and downloaded in a separate tab. Next time, try "Extract Videos" from our popup menu and then use the Backups -> Upload Videos feature.';
      a.classList.remove('fw-bold');
      a.classList.add('small');
      return false;
    }
  }
};