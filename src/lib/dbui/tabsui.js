var TABS_UI = {

  bindElements: function() {
    document.getElementById('ghConfigDataTab').onclick = async function(event) {
      GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.DATA);
      await GHCONFIG_UI.reflectGithubTokenStatus();
      return false;
    }
    document.getElementById('ghConfigVideosTab').onclick = async function(event) {
      GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.VIDEOS);
      await GHCONFIG_UI.reflectGithubTokenStatus();
      return false;
    }
    
    document.getElementById('btnCancelGithubToken').onclick = async function(event) {
      // the goal is to switch back to the tab of the token type that we do have
      const hasDataToken = await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.DATA);
      const hasVideoToken = await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.VIDEOS);
      if (hasDataToken == true) {
        GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.DATA);
      }
      else if (hasVideoToken == true) {
        GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.VIDEOS);
      }
      await GHCONFIG_UI.reflectGithubTokenStatus();
      return false;
    }
    
    document.getElementById('ghConfigureTab').onclick = async function(event) {
      await TABS_UI.SYNC.activateGhConfigureTab();
      return false;
    }
    document.getElementById('ghBackupTab').onclick = async function(event) {
      await TABS_UI.SYNC.activateGhBackupTab();
      return false;
    }
    document.getElementById('ghRestoreTab').onclick = async function(event) {
      await TABS_UI.SYNC.activateGhRestoreTab();
      return false;
    }

    document.getElementById('twitterLensBtn').onclick = function(event) {
      const site = SETTINGS.getCachedSite();
    
      if (site != SITE.TWITTER) {
        SETTINGS.cacheSite(SITE.TWITTER);
        QUERYING_UI.PAGE_TYPE.updateUiForCachedSite(true);
        QUERYWORK_UI.executeSearch();
      }
    
      return false;
    };
    
    document.getElementById('mastodonLensBtn').onclick = function(event) {
      TABS_UI.activateMastodonTab();
      return false;
    };
    
    document.getElementById('githubLensBtn').onclick = async function(event) {
      await TABS_UI.SYNC.activateGithubTab();
      return false;
    };
    
  },

  activateMastodonTab: function() {
    const site = SETTINGS.getCachedSite();

    if (site != SITE.MASTODON) {
      SETTINGS.cacheSite(SITE.MASTODON);
      QUERYING_UI.PAGE_TYPE.updateUiForCachedSite(true);
      QUERYWORK_UI.executeSearch();
    }
  },

  SYNC: {
    activateGithubTab: async function(pageType) {
      pageType = pageType || SETTINGS.getCachedPageType(SITE.GITHUB);
      const site = SETTINGS.getCachedSite();
      if (site != SITE.GITHUB) {
        SETTINGS.cacheSite(SITE.GITHUB);
        QUERYING_UI.PAGE_TYPE.updateUiForCachedSite(true);
      }
    
      await TABS_UI.SYNC.unveilGithubUi(pageType);
    },
    
    unveilGithubUi: async function(pageType) {
      switch (pageType) {
        case PAGETYPE.GITHUB.BACKUP:
          await TABS_UI.SYNC.activateGhBackupTab();
          break;
        case PAGETYPE.GITHUB.RESTORE:
          await TABS_UI.SYNC.activateGhRestoreTab();
          break;
        case PAGETYPE.GITHUB.CONFIGURE:
        default:
          await TABS_UI.SYNC.activateGhConfigureTab();
          break;
      }
    },
    
    getActiveSyncTabPageTypeFromUi: function() {
      if (document.getElementById('ghRestoreTab').classList.contains('active')) {
        return PAGETYPE.GITHUB.RESTORE;
      }
      else if (document.getElementById('ghBackupTab').classList.contains('active')) {
        return PAGETYPE.GITHUB.BACKUP;
      }
      else {
        return PAGETYPE.GITHUB.CONFIGURE;
      }
    },
    
    setActiveSyncTabPageType: async function(pageType) {
      const backupTab = document.getElementById('ghBackupTab');
      const restoreTab = document.getElementById('ghRestoreTab');
      const configureTab = document.getElementById('ghConfigureTab');
    
      if (pageType == PAGETYPE.GITHUB.RESTORE) {
        restoreTab.classList.add('active');
        
        if (backupTab.classList.contains('active')) {
          backupTab.classList.remove('active');
        }
        if (configureTab.classList.contains('active')) {
          configureTab.classList.remove('active');
        }
        
        restoreTab.setAttribute('aria-current', 'page');
        backupTab.removeAttribute('aria-current');
        configureTab.removeAttribute('aria-current');
      }
      else if (pageType == PAGETYPE.GITHUB.BACKUP) {
        backupTab.classList.add('active');
        
        if (restoreTab.classList.contains('active')) {
          restoreTab.classList.remove('active');
        }
        if (configureTab.classList.contains('active')) {
          configureTab.classList.remove('active');
        }
        
        backupTab.setAttribute('aria-current', 'page');
        restoreTab.removeAttribute('aria-current');
        configureTab.removeAttribute('aria-current');
      }
      else {
        // configure tab
        configureTab.classList.add('active');
        
        if (restoreTab.classList.contains('active')) {
          restoreTab.classList.remove('active');
        }
        if (backupTab.classList.contains('active')) {
          backupTab.classList.remove('active');
        }
        
        configureTab.setAttribute('aria-current', 'page');
        restoreTab.removeAttribute('aria-current');
        backupTab.removeAttribute('aria-current');
      }
    
      QUERYING_UI.QUERY_STRING.conformAddressBarUrlQueryParmsToUi(false);
      const cacheKey = SETTINGS.pageTypeCacheKey(SITE.GITHUB);
      localStorage.setItem(cacheKey, pageType);
    },
    
    activateGhConfigureTab: async function() {
      await GHCONFIG_UI.reflectGithubTokenStatus(); 
      await TABS_UI.SYNC.setActiveSyncTabPageType(PAGETYPE.GITHUB.CONFIGURE);
      document.getElementById('configureSyncUi').style.display = 'block';
      document.getElementById('backupUi').style.display = 'none';
      document.getElementById('restoreUi').style.display = 'none';
    },

    activateGhBackupTab: async function() {
      await TABS_UI.SYNC.setActiveSyncTabPageType(PAGETYPE.GITHUB.BACKUP);
      document.getElementById('configureSyncUi').style.display = 'none';
      document.getElementById('backupUi').style.display = 'block';
      document.getElementById('restoreUi').style.display = 'none';
      await GHBACKUP_UI.renderSyncBackupStatus();
    },

    activateGhRestoreTab: async function() {
      await TABS_UI.SYNC.setActiveSyncTabPageType(PAGETYPE.GITHUB.RESTORE);
      document.getElementById('configureSyncUi').style.display = 'none';
      document.getElementById('backupUi').style.display = 'none';
      document.getElementById('restoreUi').style.display = 'block';
      await GHRESTORE_UI.renderSyncRestoreStatus();
    }
  }
};