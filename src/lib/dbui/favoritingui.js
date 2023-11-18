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
        iconElm.classList.remove(RENDER.CLS.STAR_ON_CLS)
        iconElm.classList.add(RENDER.CLS.STAR_OFF_CLS);
        removeFromFavorites = true;
      }
      else {
        // toggle to is-favorite
        if (iconElm.classList.contains(RENDER.CLS.STAR_OFF_CLS)) {
          iconElm.classList.remove(RENDER.CLS.STAR_OFF_CLS);
        }
        iconElm.classList.add(RENDER.CLS.STAR_ON_CLS);
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
  }
};