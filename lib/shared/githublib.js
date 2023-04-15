/*********************************************/
// communicating with GitHub
/*********************************************/

var GITHUB = {
  getUserId: function(token) {
    fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        "Content-type": "application/json; charset=UTF-8",
        "Accept": "application/vnd.github.raw+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "whosum"
      }
    })
    .then((response) => response.json())
    .then((json) => console.log(json));
  }
};