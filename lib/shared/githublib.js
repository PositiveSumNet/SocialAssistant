/*********************************************/
// communicating with GitHub
/*********************************************/

var GITHUB = {
  
  PUBLISHER_ORG: 'PositiveSumNet',
  TOPICS_REPO: 'Democracy',
  TOPICS_FILE: 'README.md',

  onConnectFailure: function(response) {
    console.log('github fetch failed: ' + response);
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
        GITHUB.onConnectFailure(response);
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
  },
  
  setHeadersUserAgent: function(headers, userAgent) {
    headers["User-Agent"] = userAgent;
  },

  getUserId: function(token, successCallback, failureCallback) {
    
    const headers = GITHUB.buildHeaders(token);
    const request = { method: "GET", headers: headers };

    fetch("https://api.github.com/user", request)
    .then(function(response) {
        if (response.status !== 200) {
          failureCallback(response);
          return;
        }

        response.json().then(function(data) {
          successCallback(data.login);
        });
      }
    )
    .catch(function(err) {
      failureCallback(err);
    });
  },

  getRepo: function(token, user, repoName, successCallback, failureCallback) {
    
    const headers = GITHUB.buildHeaders(token, user);
    const request = { method: "GET", headers: headers };

    fetch(`https://api.github.com/repos/${user}/${repoName}`, request)
    .then(function(response) {
        if (response.status !== 200) {
          failureCallback(response);
          return;
        }

        response.json().then(function(data) {
          successCallback(data);
        });
      }
    )
    .catch(function(err) {
      failureCallback(err);
    });
  }
  
};