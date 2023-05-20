// background fetch (via offscreen approach)
var BGFETCH = {
  
  cacheTwitterHandlesForProfileScrape: function(content) {
    const handles = BGFETCH.getTwitterHandlesForProfileScrape(content);
    const key = `${STORAGE_PREFIX.BG.TWITTER_PROFILES_TO_SCRAPE}${Date.now().toString()}`;
    chrome.storage.local.set({ [key]: handles });
  },

  // passed a set of rows per file, where each row is either 
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
  
};