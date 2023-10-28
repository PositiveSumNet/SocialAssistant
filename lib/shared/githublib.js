/*********************************************/
// communicating with GitHub
/*********************************************/
// allows reuse of metadata tree for all files within the same path
var _ghTreeDataPath;
var _ghTreeDataMeta;
var _ghTreeVideosPath;
var _ghTreeVideosMeta;

var GITHUB = {
  
  PUBLISHER_ORG: 'PositiveSumNet',
  TOPICS_REPO: 'Democracy',
  TOPICS_FILE: 'README.md',

  DEFAULT_DATA_SYNC_REPO_NAME: 'MyWhosum',
  DEFAULT_VIDEOS_SYNC_REPO_NAME: 'MyWhosumVideos',

  REPO_TYPE: {
    DATA: 'data',
    VIDEOS: 'videos',

    toFriendly: function(repoType) {
      const friendlyType = (repoType == GITHUB.REPO_TYPE.VIDEOS) ? 'Videos' : 'Data';
      return friendlyType;
    }
  },

  // hackernoon.com/how-to-fetch-large-data-files-through-github-api
  tryGetBlobResponse: async function(repoConnInfo, fileSha) {
    const request = { method: "GET", headers: repoConnInfo.headers };
    const url = `https://api.github.com/repos/${repoConnInfo.userName}/${repoConnInfo.repoName}/git/blobs/${fileSha}`;
    try {
      return await fetch(url, request);
    }
    catch {
      // it's ok if the file isn't there
      return null;
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

  putUpsertFile: async function(fileUrl, encodedContent, relPath, existingSha, repoConnInfo) {
    const commitMsg = `Upsert ${relPath}`;

    const putFileBody = { message: commitMsg, content: encodedContent };
    if (STR.hasLen(existingSha)) {
      putFileBody.sha = existingSha;
    }

    const putFileRequest = { method: "PUT", headers: repoConnInfo.headers, body: JSON.stringify(putFileBody) };
    const putFileResponse = await fetch(fileUrl, putFileRequest);
    return STR.isTruthy(putFileResponse.ok);
  },

  TREES: {
    clearInMemoryCache: function(repoType) {
      if (repoType == GITHUB.REPO_TYPE.DATA) {
        _ghTreeDataPath = null;
        _ghTreeDataMeta = null;
      }
      else if (repoType == GITHUB.REPO_TYPE.VIDEOS) {
        _ghTreeVideosPath = null;
        _ghTreeVideosMeta = null;
      }
    },

    cacheTree: function(treeMeta, path, repoType) {
      if (repoType == GITHUB.REPO_TYPE.DATA) {
        _ghTreeDataPath = path;
        _ghTreeDataMeta = treeMeta;
      }
      else if (repoType == GITHUB.REPO_TYPE.VIDEOS) {
        _ghTreeVideosPath = path;
        _ghTreeVideosMeta = treeMeta;
      }
    },

    getCachedTreeMeta: function(repoType) {
      if (repoType == GITHUB.REPO_TYPE.DATA) {
        return _ghTreeDataMeta;
      }
      else if (repoType == GITHUB.REPO_TYPE.VIDEOS) {
        return _ghTreeVideosMeta;
      }
    },

    getCachedTreePath: function(repoType) {
      if (repoType == GITHUB.REPO_TYPE.DATA) {
        return _ghTreeDataPath;
      }
      else if (repoType == GITHUB.REPO_TYPE.VIDEOS) {
        return _ghTreeVideosPath;
      }
    },

    getMetadataTree: async function(path, repoConnInfo) {
      const encodedPath = STR.hasLen(path) ? encodeURIComponent(path) : '';
      // foil caching
      const cacheFoiler = `?t=${Date.now()}`;
      const url = `https://api.github.com/repos/${repoConnInfo.userName}/${repoConnInfo.repoName}/git/trees/main:${encodedPath}${cacheFoiler}`;
      const response = await GITHUB.tryGetFileResponse(url, repoConnInfo.headers);
      if (!response) { return null; }
      return await response.json();
    },

    getNextFile: async function(directory, repoConnInfo, repoType, priorFileRelPath) {
      let files = await GITHUB.TREES.getFiles(directory, repoConnInfo, repoType);
      if (!files || files.length == 0) { return null; }
      files = ES6.sortBy(files, 'path');
      if (!STR.hasLen(priorFileRelPath)) {
        return files[0];
      }
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (file.path > priorFileRelPath) {
          return file;
        }
      }

      return null;
    },

    getFile: async function(relPath, repoConnInfo, repoType) {
      const fileName = STR.getFileNameFromFullName(relPath);
      if (!STR.hasLen(fileName)) { return null; }
      const containerPath = STR.getPathFromFullName(relPath) || '';
      const files = await GITHUB.TREES.getFiles(containerPath, repoConnInfo, repoType);
      if (!files || files.length == 0) { return null; }
      const file = files.find(function(f) {
        return f.path && f.path.toLowerCase() == fileName.toLowerCase();
      });
      
      return file;
    },

    getFiles: async function(directory, repoConnInfo, repoType) {
      directory = directory || '';
      let cachedTreeMeta = GITHUB.TREES.getCachedTreeMeta(repoType);
      const cachedTreePath = GITHUB.TREES.getCachedTreePath(repoType);
      if (!cachedTreeMeta || directory != cachedTreePath) {
        const treeMeta = await GITHUB.TREES.getMetadataTree(directory, repoConnInfo);
        GITHUB.TREES.cacheTree(treeMeta, directory, repoType);
      }
      cachedTreeMeta = GITHUB.TREES.getCachedTreeMeta(repoType);
      if (!cachedTreeMeta) { return null; }
      let files = cachedTreeMeta.tree;
      files = files.filter(function(f) { return f.type == 'blob'; });
      return files;
    }
  },

  SHAS: {
    getBlobSha: async function(relPath, repoConnInfo, repoType) {
      const file = await GITHUB.TREES.getFile(relPath, repoConnInfo, repoType);
      if (!file) { return null; }
      return file.sha;
    },
  
    // stackoverflow.com/questions/77290492/calculate-git-file-blob-sha-handle-emojis-etc
    calcTextContentSha: async function(text) {
      const len = CRYPTO.utf8ByteLen(text);
      const data = `blob ${len}\0${text}`;
      const sha = CRYPTO.hash(data, CRYPTO.HASH_METHOD.SHA1);
      return sha;
    }
  },

  HEADERS: {
    buildRawHeaders: function(token, userAgent = 'whosum-ext') {
      return GITHUB.HEADERS.buildHeaders(token, true, userAgent);
    },

    buildJsonHeaders: function(token, userAgent = 'whosum-ext') {
      return GITHUB.HEADERS.buildHeaders(token, false, userAgent);
    },

    buildHeaders: function(token, allowRaw, userAgent) {
      const accept = (allowRaw == true) ? 'application/vnd.github.raw+json' : 'application/vnd.github.json';

      return {
        "Content-type": "application/json; charset=UTF-8",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": `Bearer ${token}`,
        "User-Agent": userAgent
      };
    }  
  },

  VIDEOS: {
    buildVideoUrl: function(repoConnInfo, fileName) {
      return `https://api.github.com/repos/${repoConnInfo.userName}/${repoConnInfo.repoName}/contents/${fileName}`;
    },
    
    // e.g. "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA..."
    // returns null if not found at the github repo
    resolveB64DataUri: async function(postUrlKey) {
      const fileName = STR.buildVideoFileNameFromUrlKey(postUrlKey);
      const repoType = GITHUB.REPO_TYPE.VIDEOS;
      const repoConnInfo = await GITHUB.SYNC.getRepoConnInfo(null, repoType);
      if (!repoConnInfo) { return null; }
      const fileUrl = GITHUB.VIDEOS.buildVideoUrl(repoConnInfo, fileName);
      const response = await GITHUB.tryGetFileResponse(fileUrl, repoConnInfo.headers);
      if (!response || !response.ok) { return null; }
      let fileInfo = await response.json();
      
      if (STR.hasLen(fileInfo.content)) {
        // files smaller than 1MB
        const content = fileInfo.content.replaceAll('\r', '').replaceAll('\n', '');
        const decoded = STR.fromBase64(content);
        return `${VIDEO_DATA_URL_PREFIX}${decoded}`;
      }
      else {
        const blobResponse = await GITHUB.tryGetBlobResponse(repoConnInfo, fileInfo.sha);
        if (!blobResponse || !blobResponse.ok) {
          return null;
        }
        else {
          fileInfo = await blobResponse.json();
          if (!STR.hasLen(fileInfo.content)) {
            return null;
          }
          else {
            const decoded = STR.fromBase64(fileInfo.content);
            return `${VIDEO_DATA_URL_PREFIX}${decoded}`;
          }
        }
      }
    },
    
    // b64Data is e.g. "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA..."
    // also see base64.guru/converter/encode/video
    // fileName e.g.: 'scafaria_status_1626566689864163329 (1).mp4'
    uploadVideoWorker: async function(b64Data, fileName, onSucccessFn, onErrorFn) {
      fileName = STR.cleanDownloadedFileName(fileName);
      // just putting videos at the root
      const relPath = fileName;
      const repoType = GITHUB.REPO_TYPE.VIDEOS;
      const onFailure = GHCONFIG_UI.onGithubFailure;
  
      if (!STR.isValidTwitterVideoFileName(fileName)) {
        onErrorFn(`Unexpected file name: ${fileName}`);
        return;
      }
  
      // the b64Data is already base64 encoded (though it's prefixed)
      if (!b64Data || !b64Data.startsWith(VIDEO_DATA_URL_PREFIX)) {
        onErrorFn(`Unexpected video data: ${fileName}`);
        return;
      }
  
      b64Data = STR.stripPrefix(b64Data, VIDEO_DATA_URL_PREFIX);
      const encodedContent = STR.toBase64(b64Data, true);
  
      const repoConnInfo = await GITHUB.SYNC.getRepoConnInfo(onFailure, repoType);
      if (!repoConnInfo) { return; }
  
      // check accessibility
      const rateLimit = await GITHUB.getRateLimit(repoConnInfo.token, repoType);
      if (GITHUB.SYNC.checkIfRateLimited(rateLimit, onFailure) == true) {
        return;
      }
  
      // storing at the root
      const fileUrl = GITHUB.VIDEOS.buildVideoUrl(repoConnInfo, fileName);
      // first test for existing file and grab its sha (required for updates)
      const existingSha = await GITHUB.SHAS.getBlobSha(relPath, repoConnInfo, repoType);
      let canSkip = false;
      if (STR.hasLen(existingSha)) {
        const uploadableSha = await GITHUB.SHAS.calcTextContentSha(b64Data);
        if (existingSha == uploadableSha) {
          canSkip = true;
        }
      }

      if (canSkip == true) {
        await onSucccessFn(`Idential ${fileName} exists`, repoConnInfo);
        return;
      }
      
      try {
        const putResultOk = await GITHUB.putUpsertFile(fileUrl, encodedContent, relPath, existingSha, repoConnInfo);
        if (putResultOk) {
          await onSucccessFn(fileName, repoConnInfo);
        }
        else {
          onErrorFn(`Upload of ${fileName} failed`);
        }
      }
      catch(err) {
        console.log(err);
        onErrorFn(`Upload of ${fileName} failed`);
      }
    }
  },

  SYNC: {
    
    ERROR_CODE: {
      lacksToken: 'lacksToken',
      tokenFailed: 'tokenFailed',
      userNameMissing: 'userNameMissing',
      syncRepoSettingMissing: 'syncRepoSettingMissing',
      testWriteFailed: 'testWriteFailed',
      testDeleteFailed: 'testDeleteFailed',
      pushBackupFileFailed: 'pushBackupFileFailed',
      notConnected: 'notConnected',
      rateLimited: 'rateLimited'
    },

    getRepoConnInfo: async function(onFailure, repoType) {
      const token = await SETTINGS.GITHUB.getSyncToken(repoType);
      if (!STR.hasLen(token)) {
        console.log('missing github token');
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.lacksToken });
          return null;
        }
      }

      const userName = await SETTINGS.GITHUB.getUserName(repoType);
      if (!STR.hasLen(userName)) {
        console.log('userName missing');
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.userNameMissing });
          return null;
        }
      }

      const repoName = await SETTINGS.GITHUB.getSyncRepoName(repoType);
      if (!STR.hasLen(repoName)) {
        console.log('repoNameSetting missing');
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.syncRepoSettingMissing });
          return null;
        }
      }

      const headers = GITHUB.HEADERS.buildJsonHeaders(token);

      return {
        token: token,
        userName: userName,
        repoName: repoName,
        headers: headers
      }
    },
    
    checkIfRateLimited: function(rateLimit, onFailure) {
      if (!rateLimit) {
        if (onFailure) {
          onFailure({ reason: GITHUB.SYNC.ERROR_CODE.notConnected });
          return true;
        }
      }
      else if (rateLimit.rate && !isNaN(parseInt(rateLimit.rate.remaining)) && parseInt(rateLimit.rate.remaining) < 3) {
        onFailure({ reason: GITHUB.SYNC.ERROR_CODE.rateLimited, rateLimit: rateLimit });
        return true;
      }

      return false;
    },

    BACKUP: {
      upsertPushable: async function(syncable, onSuccess, onFailure) {
        const repoType = syncable[SYNCFLOW.SYNCABLE.repoType] || GITHUB.REPO_TYPE.DATA;
        const repoConnInfo = await GITHUB.SYNC.getRepoConnInfo(onFailure, repoType);
        if (!repoConnInfo) { return; }

        // check accessibility
        const rateLimit = await GITHUB.getRateLimit(repoConnInfo.token, repoType);
        if (GITHUB.SYNC.checkIfRateLimited(rateLimit, onFailure) == true) {
          return;
        }

        if (syncable[SYNCFLOW.SYNCABLE.dontSync] != true) {
          
          const relPath = syncable[SYNCFLOW.SYNCABLE.filePath];
          let pushResult = await GITHUB.SYNC.BACKUP.pushWorker(syncable, relPath, repoConnInfo);
          if (pushResult.success != true) {
            // clear blob sha cache and try once more
            console.log('clearing sha cache and retrying...');
            GITHUB.TREES.clearInMemoryCache();
            // sleep a couple seconds before retrying
            await ES6.sleep(2000);
            pushResult = await GITHUB.SYNC.BACKUP.pushWorker(syncable, relPath, repoConnInfo);
            if (pushResult.success != true) {
              if (onFailure) {
                console.log('push failed on retry');
                onFailure(pushResult);
              }
              return;
            }
          }
        }

        // looks like a success
        await onSuccess({ rateLimit: rateLimit, syncable: syncable }, SYNCFLOW.DIRECTION.BACKUP);
      },

      pushWorker: async function(syncable, relPath, repoConnInfo) {
        const fileUrl = `https://api.github.com/repos/${repoConnInfo.userName}/${repoConnInfo.repoName}/contents/${relPath}`;
        const plainTextContent = syncable[SYNCFLOW.SYNCABLE.content];
        const repoType = GITHUB.REPO_TYPE.DATA;

        // first test for existing file and grab its sha (required for updates)
        const existingSha = await GITHUB.SHAS.getBlobSha(relPath, repoConnInfo, repoType);
        
        let canSkip = false;
        if (STR.hasLen(existingSha)) {
          const uploadableSha = await GITHUB.SHAS.calcTextContentSha(plainTextContent);
          if (existingSha == uploadableSha) {
            canSkip = true;
          }
        }

        if (canSkip == true) {
          // console.log('skipping ' + relPath + ' where existingsha = ' + existingSha);
          return { success: true };
        }
        // console.log('uploading ' + relPath + ' where existingsha = ' + existingSha);

        const encodedContent = STR.hasLen(plainTextContent) ? STR.toBase64(plainTextContent, true) : '';
        const putResultOk = await GITHUB.putUpsertFile(fileUrl, encodedContent, relPath, existingSha, repoConnInfo);
        if (!putResultOk) {
          console.log('file upload error');
          return { success: false, reason: GITHUB.SYNC.ERROR_CODE.pushBackupFileFailed, syncable: syncable };
        }
        else {
          return { success: true };
        }
      }
    }
  },

  testGithubConnection: async function(onSuccess, onFailure, repoType) {
    const token = await SETTINGS.GITHUB.getSyncToken(repoType);
    if (!STR.hasLen(token)) {
      console.log('missing github token');
      if (onFailure) {
        onFailure({ reason: GITHUB.SYNC.ERROR_CODE.lacksToken });
        return;
      }
    }

    // first test for user fetch
    const headers = GITHUB.HEADERS.buildJsonHeaders(token);
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
    await SETTINGS.GITHUB.saveUserName(user.login, repoType);
    await SETTINGS.GITHUB.saveAvatarUrl(user.avatar_url || '', repoType);
    const userName = await SETTINGS.GITHUB.getUserName(repoType);
    
    // try a write
    const nowTime = Date.now();
    const testFileName = `ping-${nowTime}.txt`;
    const repoName = await SETTINGS.GITHUB.getSyncRepoName(repoType);
    const testFileUrl = `https://api.github.com/repos/${userName}/${repoName}/contents/${testFileName}`;
    // we have the luxury of knowing this filename does not already exist
    const putFileBody = { message: `connectivity check ${nowTime}`, content: STR.toBase64(`connectivity check ${nowTime}`) };
    const putFileRequest = { method: "PUT", headers: headers, body: JSON.stringify(putFileBody) };
    const putFileResponse = await fetch(testFileUrl, putFileRequest);
    if (!putFileResponse.ok) {
      console.log('file write error');
      if (onFailure) {
        await SETTINGS.GITHUB.recordSyncConnFail(repoType);
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
        await SETTINGS.GITHUB.recordSyncConnFail(repoType);
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
    await SETTINGS.GITHUB.saveSyncRepoIsPublic(isPublic, repoType);

    const rateLimit = await GITHUB.getRateLimit(token, repoType);
    if (onSuccess) {
      await onSuccess(rateLimit);
    }
  },

  // rateLimit has 'rate' property which is: { limit, remaining, reset, used}
  // where each is an integer and 'reset' is seconds since epoch, 
  // so to convert to reset date, use new Date(reset * 1000)
  // we return the whole thing and not just the 'rate' property
  getRateLimit: async function(token, repoType) {
    const headers = GITHUB.HEADERS.buildJsonHeaders(token);
    const request = { method: "GET", headers: headers };
    const response = await GITHUB.tryGetFileResponse("https://api.github.com/rate_limit", request.headers);
    if (!response || !response.ok) {
      // error
      return null;
    }
    else {
      const rateLimit = await response.json();
      // append the repoType
      rateLimit.repoType = repoType;
      await SETTINGS.GITHUB.saveSyncConnLastOkNow(repoType);
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
  }
};