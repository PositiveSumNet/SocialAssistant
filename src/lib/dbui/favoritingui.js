var FAVORITING_UI = {
  configureFavoriting: function(a) {
    a.onclick = function(event) {
      const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
      const site = PAGETYPE.getSite(pageType);

      const handle = a.getAttribute('data-testid');
      const atHandle = STR.ensurePrefix(handle, '@');
      const iconElm = a.querySelector('i');
      
      const alreadyFavorited = iconElm.classList.contains(RENDER.CLS.STAR_ON_CLS);
      let removeFromFavorites;
      if (alreadyFavorited) {
        // toggle to not-favorite
        FAVORITING_UI.applyToAll(handle, false);
        removeFromFavorites = true;
      }
      else {
        // toggle to is-favorite
        FAVORITING_UI.applyToAll(handle, true);
        removeFromFavorites = false;
      }
      
      // tell the db (see DBORM.setListMember)
      const msg = {
        actionType: MSGTYPE.TODB.SET_LIST_MEMBER, 
        list: LIST_FAVORITES, 
        member: atHandle, 
        site: site,
        removal: removeFromFavorites
      };
      
      _worker.postMessage(msg);
      return false;
    };
  },

  // applies star status to not just this anchor, but all its brethren
  applyToAll: function(handle, starIt) {
    const anchors = Array.from(document.querySelectorAll('a.canstar')).filter(function(a) {
      return a.getAttribute('data-testid') == handle;
    });
    
    for (let i = 0; i < anchors.length; i++) {
      let anchor = anchors[i];
      let iconElm = anchor.querySelector('i');
      if (starIt == true) {
        iconElm.classList.remove(RENDER.CLS.STAR_OFF_CLS);
        iconElm.classList.add(RENDER.CLS.STAR_ON_CLS);
      }
      else {
        iconElm.classList.remove(RENDER.CLS.STAR_ON_CLS)
        iconElm.classList.add(RENDER.CLS.STAR_OFF_CLS);
      }
    }
  }
};