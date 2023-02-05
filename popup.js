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
    let recordBanner = document.getElementById('recordTwitterBanner');
    
    switch (urlInfo.pageType) {
      case 'followingOnTwitter':
        recordBanner.innerText = 'Privately record who @' + urlInfo.owner + ' follows:';
        break;
      case 'followersOnTwitter':
        recordBanner.innerText = 'Privately record who follows @' + urlInfo.owner + ':';
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

const btnManualScroll = document.getElementById('btnManualScroll');
const btnAutoScroll = document.getElementById('btnAutoScroll');
btnManualScroll.addEventListener('click', async () => {
  alert('manually');
});
btnAutoScroll.addEventListener('click', async () => {
  alert('automatically');
});

const activateApp = function() {
  termsSection.style.display = 'none';
  appSection.style.display = 'block';
}

const isTwitterFollowPage = function(tab) {

  if (tab.url.replace("mobile.", "").startsWith('https://twitter.com/')) {
    if (tab.url.endsWith('/following') || tab.url.endsWith('/followers')) {
      return true;
    }
  }
  
  return false;
}

const parseUrl = function(url) {

  var pageType;
  
  if (url.replace("mobile.", "").startsWith('https://twitter.com/')) {
    if (url.endsWith('/following')) {
      pageType = 'followingOnTwitter';
    }
    else if (url.endsWith('/followers')) { 
      pageType = 'followersOnTwitter';
    }
  }
  
  if (pageType == 'followingOnTwitter' || pageType == 'followersOnTwitter') {
    const urlParts = url.split('/');
    const owner = urlParts[urlParts.length - 2];
    
    return {
      pageType: pageType,
      owner: owner
    };
  }
  else {
    return null;
  }
}

