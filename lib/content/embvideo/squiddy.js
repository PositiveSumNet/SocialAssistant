var SQUIDDY = {
  getVideoUrl: function(resolution) {
    const anchors = Array.from(document.querySelectorAll('a[href^="https://video.twimg.com"]'));
    if (anchors.length == 0) { return null; }
    let bestAnchor;
    switch (resolution) {
      case VIDEO_RES.MEDIUM:
        bestAnchor = anchors.find(function(a) { return a.innerText.indexOf('Medium resolution') > -1; });
        break;
      case VIDEO_RES.LOWEST:
        bestAnchor = anchors.find(function(a) { return a.innerText.indexOf('Lowest resolution') > -1; });
        break;
      case VIDEO_RES.HIGH:
        bestAnchor = anchors.find(function(a) { return a.innerText.indexOf('Best resolution') > -1; });
        break;
      default:
        return null;
    }

    return bestAnchor ? bestAnchor.href : anchors[0].href;
  },

  // we want the urlKey to be discernable from the file name so that during Import we can link it up with the source post
  buildFileName: function() {
    // starting with:
    // https://www.squidlr.com/download?url=https://x.com/USERNAME/status/1604953808890294756#high
    // get to: USERNAME_status_1604953808890294756.mp4
    // and noting that _status_ will serve as delimiter
    let href = document.location.href;
    href = STR.stripUrlHashSuffix(href);
    let urlParm = URLPARSE.getQueryParm('url');
    let urlKey = STR.tryGetUrlKey(urlParm, ['x.com']);
    urlKey = STR.stripPrefix(urlKey, '/');
    let fileName = urlKey.replaceAll('/', '_');
    fileName = `${fileName}.mp4`;
    return fileName;
  },

  captureVideo: function(cdnUrl) {
    const fileName = SQUIDDY.buildFileName();

    chrome.runtime.sendMessage({
      actionType: MSGTYPE.TO_POPUP.DOWNLOAD_MEDIA, 
      cdnUrl: cdnUrl,
      fileName: fileName
    });
  },

  pollForCaptureVideo: async function() {
    const resolution = STR.getUrlHashSuffix(document.location.href);
    // note that we only auto-nav if the hashed resolution suffix is appended to the url
    // (so that users can also use Squidlr on its own without interference)
    if (!STR.hasLen(resolution)) { return; }
    let cdnUrl;
    for (let i = 0; i < 5; i++) {
      // try a few times, waiting for the page to load
      cdnUrl = SQUIDDY.getVideoUrl(resolution);
      if (STR.hasLen(cdnUrl)) {
        break;
      }
      await ES6.sleep(1000);
    }

    if (!STR.hasLen(cdnUrl)) {
      console.log('unable to resolve video url');
      return;
    }

    SQUIDDY.captureVideo(cdnUrl);
  }
};