/*********************************************/
// communicating with GitHub
/*********************************************/

var GITHUB = {
  
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
  }
  
};