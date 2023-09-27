/*********************************************/
// communicating with GitHub
/*********************************************/

var GITHUB = {
  
  PUBLISHER_ORG: 'PositiveSumNet',
  TOPICS_REPO: 'Democracy',
  TOPICS_FILE: 'README.md',

  DEFAULT_SYNC_REPO_NAME: 'MyWhosum',

  testGithubConnection: async function(onSuccess, onFailure) {
    const token = await SETTINGS.GITHUB.getSyncToken();
    if (!STR.hasLen(token)) {
      console.log('missing github token');
      if (onFailure) {
        onFailure({ reason: 'lacksToken' });
      }
    }

    // first test for user fetch
    const headers = GITHUB.buildHeaders(token);
    const getUserRequest = { method: "GET", headers: headers };
    const userResponse = await fetch("https://api.github.com/user", getUserRequest);
    if (!userResponse.ok) {
      console.log('unexpected user result');
      if (onFailure) {
        onFailure({ reason: 'tokenFailed' });
        return;
      }
    }

    // store user info
    const user = await userResponse.json();
    console.log('got user: ' + user.login);
    await SETTINGS.GITHUB.saveUserName(user.login);
    await SETTINGS.GITHUB.saveAvatarUrl(user.avatar_url || '');
    
    // try a write
    const testFileName = `ping-${Date.now()}.txt`;
  },

  saveFile: function() {
    
  },

  // filePath is case sensitive
  getRawContent: function(onSuccess, ownerName, repoName, filePath, branch) {
    branch = branch || 'main';

    const rawUrl = `https://raw.githubusercontent.com/${ownerName}/${repoName}/${branch}/${filePath}`;
    fetch(rawUrl, {
      method: "GET"
    }).then(response => {
      if (response.status !== 200) {
        // we should clear cache!
        console.log('github fetch failed: ' + response);
        return;
      }
      return response.text()
    }).then(str => {
      onSuccess(str);
    });
  },

  buildHeaders: function(token, userAgent = 'whosum-ext') {
    return {
      "Content-type": "application/json; charset=UTF-8",
      "Accept": "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": `Bearer ${token}`,
      "User-Agent": userAgent
    };
  }  
};