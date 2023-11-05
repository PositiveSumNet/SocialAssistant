var GHBACKUP_UI = {
  bindElements: function() {
    Array.from(document.querySelectorAll('#exportFilterSection input[type="checkbox"]')).forEach(function(input) {
      input.addEventListener('change', (event) => {
        GHBACKUP_UI.saveBackupSettingsFromUi();
      });
    });
    
    Array.from(document.querySelectorAll('#exportFilterSection input[type="text"]')).forEach(function(input) {
      input.addEventListener('blur', (event) => {
        GHBACKUP_UI.saveBackupSettingsFromUi();
      });
    });
    
    const btnDismissGhMfaTip = document.getElementById('btnDismissGhMfaTip');
    btnDismissGhMfaTip.onclick = function(event) {
      document.getElementById('ghMfaSection').classList.add('d-none');
      SETTINGS.GITHUB.setDismissedMfaNote();
      return false;
    };
    
    const btnSwitchToConfigVideos = document.getElementById('btnSwitchToConfigVideos');
    btnSwitchToConfigVideos.onclick = async function(event) {
      GHCONFIG_UI.setGithubConfigRepoTypeTab(GITHUB.REPO_TYPE.VIDEOS);
      await activateGhConfigureTab();
      return false;
    }
    
    const btnGhBkpStart = document.getElementById('btnGhBkpStart');
    btnGhBkpStart.onclick = async function(event) {
      GHBACKUP_UI.saveBackupSettingsFromUi();
      btnGhBkpPause.classList.remove('d-none');
      btnGhBkpStart.classList.add('d-none');
      btnGhBkpRestart.classList.add('d-none');
      await SYNCFLOW.resumeSync(SYNCFLOW.DIRECTION.BACKUP);
      return false;
    };
    
    const btnGhBkpPause = document.getElementById('btnGhBkpPause');
    btnGhBkpPause.onclick = function(event) {
      btnGhBkpPause.classList.add('d-none');
      btnGhBkpStart.classList.remove('d-none');
      btnGhBkpRestart.classList.remove('d-none');
      SYNCFLOW.pauseSync(SYNCFLOW.DIRECTION.BACKUP);
      return false;
    };
    
    const btnGhBkpRestart = document.getElementById('btnGhBkpRestart');
    btnGhBkpRestart.onclick = async function(event) {
      GHBACKUP_UI.saveBackupSettingsFromUi();
      btnGhBkpPause.classList.remove('d-none');
      btnGhBkpStart.classList.add('d-none');
      btnGhBkpRestart.classList.add('d-none');
      await SYNCFLOW.startOverSync(SYNCFLOW.DIRECTION.BACKUP);
      return false;
    };
  },
  
  renderSyncBackupStatus: async function(status) {
    const hideTip = SETTINGS.GITHUB.getDismissedMfaNote();
    const tipElm = document.getElementById('ghMfaSection');
    if (hideTip == true) {
      tipElm.classList.add('d-none');
    }
    else {
      tipElm.classList.remove('d-none');
    }
    
    status = status || SYNCFLOW.buildStatus(SYNCFLOW.DIRECTION.BACKUP);
    const statusElm = document.getElementById('ghBackupStatusMsg');
    statusElm.textContent = status.msg;
    const checkElm = document.getElementById('ghBackupStatusCheck');
    const exclamElm = document.getElementById('ghBackupStatusFail');
    if (status.ok === true) {
      checkElm.classList.remove('d-none');
      exclamElm.classList.add('d-none');
    }
    else if (status.ok === false) {
      checkElm.classList.add('d-none');
      exclamElm.classList.remove('d-none');
    }
    else {
      checkElm.classList.add('d-none');
      exclamElm.classList.add('d-none');
    }

    const skipIdenticalElm = statusElm.parentNode.querySelector('.priorSkipped');
    if (status.priorStepIdentical == true) {
      skipIdenticalElm.classList.remove('d-none');
    }
    else {
      skipIdenticalElm.classList.add('d-none');
    }
  
    // special handling of _backupStartedThisSession is in case running was calculated as true based on last step being very recent
    // but guarding against the case where the user hit F5 (and so it isn't actually running in this session)
    if (status.running === true && _backupStartedThisSession == true) {
      btnGhBkpPause.classList.remove('d-none');
      btnGhBkpStart.classList.add('d-none');
      btnGhBkpRestart.classList.add('d-none');
    }
    else {
      GHBACKUP_UI.reflectBackupSettings();
      btnGhBkpPause.classList.add('d-none');
      btnGhBkpStart.classList.remove('d-none');
  
      if (status.ok === true || status.msg == SYNCFLOW.START_MSG) {
        // we're at the beginning, so start and restart mean the same thing
        btnGhBkpRestart.classList.add('d-none');
      }
      else {
        btnGhBkpRestart.classList.remove('d-none');
      }
    }
  
    // Videos section
    const hasVideoConfig = await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.VIDEOS);
    GHBACKUP_UI.unveilUploaderAsNeeded(hasVideoConfig);
  },
  
  unveilUploaderAsNeeded: function(hasVideoRepoConn) {
    const needVideoConnElm = document.getElementById('needVideoConn');
    const uploaduiElm = document.getElementById('uploadui');
    if (hasVideoRepoConn) {
      needVideoConnElm.classList.add('d-none');
      uploaduiElm.classList.remove('d-none');
    }
    else {
      needVideoConnElm.classList.remove('d-none');
      uploaduiElm.classList.add('d-none');
    }
  },
  
  saveBackupSettingsFromUi: function() {
    const config = {};
    const ns = SETTINGS.SYNCFLOW.CONFIG;
    config[ns.WITH_FAVORITES] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_FAVORITES, 'optExportWithFavorites');
    config[ns.WITH_PROFILES] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_PROFILES, 'optExportWithProfiles');
    config[ns.WITH_AVATARS] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_AVATARS, 'optExportWithAvatars');
    config[ns.WITH_NETWORKS] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_NETWORKS, 'optExportWithNetworks');
    config[ns.WITH_TOPICS] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_TOPICS, 'optExportWithTopics');
    config[ns.WITH_POSTS] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_POSTS, 'optExportWithPosts');
    config[ns.WITH_POST_IMAGES] = GHBACKUP_UI.getBackupSettingFromUi(ns.WITH_POST_IMAGES, 'optExportWithPostImages');
    config[ns.DO_TWITTER] = GHBACKUP_UI.getBackupSettingFromUi(ns.DO_TWITTER, 'optExportTwitter');
    config[ns.DO_MASTODON] = GHBACKUP_UI.getBackupSettingFromUi(ns.DO_MASTODON, 'optExportMastodon');
    config[ns.AUTHOR_FILTER] = GHBACKUP_UI.getBackupSettingFromUi(ns.AUTHOR_FILTER, 'optExportForAuthor') || '';
    config[ns.POSTED_FROM] = GHBACKUP_UI.getBackupSettingFromUi(ns.POSTED_FROM, 'optExportPostsFrom') || '';
    config[ns.POSTED_UNTIL] = GHBACKUP_UI.getBackupSettingFromUi(ns.POSTED_UNTIL, 'optExportPostsUntil') || '';
    SETTINGS.SYNCFLOW.BACKUP.saveExportConfig(config);
  },
  
  reflectBackupSettings: function() {
    const config = SETTINGS.SYNCFLOW.BACKUP.getExportConfig();
    const ns = SETTINGS.SYNCFLOW.CONFIG;
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_FAVORITES, 'optExportWithFavorites');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_PROFILES, 'optExportWithProfiles');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_AVATARS, 'optExportWithAvatars');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_NETWORKS, 'optExportWithNetworks');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_TOPICS, 'optExportWithTopics');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_POSTS, 'optExportWithPosts');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.WITH_POST_IMAGES, 'optExportWithPostImages');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.DO_TWITTER, 'optExportTwitter');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.DO_MASTODON, 'optExportMastodon');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.AUTHOR_FILTER, 'optExportForAuthor');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.POSTED_FROM, 'optExportPostsFrom');
    GHBACKUP_UI.reflectBackupSettingInUi(config, ns.POSTED_UNTIL, 'optExportPostsUntil');
  },
  
  getBackupSettingFromUi: function(setting, elmId) {
    const elm = document.getElementById(elmId);
    if (elm.type == 'checkbox') {
      return elm.checked;
    }
    else if (setting == SETTINGS.SYNCFLOW.CONFIG.AUTHOR_FILTER) {
      return elm.value;
    }
    else if (setting == SETTINGS.SYNCFLOW.CONFIG.POSTED_FROM || setting == SETTINGS.SYNCFLOW.CONFIG.POSTED_UNTIL) {
      if (!STR.hasLen(elm.value)) {
        return null;
      }
      else {
        return STR.dateFromMmDdYyyy(elm.value, true);
      }
    }
  },

  reflectBackupSettingInUi: function(config, setting, elmId) {
    const elm = document.getElementById(elmId);
    if (elm.type == 'checkbox') {
      elm.checked = STR.isTruthy(config[setting]);
    }
    else if (setting == SETTINGS.SYNCFLOW.CONFIG.AUTHOR_FILTER) {
      elm.value = STR.hasLen(config[setting]) ? config[setting] : '';
    }
    else if (setting == SETTINGS.SYNCFLOW.CONFIG.POSTED_FROM || setting == SETTINGS.SYNCFLOW.CONFIG.POSTED_UNTIL) {
      if (!STR.hasLen(config[setting])) {
        elm.value = '';
      }
      else {
        const dt = new Date(config[setting]);
        if (isNaN(dt)) {
          elm.value = '';
        }
        else {
          elm.value = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
        }
      }
    }
  }
};