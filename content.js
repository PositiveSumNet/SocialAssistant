console.log("Content Script initialized.");

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(request);
    sendResponse({auto: request.auto, success: true});
  }
);
