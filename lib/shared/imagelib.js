var IMAGE = {

  TAG: {
    // An image tag that holds a base64 encoded image url, which can later be resolved (async) to a base64 image.
    // Reminder: Our chrome-ext CSP doesn't want to load remote images directly.
    DEFERRED_LOAD: 'deferred-load'
  },

  PLACEHOLDER_CLUE: {
    MASTODON: 'missing.png'
  },

  // this becomes img.src
  writeBase64Src: function(imgCdnUrl, img64Data) {
    const imgType = STR.inferImageFileExt(imgCdnUrl);
    return `data:image/${imgType};base64,${img64Data}`;
  },

  shouldDeferLoadImages: function(site, imgCdnUrl) {
    switch(site) {
      case SITE.MASTODON:
        return imgCdnUrl.indexOf(IMAGE.PLACEHOLDER_CLUE.MASTODON) < 0;
      case SITE.TWITTER:
      default:
        return false;
    }
  },

  writeDeferredLoadTag: function(url) {
    return `${IMAGE.TAG.DEFERRED_LOAD}='${STR.toBase64(url)}'`;
  },

  resolveDeferredLoadImages: function(scopeElm) {
    Array.from(scopeElm.querySelectorAll(`img[${IMAGE.TAG.DEFERRED_LOAD}]`)).forEach(function(img) {
      let b64 = img.getAttribute(IMAGE.TAG.DEFERRED_LOAD);
      let url = STR.fromBase64(b64);
      const origSrc = STR.inferImageFileExt(img.getAttribute('src'));
      const img64Fn = IMAGE.getImageBase64(url);

      img64Fn.then(function(data64) { 
        try {
          // successfully converted to base64 image that we can render!
          const newSrc = IMAGE.writeBase64Src(origSrc, data64);
          img.setAttribute('src', newSrc);
        }
        catch {
          // no image, no problem
        }
        
        img.removeAttribute(IMAGE.TAG.DEFERRED_LOAD);
      });
    
    });
  },

  getImageBase64: async function(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();
    await new Promise((resolve, reject) => {
      reader.onload = resolve;
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return reader.result.replace(/^data:.+;base64,/, '')
  }

};