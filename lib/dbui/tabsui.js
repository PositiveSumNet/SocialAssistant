var TABS_UI = {

  SYNC: {
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
    }
  }
};