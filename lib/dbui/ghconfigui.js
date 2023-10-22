var GHCONFIG_UI = {
  bindElements: function() {

    const btnSubmitGithubToken = document.getElementById('btnSubmitGithubToken');
    btnSubmitGithubToken.onclick = async function(event) {
      const txtGithubToken = document.getElementById('txtGithubToken');
      const tokenVal = txtGithubToken.value;
      const repoType = GHCONFIG_UI.getGithubConfigRepoType();
      const conflictMsg = await SETTINGS.GITHUB.getTokenAlreadyInUseForOtherRepoMsg(tokenVal, repoType);
      if (STR.hasLen(conflictMsg)) {
        GHCONFIG_UI.setGithubConnFailureMsg(conflictMsg);
      }
      else if (STR.hasLen(tokenVal)) {
        GHCONFIG_UI.setGithubConnFailureMsg(null);
        await SETTINGS.GITHUB.saveSyncToken(tokenVal, repoType);
        await GHCONFIG_UI.testGithubConnection(repoType);
      }
      else {
        // show warning
        GHCONFIG_UI.setGithubConnFailureMsg('Paste a token in the textbox before continuing.');
      }
      return false;
    };
    
    const btnDismissGithubFaq = document.getElementById('btnDismissGithubFaq');
    btnDismissGithubFaq.onclick = function(event) {
      GHCONFIG_UI.hideGithubFaq();
      return false;
    };
    
    const btnRetestGithubConn = document.getElementById('btnRetestGithubConn');
    btnRetestGithubConn.onclick = async function(event) {
      const repoType = GHCONFIG_UI.getGithubConfigRepoType();
      GHCONFIG_UI.setGithubConnFailureMsg('');
      const repoName = document.getElementById('txtGithubRepoName').value;
      await SETTINGS.GITHUB.saveSyncRepoName(repoName, repoType);
      await GHCONFIG_UI.testGithubConnection(repoType);
    
      return false;
    }
    
    const btnResetGithubConn = document.getElementById('btnResetGithubConn');
    btnResetGithubConn.onclick = async function(event) {
      const repoType = GHCONFIG_UI.getGithubConfigRepoType();
      if (confirm(`Clear the GitHub ${repoType} configuration stored by this app?`) == true) {
        GHCONFIG_UI.setGithubConnFailureMsg('');
        await SETTINGS.GITHUB.removeSyncToken(repoType);
        await SETTINGS.GITHUB.removeSyncUserName(repoType);
        await SETTINGS.GITHUB.removeSyncRepoIsPublic(repoType);
        await SETTINGS.GITHUB.removeAvatarUrl(repoType);
        await SETTINGS.GITHUB.removeSyncLastOk(repoType);
        await SETTINGS.GITHUB.removeSyncRepoName(repoType);
        await GHCONFIG_UI.reflectGithubTokenStatus();
      }
      
      return false;
    }
  },
  
  testGithubConnection: async function(repoType) {
    await GITHUB.testGithubConnection(GHCONFIG_UI.onGithubConnectedOk, GHCONFIG_UI.onGithubFailure, repoType);
  },

  onGithubConnectedOk: async function(rateLimit) {
    await GHCONFIG_UI.reflectGithubTokenStatus();
    GHCONFIG_UI.renderRateLimit(rateLimit);
  },

  onGithubFailure: function(result) {
    const lastOkElm = document.getElementById('ghLastConnOk');
    const ghCheckElm = document.getElementById('ghConnCheck');
    lastOkElm.classList.remove('text-success');
    lastOkElm.textContent = 'N/A';
    ghCheckElm.classList.add('d-none');
  
    switch (result.reason) {
      case GITHUB.SYNC.ERROR_CODE.lacksToken:
      case GITHUB.SYNC.ERROR_CODE.tokenFailed:
        GHCONFIG_UI.setGithubConnFailureMsg("Missing or invalid token. Please try again or click 'Reset Connection'.");
        break;
      case GITHUB.SYNC.ERROR_CODE.notConnected:
        GHCONFIG_UI.setGithubConnFailureMsg("Could not connect. Are you online?");
        break;
      case GITHUB.SYNC.ERROR_CODE.rateLimited:
        GHCONFIG_UI.setGithubConnFailureMsg("Rate limit exceeded! " + GITHUB.writeRateLimitDisplay(result.rateLimit));
        break;
      case GITHUB.SYNC.ERROR_CODE.userNameMissing:
        GHCONFIG_UI.setGithubConnFailureMsg("User not connected. Please try again or click 'Reset Connection'.");
        break;
      case GITHUB.SYNC.ERROR_CODE.syncRepoSettingMissing:
        GHCONFIG_UI.setGithubConnFailureMsg("Sync repository not connected. Please try again or click 'Reset Connection'.");
        break;
      case GITHUB.SYNC.ERROR_CODE.testWriteFailed:
        GHCONFIG_UI.setGithubConnFailureMsg(`Attempting to write a test file to ${result.userName}/${result.repoName} failed. Please check that the repository has the expected name and that the token was built per the instructions (or reset the connection and generate a new token).`);
        break;
      case GITHUB.SYNC.ERROR_CODE.testDeleteFailed:
        // unexpected
        GHCONFIG_UI.setGithubConnFailureMsg(`Attempting to write & delete a test file to ${result.userName}/${result.repoName} failed. Please check that the repository has the expected name and that the token was built per the instructions (or reset the connection and generate a new token).`);
        break;
      case GITHUB.SYNC.ERROR_CODE.pushBackupFileFailed:
        GHCONFIG_UI.setGithubConnFailureMsg(SYNCFLOW.writePushFailureMsg(result));
        GHCONFIG_UI.renderRateLimit(result.rateLimit);
        break;
      default:
        LOG_UI.logHtml('text-danger', ['Unexpected GitHub error']);
        console.log(result);
        console.trace();
        break;
    }
  },

  reflectGithubTokenStatus: async function() {
    const repoType = GHCONFIG_UI.getGithubConfigRepoType();
    const hasSelectedToken = await SETTINGS.GITHUB.hasSyncToken(repoType);
    const ghBackupTab = document.getElementById('ghBackupTab');
    const ghRestoreTab = document.getElementById('ghRestoreTab');
  
    if (hasSelectedToken == true) {
      GHCONFIG_UI.hideGithubFaq();
      document.getElementById('ghConfigurationUi').style.display = 'none';
      document.getElementById('ghConfiguredUi').style.display = 'block';
      // show status and offer Test Connection or Disconnect
      const userName = await SETTINGS.GITHUB.getUserName(repoType);
      const avatarUrl = await SETTINGS.GITHUB.getAvatarUrl(repoType);
      const repoName = await SETTINGS.GITHUB.getSyncRepoName(repoType);
      const lastOk = await SETTINGS.GITHUB.getSyncConnLastOk(repoType);
      const isPublic = await SETTINGS.GITHUB.getSyncRepoIsPublic(repoType);
      
      const userNameElm = document.getElementById('ghUsername');
      userNameElm.textContent = userName || '--not connected--';
      if (STR.hasLen(userName)) {
        userNameElm.setAttribute('href', `https://github.com/${userName}`);
      }
      else {
        userNameElm.removeAttribute('href');
      }
     
      document.getElementById('ghUserAvatar').setAttribute('src', avatarUrl || '/images/noprofilepic.png');
      document.getElementById('txtGithubRepoName').value = repoName;
  
      const isError = isNaN(parseInt(lastOk));
      const lastOkElm = document.getElementById('ghLastConnOk');
      const ghCheckElm = document.getElementById('ghConnCheck');
      if (isError) {
        lastOkElm.textContent = 'N/A';
        lastOkElm.classList.remove('text-success');
        ghCheckElm.classList.add('d-none');
        ghBackupTab.classList.add('d-none');
        ghRestoreTab.classList.add('d-none');
      }
      else {
        lastOkElm.textContent = new Date(lastOk).toString();
        lastOkElm.classList.add('text-success');
        ghCheckElm.classList.remove('d-none');
        ghBackupTab.classList.remove('d-none');
        ghRestoreTab.classList.remove('d-none');
      }
  
      GHCONFIG_UI.reflectGithubSyncRepoPrivacy(isPublic);
      // hide the banner
      document.getElementById('ghConfigVideoBanner').classList.add('d-none');
      // show the default headings
      document.getElementById('ghConfigStartHeadline').classList.remove('d-none');
      document.getElementById('ghConfigOneLiner').classList.remove('d-none');
    }
    else {
      const hasAnyToken = (await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.DATA)) || (await SETTINGS.GITHUB.hasSyncToken(GITHUB.REPO_TYPE.VIDEOS));
      // show github faq again if there is no token at all
      if (hasAnyToken == false) {
        GHCONFIG_UI.hideGithubFaq(true);
        ghBackupTab.classList.add('d-none');
        ghRestoreTab.classList.add('d-none');
        document.getElementById('ghConfigurationUi').style.display = 'block';
        document.getElementById('ghConfiguredUi').style.display = 'none';
        document.getElementById('txtGithubToken').value = '';
      }
      else {
        // no need to explain the virtues of a GH account etc if we know they have one
        // typically, this case is where they have the data token and now they clicked videos, which they don't yet have
        // go back to showing the configuration form
        document.getElementById('ghConfigurationUi').style.display = 'block';
        document.getElementById('ghConfiguredUi').style.display = 'none';
        GHCONFIG_UI.guideUserForSecondGithubRepo(repoType);
      }
    }
  
    // unveil or hide the uploader
    if (repoType == GITHUB.REPO_TYPE.VIDEOS) {
      GHBACKUP_UI.unveilUploaderAsNeeded(hasSelectedToken);
    }
  },

  reflectGithubSyncRepoPrivacy: function(isPublic) {
    document.getElementById('ghPublicMsg').classList.remove('d-none');
    const publicElm = document.getElementById('ghRepoIsPublic');
    const privateElm = document.getElementById('ghRepoIsPrivate');
    if (isPublic) {
      publicElm.classList.remove('d-none');
      privateElm.classList.add('d-none');
    }
    else {
      publicElm.classList.add('d-none');
      privateElm.classList.remove('d-none');
    }
  },

  hideGithubFaq: function(reshow) {
    if (reshow == true) {
      document.getElementById('ghFirstTime').style.display = 'block';
      document.getElementById('ghConfigureSection').style.display = 'none';
    }
    else {
      document.getElementById('ghFirstTime').style.display = 'none';
      document.getElementById('ghConfigureSection').style.display = 'block';
    }
  },

  guideUserForSecondGithubRepo: function(repoType) {
    // show the banner
    const bannerElm = document.getElementById('ghConfigVideoBanner');
    bannerElm.classList.remove('d-none');

    // don't show the usual headings
    document.getElementById('ghConfigStartHeadline').classList.add('d-none');
    document.getElementById('ghConfigOneLiner').classList.add('d-none');
    // clear the token textbox
    document.getElementById('txtGithubToken').value = '';

    const ghCreateRepoBtn = document.getElementById('ghCreateRepoBtn');
    const defaultRepoName = SETTINGS.GITHUB.getDefaultRepoName(repoType);
    const repoUrl = `https://github.com/new?name=${defaultRepoName}&visibility=private`;

    ghCreateRepoBtn.querySelector('a').href = repoUrl;
    ghCreateRepoBtn.querySelector('.repoName').textContent = defaultRepoName;

    const friendlyType = GITHUB.REPO_TYPE.toFriendly(repoType);
    bannerElm.querySelector('.repoType').textContent = friendlyType;
    bannerElm.querySelector('.repoName').textContent = defaultRepoName;

    const helpImgElm = document.getElementById('ghTokenHelpImg');
    const imgSrc = (repoType == GITHUB.REPO_TYPE.VIDEOS) ? '/images/ghpathelp_videos.png' : '/images/ghpathelp.png';
    helpImgElm.src = imgSrc;

    const figure1Tip = document.querySelector('#makeTokenTip .repoName');
    figure1Tip.textContent = defaultRepoName;
  },
  
  getGithubConfigRepoType: function() {
    const videosTab = document.getElementById('ghConfigVideosTab');
    if (videosTab.classList.contains('active')) {
      return GITHUB.REPO_TYPE.VIDEOS;
    }
    else {
      return GITHUB.REPO_TYPE.DATA;
    }
  },
  
  setGithubConfigRepoTypeTab: function(repoType) {
    repoType = repoType || GITHUB.REPO_TYPE.DATA;
  
    const dataTab = document.getElementById('ghConfigDataTab');
    const videosTab = document.getElementById('ghConfigVideosTab');
  
    if (repoType == GITHUB.REPO_TYPE.DATA) {
      dataTab.classList.add('active');
      videosTab.classList.remove('active');
  
      dataTab.setAttribute('aria-current', 'page');
    }
    else if (repoType == GITHUB.REPO_TYPE.VIDEOS) {
      dataTab.classList.remove('active');
      videosTab.classList.add('active');
  
      videosTab.setAttribute('aria-current', 'page');
    }
    else {
      console.log('unexpected repoType');
    }
  },

  renderRateLimit: function(rateLimit) {
    const rateLimitElm = document.getElementById('ghRateLimit');
    let display = GITHUB.writeRateLimitDisplay(rateLimit);
    if (STR.hasLen(rateLimit.repoType)) {
      const friendlyType = GITHUB.REPO_TYPE.toFriendly(rateLimit.repoType);
      display = `${friendlyType} token: ${display}`;
    }
    rateLimitElm.textContent = display;
    rateLimitElm.classList.add('border-light-top');
  },
  
  setGithubConnFailureMsg: function(msg) {
    const githubConnFailureMsg = document.getElementById('githubConnFailureMsg');
    if (STR.hasLen(msg)) {
      // unhide
      githubConnFailureMsg.classList.remove('d-none');
      githubConnFailureMsg.textContent = msg;
    }
    else {
      // hide
      githubConnFailureMsg.classList.add('d-none');
      githubConnFailureMsg.textContent = '';
    }
  }
};