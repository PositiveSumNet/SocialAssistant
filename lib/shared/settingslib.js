var SETTINGS = {
  
  // setting names
  AGREED_TO_TERMS: 'agreedToTerms',
  RECORDING: 'recording',
  ASKED: {
    MDON_SERVER: 'askedMdonServer'
  },
  MDON_SERVER: 'mdonServer',
  PAGING: {
    PAGE_SIZE: 'pageSize'
  },
  PAGE_CONTEXT: {
    NETWORK_OWNER: 'networkOwner',
    PAGE_TYPE: 'pageType'
  },
  
  // to/from settings cache/localStorage or chrome.storage.local
  getMdonServer: function() {
    return localStorage.getItem(SETTINGS.MDON_SERVER);
  },
  
  getAskedMdonServer: function() {
    return localStorage.getItem(SETTINGS.ASKED.MDON_SERVER);
  },
  
  getPageSize: function() {
    let size = parseInt(localStorage.getItem(SETTINGS.PAGING.PAGE_SIZE));
    if (isNaN(size)) { size = 50 };
    return size;
  },

  getCachedOwner: function() {
    return localStorage.getItem(SETTINGS.PAGE_CONTEXT.NETWORK_OWNER);
  },

  getCachedPageType: function() {
    return localStorage.getItem(SETTINGS.PAGE_CONTEXT.PAGE_TYPE);
  },

  cachePageState: function(msg) {
    if (!msg) { return; }
    
    if (msg.networkOwner) {
      localStorage.setItem(SETTINGS.PAGE_CONTEXT.NETWORK_OWNER, msg.networkOwner);
    }
    
    if (msg.pageType) {
      localStorage.setItem(SETTINGS.PAGE_CONTEXT.PAGE_TYPE, msg.pageType);
    }
  }

  
}