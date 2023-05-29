chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
  onLoadReflectRecordingContext();
  loopUpdateExpirationDisplay();
  chrome.storage.local.get([SETTINGS.AGREED_TO_TERMS], function(result) {
    if (result.agreedToTerms == 'true') {
      activateApp();
    }
  });
});

const onLoadReflectRecordingContext = function() {
  const context = SETTINGS.RECORDING.getContext();
  switch (context.state) {
    case SETTINGS.RECORDING.STATE.MANUAL:
      updateManuallyRecordingWhatDisplay(context);
      updateExpirationDisplay();
      showRecordingDiv('manuallyRecordingSection');
      break;
    case SETTINGS.RECORDING.STATE.AUTO_SCROLL:
      showRecordingDiv('autoRecordingSection');
      break;
    case SETTINGS.RECORDING.STATE.OFF:
    default:
      showRecordingDiv('notYetRecordingSection');
      break;
  }
}

const btnAgreeToTerms = document.getElementById('btnAgreeToTerms');
btnAgreeToTerms.addEventListener('click', async () => {
  chrome.storage.local.set({ agreedToTerms: 'true' }).then(() => activateApp());
});

const btnChooseManual = document.getElementById('btnChooseManual');
btnChooseManual.addEventListener('click', async () => {
  // prep the ui with default values
  const context = SETTINGS.RECORDING.getContext();

  document.getElementById('chkManualRecordsFollowLists').checked = SETTINGS.RECORDING.getManualRecordsFollows(context);
  const manualRecordsTweets = SETTINGS.RECORDING.getManualRecordsTweets(context);
  document.getElementById('chkManualRecordsTweets').checked = manualRecordsTweets;
  const manualRecordsTweetImages = SETTINGS.RECORDING.getManualRecordsTweetImages(context);
  const tweetImagesElm = document.getElementById('chkManualRecordsTweetImages');
  tweetImagesElm.checked = manualRecordsTweetImages;
  tweetImagesElm.disabled = !manualRecordsTweets;

  // now the timer
  document.getElementById('startClockFor').textContent = STR.toFancyTimeFormat(SETTINGS.RECORDING.DEFAULT_MANUAL_SECONDS);

  // unveil the div
  showRecordingDiv('configureManualRecordingSection');
});

const btnChooseAutoScroll = document.getElementById('btnChooseAutoScroll');
btnChooseAutoScroll.addEventListener('click', async () => {
  const parsedUrl = SETTINGS.RECORDING.getLastParsedUrl();
  const context = SETTINGS.RECORDING.getContext();
  let recordTweets = false;
  if (parsedUrl && parsedUrl.owner) {
    document.getElementById('txtAutoRecordFor').value = parsedUrl.owner;

    switch (parsedUrl.pageType) {
      case PAGETYPE.TWITTER.TWEETS:
      case PAGETYPE.NITTER.TWEETS:
        document.getElementById('optAutoRecordTweets').checked = true;
        recordTweets = true;
        break;
      case PAGETYPE.TWITTER.FOLLOWERS:
        document.getElementById('optAutoRecordFollowers').checked = true;
        break;
      case PAGETYPE.TWITTER.FOLLOWING:
      default:
        document.getElementById('optAutoRecordFollowing').checked = true;
        break;
    }
  }
  else {
    document.getElementById('optAutoRecordFollowing').checked = true;
  }

  const optViaNitter = document.getElementById('optAutoRecordViaNitter');
  const optViaTwitter = document.getElementById('optAutoRecordViaTwitter')
  const chkWithImages = document.getElementById('chkAutoRecordTweetImages');
  const chkResolveThreads = document.getElementById('chkAutoRecordResolvesThreads');
  if (recordTweets == true) {
    let viaNitter = SETTINGS.RECORDING.getAutoViaNitter(getAutoViaNitter);
    optViaNitter.disabled = false;
    optViaTwitter.disabled = false;

    switch (viaNitter) {
      case true:
        optViaNitter.checked = true;
        break;
      case false:
        optViaTwitter.checked = true;
        break;
      case undefined:
      default:
        // neither selected yet; make user choose
        break;
    }

    chkWithImages.checked = SETTINGS.RECORDING.getAutoRecordsTweetImages(context);
    chkWithImages.disabled = false;
    chkResolveThreads.checked = SETTINGS.RECORDING.getAutoRecordResolvesThreads(context);
    chkResolveThreads.disabled = false;
  }
  else {
    chkWithImages.checked = false;
    chkWithImages.disabled = true;
    chkResolveThreads.checked = false;
    chkResolveThreads.disabled = true;
  }

  // unveil the div
  showRecordingDiv('configureAutoRecordingSection');
});

const btnReviewDb = document.getElementById('btnReviewDb');
btnReviewDb.addEventListener('click', async () => {
  await reviewDb();
  window.close();
});

const btnStartManualRecording = document.getElementById('btnStartManualRecording');
btnStartManualRecording.addEventListener('click', async () => {
  
  const shouldRecordFollows = document.getElementById('chkManualRecordsFollowLists').checked == true;
  const shouldRecordTweets = document.getElementById('chkManualRecordsTweets').checked == true;

  if (shouldRecordFollows == false && shouldRecordTweets == false) {
    document.getElementById('manualNonSelError').style.display = 'block';
    return;
  }
  else {
    document.getElementById('manualNonSelError').style.display = 'none';
  }

  const context = SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.MANUAL;
  context.manual = {};
  context.manual.timeoutAt = ES6.addSeconds(Date.now(), STR.fromFancyTimeToSeconds(document.getElementById('startClockFor').textContent));
  context.manual.recordsFollows = shouldRecordFollows;
  context.manual.recordsTweets = shouldRecordTweets;
  const chkWithImages = document.getElementById('chkManualRecordsTweetImages');
  context.manual.recordsTweetImages = chkWithImages.checked == true;
  if (shouldRecordTweets == true) {
    chkWithImages.disabled = false;
  }
  else {
    chkWithImages.disabled = true;
  }

  SETTINGS.RECORDING.saveContext(context);

  window.close();
});

const loopUpdateExpirationDisplay = function() {
  updateExpirationDisplay();
  setTimeout(() => {
    loopUpdateExpirationDisplay();
  }, 1000);
}

const updateExpirationDisplay = function() {
  let secondsRemaining = SETTINGS.RECORDING.getManualSecondsRemaining();
  let secondsDisplay = STR.toFancyTimeFormat(secondsRemaining);
  document.getElementById('sessionExpiration').textContent = secondsDisplay;
}

const chkManualRecordsTweets = document.getElementById('chkManualRecordsTweets');
chkManualRecordsTweets.addEventListener('change', (event) => {
  const chkWithImages = document.getElementById('chkManualRecordsTweetImages');
  if (event.target.checked == true) {
    chkWithImages.disabled = false;
  }
  else {
    chkWithImages.disabled = true;
    chkWithImages.checked = false;
  }
});

const updateManuallyRecordingWhatDisplay = function(context) {
  const shouldRecordFollows = SETTINGS.RECORDING.getManualRecordsFollows(context);
  document.getElementById('chkManualRecordsFollowLists').checked == shouldRecordFollows;
  
  const shouldRecordTweets = SETTINGS.RECORDING.getManualRecordsTweets(context);
  document.getElementById('chkManualRecordsTweets').checked == shouldRecordTweets;
  
  const chkWithImages = document.getElementById('chkManualRecordsTweetImages');
  if (shouldRecordTweets) {
    chkWithImages.checked = SETTINGS.RECORDING.getManualRecordsTweetImages(context);
    chkWithImages.disabled = false;
  }
  else {
    chkWithImages.checked = false;
    chkWithImages.disabled = true;
  }

  let display = '';
  if (shouldRecordFollows == true && shouldRecordTweets) {
    display = ' (follows and tweets)';
  }
  else if (shouldRecordFollows == true) {
    display = ' (follows)';
  }
  else if (shouldRecordTweets == true) {
    display = ' (tweets)';
  }
  document.getElementById('manuallyRecordingWhat').textContent = display;
}

const btnEscapeManualRecordingConfig = document.getElementById('btnEscapeManualRecordingConfig');
btnEscapeManualRecordingConfig.addEventListener('click', async () => {
  showRecordingDiv('notYetRecordingSection');
});

const btnExtendTimer = document.getElementById('btnExtendTimer');
btnExtendTimer.addEventListener('click', async () => {

  const context = SETTINGS.RECORDING.getContext();
  if (!context || context.state != SETTINGS.RECORDING.STATE.MANUAL || !context.manual || !context.manual.timeoutAt) {
    return;
  }
  else {
    let secondsRemaining = SETTINGS.RECORDING.getManualSecondsRemaining();
    secondsRemaining += SETTINGS.RECORDING.BOOST_MANUAL_SECONDS;
    context.manual.timeoutAt = ES6.addSeconds(Date.now(), secondsRemaining);
    SETTINGS.RECORDING.saveContext(context);
  }
});

const btnStartAutoRecording = document.getElementById('btnStartAutoRecording');
btnStartAutoRecording.addEventListener('click', async () => {
  
  let site = document.getElementById('optAutoRecordViaNitter').checked == true ? SITE.NITTER : SITE.TWITTER;
  let pageType = '';
  let forTweets = false;
  if (document.getElementById('optAutoRecordTweets').checked == true) {
    forTweets = true;
    pageType = PAGETYPE.TWITTER.TWEETS;
  }
  else if (document.getElementById('optAutoRecordFollowers').checked == true) {
    pageType = PAGETYPE.TWITTER.FOLLOWERS;
  }
  else {
    pageType = PAGETYPE.TWITTER.FOLLOWING;
  }

  const context = SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.AUTO;
  context.auto = {};
  context.auto.owner = document.getElementById('txtAutoRecordFor').value;
  context.auto.site = site;
  context.auto.pageType = pageType;
  context.auto.recordsTweetImages = forTweets && document.getElementById('chkAutoRecordTweetImages').checked == true;
  context.auto.resolvesThreads = forTweets && document.getElementById('chkAutoRecordResolvesThreads').checked == true;
  SETTINGS.RECORDING.saveContext(context);

  window.close();
});

const btnEscapeAutoRecordingConfig = document.getElementById('btnEscapeAutoRecordingConfig');
btnEscapeAutoRecordingConfig.addEventListener('click', async () => {
  showRecordingDiv('notYetRecordingSection');
});

const updateAutoRecordingWhatDisplay = function(context) {
  let display = 'Recording Twitter';
  if (context && context.auto && context.auto.owner) {
    switch (context.auto.pageType) {
      case PAGETYPE.TWITTER.FOLLOWERS:
        display = `Followers of ${STR.ensurePrefix(context.auto.owner, '@')}`;
        break;
      case PAGETYPE.TWITTER.FOLLOWING:
        display = `Followed by ${STR.ensurePrefix(context.auto.owner, '@')}`;
        break;
      case PAGETYPE.TWITTER.TWEETS:
        display = `${STR.ensurePrefix(context.auto.owner, '@')} tweets`;
        break;
      default:
        break;
    }

    if (context.auto.site == SITE.NITTER) {
      display = `${display} via Nitter`;
    }
  }

  document.getElementById('autoRecordingStatus').textContent = display;
}

const showRecordingDiv = function(sectionId) {
  document.querySelectorAll('.appRecordingSection').forEach(function(elm) {
    if (elm.id != sectionId) {
      elm.style.display = 'none';
    }
    else {
      elm.style.display = 'block';
    }
  });
}

const btnStopManualRecording = document.getElementById('btnStopManualRecording');
btnStopManualRecording.addEventListener('click', async () => {
  await stopRecording();
  window.close();
});

const btnStopAutoRecording = document.getElementById('btnStopAutoRecording');
btnStopAutoRecording.addEventListener('click', async () => {
  await stopRecording();
  window.close();
});

const stopRecording = async function() {
  const context = SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.OFF;
  context.manual.timeoutAt = Date.now();
  SETTINGS.RECORDING.saveContext(context);
  await reviewDb();
}

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
  document.getElementById('termsSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
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
