var FAVORITING_UI = {
  configureFavoriting: function(a) {
    a.onclick = function(event) {
      const pageType = getPageType();
      const handle = this.getAttribute('data-testid');
      const atHandle = STR.ensurePrefix(handle, '@');
      const iconElm = this.querySelector('i');
      
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
        pageType: pageType,
        removal: removeFromFavorites
      };
      
      worker.postMessage(msg);
      return false;
    };
  }
};