chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
  
  chrome.storage.sync.get([SETTINGS.AGREED_TO_TERMS], function(result) {
    if (result.agreedToTerms == 'true') {
      activateApp();
    }
  });
  
  const termsSection = document.getElementById('termsSection');
  const appSection = document.getElementById('appSection');
  
  const urlInfo = URLPARSE.parseUrl(tab.url);
  
  if (urlInfo && urlInfo.pageType) {
    document.getElementById('runnableTwitterPageMsg').style.display = 'block';
    let recordTwitterBanner = document.getElementById('recordTwitterBanner');
    
    switch (urlInfo.pageType) {
      case PAGETYPE.TWITTER.FOLLOWING:
        recordTwitterBanner.innerText = 'Cache who @' + urlInfo.owner + ' is following';
        break;
      case PAGETYPE.TWITTER.FOLLOWERS:
        recordTwitterBanner.innerText = 'Cache followers of @' + urlInfo.owner;
        break;
      default:
        break;
    }
    
    // reflect button visibility based on whether recording
    chrome.storage.local.get([SETTINGS.RECORDING], function(result) {
      let isRecording = (result.recording === true);
      let ifRecordings = document.getElementsByClassName('ifRecording');
      for (let i = 0; i < ifRecordings.length; i++) {
        let elm = ifRecordings[i];
        let displayStyle = 'block';
        
        if (isRecording === true && elm.classList.contains('hideIfRecording')) {
          displayStyle = 'none';
        }
        else if (isRecording === false && elm.classList.contains('hideIfNotRecording')) {
          displayStyle = 'none';
        }
        
        elm.style.display = displayStyle;
      }
    });
    
  }
  else {
    document.getElementById('invalidTwitterPageMsg').style.display = 'block';
  }
});

const btnAgreeToTerms = document.getElementById('btnAgreeToTerms');
btnAgreeToTerms.addEventListener('click', async () => {
  chrome.storage.sync.set({ agreedToTerms: 'true' }).then(() => activateApp());
});

const btnRecTwitterManualScroll = document.getElementById('btnRecTwitterManualScroll');
btnRecTwitterManualScroll.addEventListener('click', () => {
  kickoffRecording(true, false);
  window.close();
});

const btnRecTwitterAutoScroll = document.getElementById('btnRecTwitterAutoScroll');
btnRecTwitterAutoScroll.addEventListener('click', () => {
  kickoffRecording(true, true);
  window.close();
});

const btnRecTwitterStop = document.getElementById('btnRecTwitterStop');
btnRecTwitterStop.addEventListener('click', async () => {
  kickoffRecording(false, false);
  reviewDb();
  window.close();
});

const btnReviewDb = document.getElementById('btnReviewDb');
btnReviewDb.addEventListener('click', async () => {
  await reviewDb();
  window.close();
});

const reviewDb = async function() {
  let queryString = '';
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const urlInfo = URLPARSE.parseUrl(tab.url);
  if (urlInfo) {
    queryString = `?pageType=${urlInfo.pageType}&owner=${urlInfo.owner}`;
  }
  chrome.tabs.create({url: `index.html${queryString}`});
  
  chrome.action.setBadgeText({text: ''}); // clear badge
}

const activateApp = function() {
  termsSection.style.display = 'none';
  appSection.style.display = 'block';
}

const kickoffRecording = async function(record, auto) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

  if (tab && tab.id) {
    
    let actionType = '';
    if (record === true) {
      chrome.storage.local.set({ recording: true });
      actionType = MSGTYPE.RECORDING.START;
    }
    else {
      chrome.storage.local.remove('recording');
      actionType = MSGTYPE.RECORDING.STOP;
    }
    
    let response = await chrome.tabs.sendMessage(
      tab.id, 
      {
        actionType: actionType,
        auto: auto
      });
  }
}
