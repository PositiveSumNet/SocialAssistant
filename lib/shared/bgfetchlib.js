// background fetch (via offscreen approach)
// also se comments for the "flow" at offscreen.js
var BGFETCH_REQUEST = {
  
  onCompleteBgScrape: function(parsedUrl) {
    // ensure the next one is kicked off
    chrome.runtime.sendMessage(
      {
        actionType: MSGTYPE.TOBACKGROUND.LETS_SCRAPE,
        lastScrape: parsedUrl
      });
  },

  clearRequests: async function() {
    const all = await chrome.storage.local.get();
    const entries = Object.entries(all);

    for (const [key, val] of entries) { 
      if (key.startsWith(STORAGE_PREFIX.BG_SCRAPE)) {
        chrome.storage.local.remove(key);
      }
    }
  },

  cacheBgRequest: function(records, pageType) {
    const key = `${STORAGE_PREFIX.BG_SCRAPE}${Date.now().toString()}`;
        
    const toStore = {};
    toStore[BG_SCRAPE_TYPE.TOKEN.PAGE_TYPE] = pageType;
    toStore[BG_SCRAPE_TYPE.TOKEN.RECORDS] = records;
    
    chrome.storage.local.set({ [key]: toStore });
  },

  kickoffBackgroundScraping: function() {
    chrome.runtime.sendMessage({ 
      actionType: MSGTYPE.TOBACKGROUND.LETS_SCRAPE
    });
  },

  TWITTER: {

    TWEETS: {
      cacheTweetUrlKeysForHasMoreBgScrape: function(tweets) {
        let urlKeys = [];
        for (let i = 0; i < tweets.length; i++) {
          let tweet = tweets[i];
          if (tweet.hasMore == true) {
            urlKeys.push(tweet.urlKey);
          }
          if (tweet.quoteTweet && tweet.quoteTweet.urlKey && tweet.quoteTweet.hasMore == true) {
            urlKeys.push(tweet.quoteTweet.urlKey);
          }
        }

        BGFETCH_REQUEST.cacheBgRequest(urlKeys, PAGETYPE.TWITTER.TWEETS);
      }
    },
    
    PROFILES: {

      // cache the request
      cacheTwitterHandlesForProfileScrape: function(content) {
        const handles = BGFETCH_REQUEST.TWITTER.PROFILES.getTwitterHandlesForProfileScrape(content);

        if (!handles || handles.length === 0) {
          return;
        }

        BGFETCH_REQUEST.cacheBgRequest(handles, PAGETYPE.TWITTER.PROFILE);
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

    }
  }  
};