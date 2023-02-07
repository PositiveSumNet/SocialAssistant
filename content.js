console.log("Content Script initialized.");

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    
    switch (request.actionType) {
      case 'recordPage':
        
        var parsedUrl = parseUrl(window.location.href);
        
        if (parsedUrl) {
          
          if (parsedUrl.site == 'twitter') {
            recordTwitterPage(parsedUrl);
          }
          
          if (request.auto) {
            // auto-scroll on timer
          }
        }
        break;
      case 'stopRecording':
        // stopRecording();
        // stopScrolling();
        break;
      default:
        break;
    }
    
    //console.log(request);
    //main2();
    success = true;
    sendResponse({auto: request.auto, success: success});
  }
);

const recordTwitterPage = function(parsedUrl) {
  
  const mainColumn = getTwitterMainColumn();
  
  if (!mainColumn) {
    return;
  }
  
  const cumUrlSet = new Set();
  processTwitterFollows(mainColumn, cumUrlSet);
  
  const observer = new MutationObserver((mutationsList, observer) => {
      for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
              const nodes = mutation.addedNodes;
              nodes.forEach(node => {
                processTwitterFollows(node, cumUrlSet);
              });
          }
      }
  });

  observer.observe(mainColumn, { 
      attributes: false, 
      childList: true, 
      subtree: true }
  );
}

const processTwitterFollows = function(parentElm, cumUrlSet) {
  let records = getTwitterFollowsPage(parentElm, cumUrlSet);
  
  for (let i=0; i < records.length; i++) {
    let record = records[i];
    console.log(record);
  }
}

const randomRest = async function(minRestMs, maxRestMs) {
  let restMs = Math.random() * (maxRestMs - minRestMs) + minRestMs;
  await new Promise(r => setTimeout(r, restMs));
}

const saveTextFile = function(txt, filename) {
  const a = document.createElement('a');
  const file = new Blob( [txt], {type: 'text/plain'} );
  
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();

	URL.revokeObjectURL(a.href);
  a.remove();
}

const getPageType = function() {
  const winUrl = window.location.href;
  
  var pageType;
  
  if (winUrl.replace("mobile.", "").startsWith('https://twitter.com/')) {
    if (winUrl.endsWith('/following')) {
      pageType = 'followingOnTwitter';
    }
    else if (winUrl.endsWith('/followers')) { 
      pageType = 'followersOnTwitter';
    }
  }
  
  return pageType;
}

const getTwitterMainColumn = function() {
  const elms = document.querySelectorAll('div[data-testid="primaryColumn"]');
  
  if (elms && elms.length == 1) {
    return elms[0];
  }
  else {
    console.log('Cannot find twitter main column; page structure may have changed.');
  }
}

const getTwitterFollowsPage = function(mainColumn, cumUrlSet) {

  const all = Array.from(mainColumn.getElementsByTagName('a')).map(function(a) {
    return { u: a.getAttribute('href'), d: a.innerText };
  });

  const handles = all.filter(function(a) {
    return a.u.startsWith('/') && a.d.startsWith('@');
  });
  
  const urlSet = new Set(handles.map(function(h) { return h.u }));
  
  const ppl = [];
  
  for (let i=0; i < all.length; i++) {
    const item = all[i];
    
    if (item.u && urlSet.has(item.u) && item.d && !item.d.startsWith('@')) {
      if (!cumUrlSet.has(item.u)) {
        const per = { h: '@' + item.u.substring(1), d: item.d };
        ppl.push(per);
        cumUrlSet.add(item.u);
      }
    }
  }
  
  if (ppl.length > 0) {
    console.table(ppl);
  }
  
  return ppl;
}

// returns true if more remain
const saveTwitterFollowsBatch = async function (owner, pageType, mainColumn, minRest, maxRest, maxPages, plainTextOutput) {
  const cumUrlSet = new Set();
  const allFollows = [];
  let hasMore = true;
  
  for(let i=0; i < maxPages; i++) {
    let pageFollows = getTwitterFollowsPage(mainColumn, cumUrlSet);

    if (pageFollows.length == 0) {
      console.log('checking for false end');
      // try a tiny scroll then resting again before declaring us done
      await randomRest(minRest, maxRest);
      window.scrollBy(0, screen.availHeight * 0.2);
      await randomRest(minRest * 2, maxRest * 2);
      pageFollows = getTwitterFollowsPage(mainColumn, cumUrlSet);

      if (pageFollows.length == 0) {
        hasMore = false;
        break;
      }
    }

    if (pageFollows.length > 0) {
      allFollows.push(...pageFollows);
    }

    window.scrollBy(0, screen.availHeight * 0.8);
    await randomRest(minRest, maxRest);
  }
  
  if (allFollows.length == 0) {
    return false;
  }
  
  const fileName = pageType + '-' + owner + '.txt';
  const result = { owner: owner, type: pageType, records: allFollows };
  
  if (plainTextOutput) {
    // human-readable
    let txt = owner + ' ' + pageType;
    for(let i=0; i < result.records.length; i++) {
      let record = result.records[i];
      txt = txt + '\n' + record.h;
      if (record.d) {
        txt = txt + ' = ' + record.d;
      }
    }
    console.log(txt);
    saveTextFile(txt, fileName);
  }
  else {
    // json
    const json = JSON.stringify(result, null, 2);
    console.log(json);
    saveTextFile(json, fileName);
  }

  window.scrollBy(0, screen.availHeight * 0.8);
  await randomRest(minRest, maxRest);
  
  return hasMore;
}

const recordTwitterFollows = async function(pageType, minRest, maxRest, maxPagesPerBatch, plainTextOutput) {
  const winUrlParts = window.location.href.split('/');
  const owner = winUrlParts[winUrlParts.length - 2];
  
  const mainColumn = getTwitterMainColumn();
  if (!mainColumn) { return; }
  
  console.clear();
  console.log(owner);
  console.log(pageType);
  
  let hasMore = true;
  
  do {
    hasMore = await saveTwitterFollowsBatch(owner, pageType, mainColumn, minRest, maxRest, maxPagesPerBatch, plainTextOutput);
  } while (hasMore == true);
}

const main = async function() {
  const pageType = getPageType();
  
  // expecting about 10 per page, so maxPagesPerBatch of 20 would fetch about 200 before saving one file
  const minRest = 500;  // milliseconds
  const maxRest = 1500;
  const maxPagesPerBatch = 20;
  const plainTextOutput = true;
  
  switch (pageType) {
    case 'followingOnTwitter':
    case 'followersOnTwitter':
      recordTwitterFollows(pageType, minRest, maxRest, maxPagesPerBatch, plainTextOutput);
      break;
    default:
  }
};
