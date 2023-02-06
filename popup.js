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
        recordTwitterBanner.innerText = 'Privately record who @' + urlInfo.owner + ' is following:';
        break;
      case 'followersOnTwitter':
        recordTwitterBanner.innerText = 'Privately record followers of @' + urlInfo.owner + ':';
        break;
      default:
        break;
    }
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
  kickoffRecording(false);
});

const btnRecTwitterAutoScroll = document.getElementById('btnRecTwitterAutoScroll');
btnRecTwitterAutoScroll.addEventListener('click', () => {
  kickoffRecording(true);
});

const activateApp = function() {
  termsSection.style.display = 'none';
  appSection.style.display = 'block';
}

const kickoffRecording = async function(auto) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

  if (tab && tab.id) {
    
    setBadge(auto);
    
    let response = await chrome.tabs.sendMessage(
      tab.id, 
      {
        actionType: 'recordPage',
        auto: auto
      });
  }
}

const setBadge = function(auto) {
  const text = auto == true ? 'AUTO' : 'REC';
  chrome.action.setBadgeText({text: text});
}
