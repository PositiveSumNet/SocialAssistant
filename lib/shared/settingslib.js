var SETTINGS = {
  
  // setting names
  AGREED_TO_TERMS: 'agreedToTerms',
  RECORDING: 'recording',
  ASKED: {
    MDON_SERVER: 'askedMdonServer',
    MDON_EXPLAINED_OAUTH: 'explainedMdonOauth'
  },
  MDON_SERVER: 'mdonServer',
  PAGING: {
    PAGE_SIZE: 'pageSize'
  },
  PAGE_CONTEXT: {
    NETWORK_OWNER: 'networkOwner',
    PAGE_TYPE: 'pageType',
    SITE: 'site'
  },
  DOWNLOADED_OK: {
    MASTODON: 'downloadedMdonOk'
  },
  
  getMdonServer: function() {
    return localStorage.getItem(SETTINGS.MDON_SERVER);
  },
  
  getAskedMdonServer: function() {
    return localStorage.getItem(SETTINGS.ASKED.MDON_SERVER);
  },
  
  getExplainedMdonOauth: function() {
    return localStorage.getItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH);
  },
  
  setExplainedMdonOauth: function() {
    localStorage.setItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH, true);
  },
  
  clearExplainedMdonOauth: function() {
    localStorage.removeItem(SETTINGS.ASKED.MDON_EXPLAINED_OAUTH);
  },
  
  hadSuccessfulMdonDownload: function() {
    return localStorage.getItem(SETTINGS.DOWNLOADED_OK.MASTODON);
  },

  markMdonDownloadSuccess: function() {
    localStorage.setItem(SETTINGS.DOWNLOADED_OK.MASTODON, true);
  },

  getPageSize: function() {
    let size = parseInt(localStorage.getItem(SETTINGS.PAGING.PAGE_SIZE));
    if (isNaN(size)) { size = 50 };
    return size;
  },

  ownerCacheKey: function(site) {
    if (site) {
      return `${SETTINGS.PAGE_CONTEXT.NETWORK_OWNER}-${site}`;
    }
    else {
      // legacy (before we cached it per-site)
      return SETTINGS.PAGE_CONTEXT.NETWORK_OWNER;
    }
  },

  pageTypeCacheKey: function(site) {
    if (site) {
      return `${SETTINGS.PAGE_CONTEXT.PAGE_TYPE}-${site}`;
    }
    else {
      // legacy (before we cached it per-site)
      return SETTINGS.PAGE_CONTEXT.PAGE_TYPE;
    }
  },

  getCachedOwner: function() {
    const site = SETTINGS.getCachedSite();
    // backward compatibility
    return localStorage.getItem(SETTINGS.ownerCacheKey(site)) || 
      (site === SITE.TWITTER ? localStorage.getItem(SETTINGS.ownerCacheKey()) : '');
  },

  getCachedPageType: function(site) {
    if (!site) {
      site = SETTINGS.getCachedSite();
    }
    // backward compatibility
    return localStorage.getItem(SETTINGS.pageTypeCacheKey(site)) || 
            (site === SITE.TWITTER ? localStorage.getItem(SETTINGS.pageTypeCacheKey()) : '');
  },

  getCachedSite: function() {
    return localStorage.getItem(SETTINGS.PAGE_CONTEXT.SITE) || SITE.TWITTER;
  },

  cacheSite: function(site) {
    localStorage.setItem(SETTINGS.PAGE_CONTEXT.SITE, site);
  },

  cachePageState: function(msg) {
    if (!msg) { return; }
    
    if (msg.site) {
      SETTINGS.cacheSite(msg.site);
    }
    
    if (msg.networkOwner) {
      const cacheKey = SETTINGS.ownerCacheKey(msg.site);
      localStorage.setItem(cacheKey, msg.networkOwner);
    }
    
    if (msg.pageType) {
      const cacheKey = SETTINGS.pageTypeCacheKey(msg.site);
      localStorage.setItem(cacheKey, msg.pageType);
    }
  }
  
};