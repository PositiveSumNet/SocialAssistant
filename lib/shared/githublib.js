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
    const userName = await SETTINGS.GITHUB.getUserName();
    const userAvatarUrl = await SETTINGS.GITHUB.getAvatarUrl();
    
    // try a write
    const nowTime = Date.now();
    const testFileName = `ping-${nowTime}.txt`;
    const repoName = await SETTINGS.GITHUB.getSyncRepoName();
    const testFileUrl = `https://api.github.com/repos/${userName}/${repoName}/contents/${testFileName}`;
    // we have the luxury of knowing this filename does not already exist
    const putFileBody = { message: "connectivity check", content: STR.toBase64(`connectivity check ${nowTime}`) };
    const putFileRequest = { method: "PUT", headers: headers, body: JSON.stringify(putFileBody) };
    const putFileResponse = await fetch(testFileUrl, putFileRequest);
    if (!putFileResponse.ok) {
      console.log('file write error');
      if (onFailure) {
        onFailure({ reason: 'writeFailed', userName: userName, repoName: repoName });
        return;
      }
    }
    // delete what we put there
    const deleteFileBody = { message: "delete conn-check file" };
    const deleteFileRequest = { method: "DELETE", headers: headers, body: JSON.stringify(deleteFileBody) };
    const deleteFileResponse = await fetch(testFileUrl, deleteFileRequest);
    if (!deleteFileResponse.ok) {
      console.log('deleting file write error');
      if (onFailure) {
        onFailure({ reason: 'deleteFailed', userName: userName, repoName: repoName });
        return;
      }
    }
    // ok, we were able to write and delete a file
    // now the final test to test if this is a PRIVATE repository (and to let the user know either way)
    const getRepoRequest = { method: "GET", headers: headers };
    const repoResponse = await fetch(`https://api.github.com/repos/${userName}/${repoName}`, getRepoRequest);
    let isPublic;
    if (!repoResponse.ok) {
      // this is actually expected; it means we have a private repository
      isPublic = false;
    }
    else {
      let repo = await repoResponse.json();
      console.log(repo);
      // isPublic = ...
    }

    // TODO: cache key values and return!
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