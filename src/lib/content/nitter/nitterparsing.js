var NPARSE = {
  isErrorPage: function() {
    const errorPanel = document.querySelector('.error-panel');
    if (errorPanel && errorPanel.textContent == 'Tweet not found') {
      return true;
    }
    else {
      return false;
    }
  },
  
  getMainColumn: function(warn) {
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
  }
};