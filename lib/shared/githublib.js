/*********************************************/
// communicating with GitHub
/*********************************************/

var GITHUB = {
  
  PUBLISHER_ORG: 'PositiveSumNet',
  TOPICS_REPO: 'Democracy',
  TOPICS_FILE: 'README.md',

  DEFAULT_SYNC_REPO_NAME: 'MyWhosum',

  SYNC: {
    
    ERROR_CODE: {
      lacksToken: 'lacksToken',
      tokenFailed: 'tokenFailed',
      userNameMissing: 'userNameMissing',
      syncRepoSettingMissing: 'syncRepoSettingMissing',
      pushBackupFileFailed: 'pushBackupFileFailed',
      testWriteFailed: 'testWriteFailed',
      testDeleteFailed: 'testDeleteFailed'
    },

    getSyncInfo: async function(onFailure) {
      const token = await SETTINGS.GITHUB.getSyncToken();
      if (!STR.hasLen(token)) {
        console.log('missing github token');
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.lacksToken });
          return null;
        }
      }

      const userName = await SETTINGS.GITHUB.getUserName();
      if (!STR.hasLen(userName)) {
        console.log('userName missing');
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.userNameMissing });
          return null;
        }
      }

      const repoName = await SETTINGS.GITHUB.getSyncRepoName();
      if (!STR.hasLen(repoName)) {
        console.log('repoNameSetting missing');
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.syncRepoSettingMissing });
          return null;
        }
      }

      const headers = GITHUB.buildHeaders(token);

      return {
        token: token,
        userName: userName,
        repoName: repoName,
        headers: headers
      }
    },
    
    tryGetFileResponse: async function(url, headers) {
      const request = { method: "GET", headers: headers };
      try {
        return await fetch(url, request);
      }
      catch {
        // it's ok if the file isn't there
        return null;
      }
    },

    BACKUP: {
      upsertPushable: async function(pushable, onSuccess, onFailure) {
        const syncInfo = await GITHUB.SYNC.getSyncInfo(onFailure);
        if (!syncInfo) { return; }
        const relPath = pushable[SYNCFLOW.PUSHABLE.filepath];
        const fileUrl = `https://api.github.com/repos/${syncInfo.userName}/${syncInfo.repoName}/contents/${relPath}`;
  
        // first test for user fetch
        let existingSha;
        const existingFileResponse = await GITHUB.SYNC.tryGetFileResponse(fileUrl, syncInfo.headers);
        if (existingFileResponse && existingFileResponse.ok) {
          // file exists
          const fileInfo = await existingFileResponse.json();
          existingSha = fileInfo.content.sha;
        }

        // now prepare the upload
        const commitMsg = `Upsert ${relPath}`;
        const plainTextContent = pushable[SYNCFLOW.PUSHABLE.content];
        const encodedContent = STR.hasLen(plainTextContent) ? STR.toBase64(plainTextContent) : null;
        
        const putFileBody = { message: commitMsg, content: encodedContent };
        if (STR.hasLen(existingSha)) {
          putFileBody.sha = existingSha;
        }

        // push the upload
        const putFileRequest = { method: "PUT", headers: syncInfo.headers, body: JSON.stringify(putFileBody) };
        const putFileResponse = await fetch(fileUrl, putFileRequest);
        if (!putFileResponse.ok) {
          console.log('file upload error');
          if (onFailure) {
            onFailure({ reason: GITHUB.SYNC.ERROR_CODE.pushBackupFileFailed, pushable: pushable });
            return;
          }
        }
        
        // looks like a success
        const rateLimit = await GITHUB.getRateLimit(syncInfo.token);
        if (onSuccess) {
          await onSuccess({ rateLimit: rateLimit, pushable: pushable });
        }
      }
    }
  },

  testGithubConnection: async function(onSuccess, onFailure) {
    const token = await SETTINGS.GITHUB.getSyncToken();
    if (!STR.hasLen(token)) {
      console.log('missing github token');
      if (onFailure) {
        onFailure({ reason: GITHUB.SYNC.ERROR_CODE.lacksToken });
        return;
      }
    }

    // first test for user fetch
    const headers = GITHUB.buildHeaders(token);
    const getUserRequest = { method: "GET", headers: headers };
    const userResponse = await fetch("https://api.github.com/user", getUserRequest);
    if (!userResponse.ok) {
      console.log('unexpected user result');
      if (onFailure) {
        onFailure({ reason: GITHUB.SYNC.ERROR_CODE.tokenFailed });
        return;
      }
    }

    // store user info
    const user = await userResponse.json();
    console.log('got user: ' + user.login);
    await SETTINGS.GITHUB.saveUserName(user.login);
    await SETTINGS.GITHUB.saveAvatarUrl(user.avatar_url || '');
    const userName = await SETTINGS.GITHUB.getUserName();
    
    // try a write
    const nowTime = Date.now();
    const testFileName = `ping-${nowTime}.txt`;
    const repoName = await SETTINGS.GITHUB.getSyncRepoName();
    const testFileUrl = `https://api.github.com/repos/${userName}/${repoName}/contents/${testFileName}`;
    // we have the luxury of knowing this filename does not already exist
    const putFileBody = { message: `connectivity check ${nowTime}`, content: STR.toBase64(`connectivity check ${nowTime}`) };
    const putFileRequest = { method: "PUT", headers: headers, body: JSON.stringify(putFileBody) };
    const putFileResponse = await fetch(testFileUrl, putFileRequest);
    if (!putFileResponse.ok) {
      console.log('file write error');
      if (onFailure) {
        await SETTINGS.GITHUB.recordSyncConnFail();
        onFailure({ reason: GITHUB.SYNC.ERROR_CODE.testWriteFailed, userName: userName, repoName: repoName });
        return;
      }
    }
    const fileInfo = await putFileResponse.json();
    const fileSha = fileInfo.content.sha;

    // delete what we put there
    const deleteFileBody = { message: `delete conn-check file ${nowTime}`, sha: fileSha };
    const deleteFileRequest = { method: "DELETE", headers: headers, body: JSON.stringify(deleteFileBody) };
    const deleteFileResponse = await fetch(testFileUrl, deleteFileRequest);
    if (!deleteFileResponse.ok) {
      console.log('deleting file write error');
      if (onFailure) {
        await SETTINGS.GITHUB.recordSyncConnFail();
        onFailure({ reason: GITHUB.SYNC.ERROR_CODE.testDeleteFailed, userName: userName, repoName: repoName });
        return;
      }
    }
    // ok, we were able to write and delete a file
    // now the final test to test if this is a PRIVATE repository (and to let the user know either way)
    const getRepoRequest = { method: "GET", headers: headers };
    const repoResponse = await fetch(`https://api.github.com/repos/${userName}/${repoName}`, getRepoRequest);
    let isPublic;
    if (!repoResponse.ok) {
      // unexpected (since we successfully wrote to the repo)
      isPublic = false;
    }
    else {
      // in the unlikely event they granted additional access to the token we won't get the http exception (ok is true) and will come here instead.
      let repo = await repoResponse.json();
      isPublic = (STR.isTruthy(repo.private) == false);
    }

    if (isPublic == true) {
      console.log('sync repository is public');
    }
    await SETTINGS.GITHUB.saveSyncRepoIsPublic(isPublic);

    await SETTINGS.GITHUB.saveSyncConnLastOkNow();
    const rateLimit = await GITHUB.getRateLimit(token);
    if (onSuccess) {
      await onSuccess(rateLimit);
    }
  },

  // rateLimit has 'rate' property which is: { limit, remaining, reset, used}
  // where each is an integer and 'reset' is seconds since epoch, 
  // so to convert to reset date, use new Date(reset * 1000)
  // we return the whole thing and not just the 'rate' property
  getRateLimit: async function(token) {
    const headers = GITHUB.buildHeaders(token);
    const request = { method: "GET", headers: headers };
    const response = await fetch("https://api.github.com/rate_limit", request);
    if (!response.ok) {
      // error
      return null;
    }
    else {
      const rateLimit = await response.json();
      return rateLimit;
    }
  },

  writeRateLimitDisplay: function(rateLimit) {
    if (!rateLimit || !rateLimit.rate || isNaN(rateLimit.rate.reset)) { return ''; }
    const limit = rateLimit.rate.limit;
    const remaining = rateLimit.rate.remaining;
    const used = rateLimit.rate.used;
    const resetDt = new Date(rateLimit.rate.reset * 1000);
    const resetMemo = STR.timeVsNowFriendly(resetDt);
    return `Used ${used} of ${limit} calls with ${remaining} remaining (resets ${resetMemo})`;
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