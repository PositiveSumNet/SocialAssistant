var GHRESTORE_UI = {
  bindElements: function() {
    Array.from(document.querySelectorAll('#importFilterSection input[type="checkbox"]')).forEach(function(input) {
      input.addEventListener('change', (event) => {
        GHRESTORE_UI.saveRestoreSettingsFromUi();
      });
    });
    
    Array.from(document.querySelectorAll('#importFilterSection input[type="text"]')).forEach(function(input) {
      input.addEventListener('blur', (event) => {
        GHRESTORE_UI.saveRestoreSettingsFromUi();
      });
    });
    
    const btnGhRestoreStart = document.getElementById('btnGhRestoreStart');
    btnGhRestoreStart.onclick = async function(event) {
      GHRESTORE_UI.saveRestoreSettingsFromUi();
      await SYNCFLOW.resumeSync(SYNCFLOW.DIRECTION.RESTORE);
      btnGhRestorePause.classList.remove('d-none');
      btnGhRestoreStart.classList.add('d-none');
      btnGhRestoreRestart.classList.add('d-none');
      return false;
    };
    
    const btnGhRestorePause = document.getElementById('btnGhRestorePause');
    btnGhRestorePause.onclick = function(event) {
      btnGhRestorePause.classList.add('d-none');
      SYNCFLOW.pauseSync(SYNCFLOW.DIRECTION.RESTORE);
      btnGhRestoreStart.classList.remove('d-none');
      btnGhRestoreRestart.classList.remove('d-none');
      return false;
    };
    
    const btnGhRestoreRestart = document.getElementById('btnGhRestoreRestart');
    btnGhRestoreRestart.onclick = async function(event) {
      GHRESTORE_UI.saveRestoreSettingsFromUi();
      await SYNCFLOW.startOverSync(SYNCFLOW.DIRECTION.RESTORE);
      btnGhRestorePause.classList.remove('d-none');
      btnGhRestoreStart.classList.add('d-none');
      btnGhRestoreRestart.classList.add('d-none');
      return false;
    };
  },
  
  renderSyncRestoreStatus: async function(status) {
    status = status || SYNCFLOW.buildStatus(SYNCFLOW.DIRECTION.RESTORE);
    const statusElm = document.getElementById('ghRestoreStatusMsg');
    statusElm.textContent = status.msg;
    const checkElm = document.getElementById('ghRestoreStatusCheck');
    const exclamElm = document.getElementById('ghRestoreStatusFail');
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

    // special handling of _restoreStartedThisSession is in case running was calculated as true based on last step being very recent
    // but guarding against the case where the user hit F5 (and so it isn't actually running in this session)
    if (status.running === true && _restoreStartedThisSession == true) {
      btnGhRestorePause.classList.remove('d-none');
      btnGhRestoreStart.classList.add('d-none');
      btnGhRestoreRestart.classList.add('d-none');
    }
    else {
      GHRESTORE_UI.reflectRestoreSettings();
      btnGhRestorePause.classList.add('d-none');
      btnGhRestoreStart.classList.remove('d-none');
  
      if (status.ok === true || status.msg == SYNCFLOW.START_MSG) {
        // we're at the beginning, so start and restart mean the same thing
        btnGhRestoreRestart.classList.add('d-none');
      }
      else {
        btnGhRestoreRestart.classList.remove('d-none');
      }
    }
  },
  
  saveRestoreSettingsFromUi: function() {
    const config = {};
    const ns = SETTINGS.SYNCFLOW.CONFIG;
    config[ns.WITH_FAVORITES] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_FAVORITES, 'optImportWithFavorites');
    config[ns.WITH_PROFILES] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_PROFILES, 'optImportWithProfiles');
    config[ns.WITH_AVATARS] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_AVATARS, 'optImportWithAvatars');
    config[ns.WITH_NETWORKS] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_NETWORKS, 'optImportWithNetworks');
    config[ns.WITH_TOPICS] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_TOPICS, 'optImportWithTopics');
    config[ns.WITH_POSTS] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_POSTS, 'optImportWithPosts');
    config[ns.WITH_POST_IMAGES] = GHRESTORE_UI.getRestoreSettingFromUi(ns.WITH_POST_IMAGES, 'optImportWithPostImages');
    config[ns.DO_TWITTER] = GHRESTORE_UI.getRestoreSettingFromUi(ns.DO_TWITTER, 'optImportTwitter');
    config[ns.DO_MASTODON] = GHRESTORE_UI.getRestoreSettingFromUi(ns.DO_MASTODON, 'optImportMastodon');
    config[ns.AUTHOR_FILTER] = GHRESTORE_UI.getRestoreSettingFromUi(ns.AUTHOR_FILTER, 'optImportForAuthor') || '';
    config[ns.POSTED_FROM] = GHRESTORE_UI.getRestoreSettingFromUi(ns.POSTED_FROM, 'optImportPostsFrom') || '';
    config[ns.POSTED_UNTIL] = GHRESTORE_UI.getRestoreSettingFromUi(ns.POSTED_UNTIL, 'optImportPostsUntil') || '';
    SETTINGS.SYNCFLOW.RESTORE.saveImportConfig(config);
  },
  
  reflectRestoreSettings: function() {
    const config = SETTINGS.SYNCFLOW.RESTORE.getImportConfig();
    const ns = SETTINGS.SYNCFLOW.CONFIG;
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_FAVORITES, 'optImportWithFavorites');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_PROFILES, 'optImportWithProfiles');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_AVATARS, 'optImportWithAvatars');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_NETWORKS, 'optImportWithNetworks');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_TOPICS, 'optImportWithTopics');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_POSTS, 'optImportWithPosts');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.WITH_POST_IMAGES, 'optImportWithPostImages');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.DO_TWITTER, 'optImportTwitter');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.DO_MASTODON, 'optImportMastodon');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.AUTHOR_FILTER, 'optImportForAuthor');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.POSTED_FROM, 'optImportPostsFrom');
    GHRESTORE_UI.reflectRestoreSettingInUi(config, ns.POSTED_UNTIL, 'optImportPostsUntil');
  },
  
  getRestoreSettingFromUi: function(setting, elmId) {
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

  reflectRestoreSettingInUi: function(config, setting, elmId) {
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