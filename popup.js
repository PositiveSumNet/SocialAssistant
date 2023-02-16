chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
  
  chrome.storage.sync.get(['agreedToTerms'], function(result) {
    if (result.agreedToTerms == 'true') {
      activateApp();
    }
  });
  
  const termsSection = document.getElementById('termsSection');
  const appSection = document.getElementById('appSection');
  
  const urlInfo = parseUrl(tab.url);
  
  if (urlInfo && urlInfo.pageType) {
    document.getElementById('runnablePageMsg').style.display = 'block';
    let recordTwitterBanner = document.getElementById('recordTwitterBanner');
    
    switch (urlInfo.pageType) {
      case 'followingOnTwitter':
        recordTwitterBanner.innerText = 'Cache who @' + urlInfo.owner + ' is following:';
        break;
      case 'followersOnTwitter':
        recordTwitterBanner.innerText = 'Cache followers of @' + urlInfo.owner + ':';
        break;
      default:
        break;
    }
    
    // reflect button visibility based on whether recording
    chrome.storage.local.get(['recording'], function(result) {
      if (result.recording == tab.url) {
        document.getElementById('btnRecTwitterManualScroll').style.display = 'none';
        document.getElementById('btnRecTwitterAutoScroll').style.display = 'none';
        document.getElementById('btnRecStop').style.display = 'block';
      }
      else {
        document.getElementById('btnRecTwitterManualScroll').style.display = 'block';
        document.getElementById('btnRecTwitterAutoScroll').style.display = 'block';
        document.getElementById('btnRecStop').style.display = 'none';
      }
    });
    
  }
  else {
    document.getElementById('invalidPageMsg').style.display = 'block';
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

const btnRecStop = document.getElementById('btnRecStop');
btnRecStop.addEventListener('click', async () => {
  kickoffRecording(false, false);
  reviewDb();
  window.close();
});

const btnReviewDb = document.getElementById('btnReviewDb');
btnReviewDb.addEventListener('click', async () => {
  reviewDb();
  window.close();
});

const reviewDb = function() {
  chrome.tabs.create({url: 'index.html'});
}

const activateApp = function() {
  termsSection.style.display = 'none';
  appSection.style.display = 'block';
}

const kickoffRecording = async function(record, auto) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

  if (tab && tab.id) {
    
    // store knowledge that this page is being recorded
    let actionType = '';
    if (record === true) {
      chrome.storage.local.set({ recording: tab.url });
      actionType = 'startRecording';
    }
    else {
      chrome.storage.local.remove('recording');
      actionType = 'stopRecording';
    }
    
    let response = await chrome.tabs.sendMessage(
      tab.id, 
      {
        actionType: actionType,
        auto: auto
      });
  }
}
