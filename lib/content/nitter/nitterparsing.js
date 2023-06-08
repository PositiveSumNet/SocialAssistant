var NPARSE = {
  getNitterTimelineColumn: function(warn) {
    const elms = document.querySelectorAll('.timeline');
    
    if (elms && elms.length === 1) {
      return elms[0];
    }
    else {
      if (warn === true) {
        console.warn('Cannot find nitter main column; page structure may have changed.');
      }
    }
  },

  getTweetElms: function(scopeElem) {
    // all img elms with src that starts with the tell-tale prefix
    return Array.from(scopeElem.querySelectorAll('.timeline-item'));
  },

  normalizeNitterRefdUrls: function(txt) {
    
  }

};