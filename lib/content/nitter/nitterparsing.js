var NPARSE = {
  getNitterMainColumn: function(warn) {
    // main timeline
    let elms = document.querySelectorAll('.timeline');
    
    if (elms && elms.length === 1) {
      return elms[0];
    }

    // detail page for a conversation thread
    elms = document.querySelectorAll('.conversation');
    if (elms && elms.length === 1) {
      return elms[0];
    }

    if (warn === true) {
      console.warn('Cannot find nitter main column; page structure may have changed.');
    }
  },

  getTweetElms: function(scopeElem) {
    // all img elms with src that starts with the tell-tale prefix
    return Array.from(scopeElem.querySelectorAll('.timeline-item')).filter(function(elm) {
      // exclude the 'Load newest' button
      return elm.classList.contains('show-more') == false && 
              elm.classList.contains('more-replies') == false &&
              elm.classList.contains('unavailable') == false;
    });
  }

};