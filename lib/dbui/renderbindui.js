// more tightly coupled to the rest of the UI than renderlib.js
var RENDERBIND_UI = {
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
    Array.from(container.querySelectorAll('.embedsVideo .videoHeader a')).forEach(a => SQUIDDY.configureGetEmbeddedVideo(a));
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
  }
};