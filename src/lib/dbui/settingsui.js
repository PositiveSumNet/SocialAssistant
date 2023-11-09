var SETTINGS_UI = {
  bindElements: function() {

    document.getElementById('mdonGear').onclick = function(event) {
      const mdonServer = SETTINGS_UI.confirmMdonServer();
      if (mdonServer != null) {
        // re-render
        const optWithMdon = document.getElementById('optWithMdon');
        optWithMdon.checked = true;
        QUERYWORK_UI.executeSearch();
      }
      return false;
    };
    
    const btnClearCache = document.getElementById('btnClearCache');
    btnClearCache.addEventListener('click', async () => {
      if (confirm('If unknown problems persist even after relaunching the browser, you may wish to clear the cache. \nContinue?')) {
        await chrome.storage.local.clear();
        localStorage.clear();
      }
      return true;
    });

  },
  
  canRenderMastodonFollowOneButtons: function() {
    const site = SETTINGS.getCachedSite();
    const mdonMode = document.getElementById('optWithMdon').checked;
    return site === SITE.MASTODON || mdonMode === true;
  },

  ensureAskedMdonServer: function() {
    const asked = SETTINGS.getAskedMdonServer();
  
    if (!asked) {
      SETTINGS_UI.confirmMdonServer();
    }
  },

  confirmMdonServer: function() {
    const mdonServer = SETTINGS.getMdonServer() || '';
    const input = prompt("First, please input the Mastodon server where you have an account (e.g. 'toad.social').", mdonServer);
    
    if (input != null) {
      SETTINGS.localSet(SETTINGS.MDON_SERVER, input);
    }
    
    // even if they cancelled, we'll avoid showing again (they can click the gear if desired)
    SETTINGS.localSet(SETTINGS.ASKED.MDON_SERVER, true);
    return input;
  }
};