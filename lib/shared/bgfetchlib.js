// background fetch (via offscreen approach)
// also se comments for the "flow" at offscreen.js
var BGFETCH = {
  
  clearRequests: async function() {
    const all = await chrome.storage.local.get();
    const entries = Object.entries(all);

    for (const [key, val] of entries) { 
      if (key.startsWith(STORAGE_PREFIX.BG_SCRAPE)) {
        chrome.storage.local.remove(key);
      }
    }
  },

  // cache the request
  cacheTwitterHandlesForProfileScrape: function(content) {
    const handles = BGFETCH.getTwitterHandlesForProfileScrape(content);

    if (!handles || handles.length === 0) {
      return;
    }

    const key = `${STORAGE_PREFIX.BG_SCRAPE}${Date.now().toString()}`;
    
    const toStore = {};
    // background-scrape will use nitter
    toStore[BG_SCRAPE_TYPE.TOKEN.PAGE_TYPE] = PAGETYPE.NITTER.PROFILE;
    toStore[BG_SCRAPE_TYPE.TOKEN.DATA] = handles;
    
    chrome.storage.local.set({ [key]: toStore });
  },

  // content is a set of lines, where each is either 
  // (a) a simple handle, or
  // (b) the type of record we see in a 'TwitterPsnScore' file, i.e.
  // @BillJones |>>| 16
  // For case (b) a minimum score applies
  getTwitterHandlesForProfileScrape: function(content) {
    let handles = [];
    const cutoff = SETTINGS.getMinProfileFetchScore();

    let rows = content.split('\n');
    for (let r = 0; r < rows.length; r++) {
      let row = rows[r];

      if (row.length > 0) {
        let parts = row.split(FLAT_RDF_SO_DELIM);
        let include = false;

        if (parts.length === 1) {
          include = true;
        }
        else if (parts.length === 2) {
          let score = parseInt(parts[1]);
          if (score && score >= cutoff) {
            include = true;
          }
        }

        if (include) {
          handles.push(parts[0]);
        }
      }
    }

    return handles;
  }
  
};