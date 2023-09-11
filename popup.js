const _threadsPageSize = 10;
var _threadFinisherPage = 1;
const _savedThreads = new Set();

// listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // stackoverflow.com/a/73836810
  let returnsData = false;
  switch (request.actionType) {
    case MSGTYPE.TO_POPUP.SAVED_THREAD:
    default:
      break;
  }

  (async () => {
    switch (request.actionType) {
      case MSGTYPE.TO_POPUP.SAVED_THREAD:
        onSavedThread(request.threadUrlKey);
        return returnsData;
      default:
        return returnsData;
    }
  })();
  return returnsData;
});

chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
  chrome.storage.local.get([SETTINGS.AGREED_TO_TERMS], async function(result) {
    if (result.agreedToTerms == 'true') {
      activateApp();
      await onLoadReflectRecordingContext();
      loopUpdateExpirationDisplay();
    }
  });
});

const onLoadReflectRecordingContext = async function() {
  const context = await SETTINGS.RECORDING.getContext();
  switch (context.state) {
    case SETTINGS.RECORDING.STATE.MANUAL:
      updateManuallyRecordingWhatDisplay(context);
      await updateExpirationDisplay();
      showRecordingDiv('manuallyRecordingSection');
      break;
    case SETTINGS.RECORDING.STATE.AUTO_SCROLL:
      updateAutoRecordingWhatDisplay(context);
      showRecordingDiv('autoRecordingSection');
      break;
    case SETTINGS.RECORDING.STATE.OFF:
    default:
      await setExpandThreadsBtnViz();
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
  const context = await SETTINGS.RECORDING.getContext();
  document.getElementById('chkManualRecordsFollowLists').checked = SETTINGS.RECORDING.getManualRecordsFollows(context);
  const manualRecordsTweets = SETTINGS.RECORDING.getManualRecordsTweets(context);
  document.getElementById('chkManualRecordsTweets').checked = manualRecordsTweets;
  const manualRecordsTweetImages = SETTINGS.RECORDING.getRecordsTweetImages(context);
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
  const lastParsedUrl = await SETTINGS.RECORDING.getLastParsedUrl();
  const currentParsedUrl = await getActiveTabParsedUrl();

  let owner = undefined;
  let pageType = undefined;
  if (currentParsedUrl && !lastParsedUrl) {
    owner = currentParsedUrl.owner;
    pageType = currentParsedUrl.pageType;
  }
  else if (lastParsedUrl && currentParsedUrl) {
    owner = URLPARSE.equivalentParsedUrl(lastParsedUrl, currentParsedUrl, true) == true ? currentParsedUrl.owner : lastParsedUrl.owner;
    pageType = lastParsedUrl.pageType;
  }
  else if (lastParsedUrl) {
    owner = lastParsedUrl.owner;
    pageType = lastParsedUrl.pageType;
  }

  const context = await SETTINGS.RECORDING.getContext();
  let recordTweets = false;
  if (pageType && owner) {
    document.getElementById('txtAutoRecordFor').value = owner;

    switch (pageType) {
      case PAGETYPE.TWITTER.TWEETS:
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

  const chkWithImages = document.getElementById('chkAutoRecordTweetImages');
  chkWithImages.checked = SETTINGS.RECORDING.getRecordsTweetImages(context);

  onUpdateAutoOption();
  // unveil the div
  showRecordingDiv('configureAutoRecordingSection');
});

const btnReviewDb = document.getElementById('btnReviewDb');
btnReviewDb.addEventListener('click', async () => {
  await reviewDb();
  await closeWindow();
});

const btnManualViewExamplePage = document.getElementById('btnManualViewExamplePage');
btnManualViewExamplePage.addEventListener('click', async () => {
  const context = await SETTINGS.RECORDING.getContext();
  const forTweets = context.manual.recordsTweets;
  await viewExamplePage(forTweets);
  await closeWindow();
});
const btnManualPreviewExamplePage = document.getElementById('btnManualPreviewExamplePage');
btnManualPreviewExamplePage.addEventListener('click', async () => {
  const forTweets = document.getElementById('chkManualRecordsTweets').checked == true;
  await viewExamplePage(forTweets);
  await closeWindow();
});

document.getElementById('btnEscapeThreadFinishing').addEventListener('click', async () => {
  showRecordingDiv('notYetRecordingSection');
  return false;
});

const cmbVisitThreadHow = document.getElementById('cmbVisitThreadHow');
cmbVisitThreadHow.addEventListener('change', (event) => {
  const domain = cmbVisitThreadHow.value;
  const nitterTip = document.getElementById('nitterTipSection');
  if (domain && domain.indexOf('nitter') > -1) {
    nitterTip.style.visibility = 'visible';
  }
  else {
    nitterTip.style.visibility = 'hidden';
  }
});

const lstThread = document.getElementById('lstThread');
lstThread.addEventListener('change', async (event) => {
  const urlKey = lstThread.value;
  if (STR.hasLen(urlKey)) {
    const domain = cmbVisitThreadHow.value;
    const fullUrl = STR.expandTweetUrl(urlKey, domain);
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    chrome.tabs.update(tab.id, {url: fullUrl});
  }
});

const btnStartExpandThreadsFlow = document.getElementById('btnChooseThreadFinisher');
btnStartExpandThreadsFlow.addEventListener('click', async () => {
  await loadThreadList();
  showRecordingDiv('threadFinisherSection');
});

const loadThreadList = async function() {
  const skip = (_threadFinisherPage - 1) * _threadsPageSize;
  const threadUrlKeys = await SETTINGS.RECORDING.getExpandThreadUrlKeys(_threadsPageSize, skip);
  let html = '';
  for (let i = 0; i < threadUrlKeys.length; i++) {
    let threadUrlKey = threadUrlKeys[i];
    let threadLabel = writeThreadLabel(threadUrlKey);
    let optHtml = `<option value='${threadUrlKey}'>${threadLabel}</option>`;
    html = STR.appendLine(html, optHtml);
  }
  lstThread.innerHTML = DOMPurify.sanitize(html);
}

const setExpandThreadsBtnViz = async function() {
  const threadUrlKeys = await SETTINGS.RECORDING.getExpandThreadUrlKeys(1);
  if (threadUrlKeys.length > 0) {
    btnStartExpandThreadsFlow.style.display = 'block';
  }
  else {
    btnStartExpandThreadsFlow.style.display = 'none';
  }
}

// visually show that it worked
const onSavedThread = function(threadUrlKey) {
  _savedThreads.add(threadUrlKey);
  const optionElms = Array.from(lstThread.querySelectorAll('option'));
  for (let i = 0; i < optionElms.length; i++) {
    let optionElm = optionElms[i];
    let optionVal = optionElm.getAttribute('value');
    if (optionVal && STR.sameText(optionVal, threadUrlKey)) {
      optionElm.textContent = writeThreadLabel(optionVal);
    }
  }
}

const writeThreadLabel = function(threadUrlKey) {
  let saved = '';
  if (_savedThreads.has(threadUrlKey)) {
    saved = '(saved) '
  }
  return `${saved}${threadUrlKey}`;
}

const viewExamplePage = async function(forTweets) {
  let url = '';
  if (forTweets == true) {
    url = 'https://x.com/positivesumnet/with_replies';
  }
  else {
    url = 'https://x.com/positivesumnet/following';
  }

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  chrome.tabs.update(tab.id, {url: url});
}

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

  const context = await SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.MANUAL;
  context.manual = {};
  context.manual.timeoutAt = ES6.addSeconds(Date.now(), STR.fromFancyTimeToSeconds(document.getElementById('startClockFor').textContent));
  context.manual.recordsFollows = shouldRecordFollows;
  context.manual.recordsTweets = shouldRecordTweets;
  const chkWithImages = document.getElementById('chkManualRecordsTweetImages');
  context.recordsTweetImages = chkWithImages.checked == true;
  if (shouldRecordTweets == true) {
    chkWithImages.disabled = false;
  }
  else {
    chkWithImages.disabled = true;
  }

  await SETTINGS.RECORDING.saveContext(context);

  await closeWindow();
});

const loopUpdateExpirationDisplay = async function() {
  await updateExpirationDisplay();
  setTimeout(async () => {
    await loopUpdateExpirationDisplay();
  }, 1000);
}

const updateExpirationDisplay = async function() {
  let secondsRemaining = await SETTINGS.RECORDING.getManualSecondsRemaining();
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
  }
});

const updateManuallyRecordingWhatDisplay = function(context) {
  const shouldRecordFollows = SETTINGS.RECORDING.getManualRecordsFollows(context);
  document.getElementById('chkManualRecordsFollowLists').checked == shouldRecordFollows;
  
  const shouldRecordTweets = SETTINGS.RECORDING.getManualRecordsTweets(context);
  document.getElementById('chkManualRecordsTweets').checked == shouldRecordTweets;
  
  const chkWithImages = document.getElementById('chkManualRecordsTweetImages');
  if (shouldRecordTweets) {
    chkWithImages.checked = SETTINGS.RECORDING.getRecordsTweetImages(context);
    chkWithImages.disabled = false;
  }
  else {
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

const btnStopManualRecording = document.getElementById('btnStopManualRecording');
btnStopManualRecording.addEventListener('click', async () => {
  await stopRecording();
  await closeWindow();
});

const btnExtendTimer = document.getElementById('btnExtendTimer');
btnExtendTimer.addEventListener('click', async () => {

  const context = await SETTINGS.RECORDING.getContext();
  if (!context || context.state != SETTINGS.RECORDING.STATE.MANUAL || !context.manual || !context.manual.timeoutAt) {
    return;
  }
  else {
    let secondsRemaining = await SETTINGS.RECORDING.getManualSecondsRemaining();
    secondsRemaining += SETTINGS.RECORDING.BOOST_MANUAL_SECONDS;
    context.manual.timeoutAt = ES6.addSeconds(Date.now(), secondsRemaining);
    await SETTINGS.RECORDING.saveContext(context);
  }
});

const btnStartAutoRecording = document.getElementById('btnStartAutoRecording');
btnStartAutoRecording.addEventListener('click', async () => {

  const errDiv = document.getElementById('autoNonSelError');
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

  const site = SITE.TWITTER;
  const owner = document.getElementById('txtAutoRecordFor').value;

  const lblFor = document.getElementById('lblAutoRecordFor');
  if (!owner || owner.length == 0) {
    errDiv.style.display = 'block';
    errDiv.textContent = 'Twitter username must be specified';
    if (!lblFor.classList.contains('danger')) {
      lblFor.classList.add('danger');
    }
    return;
  }
  else {
    errDiv.style.display = 'none';
    if (lblFor.classList.contains('danger')) {
      lblFor.classList.remove('danger');
    }
  }

  const context = await SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.AUTO_SCROLL;
  context.auto = {};
  context.auto.owner = STR.stripPrefix(owner, '@');
  context.auto.site = site;
  context.auto.pageType = pageType;
  context.recordsTweetImages = document.getElementById('chkAutoRecordTweetImages').checked == true;
  await SETTINGS.RECORDING.saveContext(context);
  const parsedUrl = SETTINGS.RECORDING.getAutoParsedUrl(context);
  SETTINGS.RECORDING.setLastParsedUrl(parsedUrl);
  activateOrLaunchParsedUrlTab(parsedUrl);
  await closeWindow();
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

  document.getElementById('btnAutoRecordingWhat').textContent = display;
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

document.querySelectorAll('.optAutoHow').forEach(function(radio) {
  radio.addEventListener('change', (event) => {
    onUpdateAutoOption();
  });
});

const onUpdateAutoOption = function() {
  document.querySelectorAll('.optAutoTweetSetting').forEach(function(opt) {
    if (document.getElementById('optAutoRecordTweets').checked == true) {
      opt.disabled = false;
    }
    else {
      opt.disabled = true;
    }
  });
}

const btnStopAutoRecording = document.getElementById('btnStopAutoRecording');
btnStopAutoRecording.addEventListener('click', async () => {
  await stopRecording();
  // while debugging save, can comment out next line
  await closeWindow();
});

const stopRecording = async function() {
  const context = await SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.OFF;

  if (context.manual) {
    context.manual.timeoutAt = Date.now();
  }

  await SETTINGS.RECORDING.saveContext(context);
  // while debugging save, can comment out next line
  await reviewDb();
}

const getActiveTabParsedUrl = async function() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return URLPARSE.parseUrl(tab.url);
}

const reviewDb = async function() {
  let queryString = '';
  const parsedUrl = await getActiveTabParsedUrl();

  if (parsedUrl) {
    const owner = parsedUrl.owner || '';
    queryString = `?pageType=${parsedUrl.pageType}&owner=${owner}`;
  }
  chrome.tabs.create({url: `index.html${queryString}`});
  
  chrome.action.setBadgeText({text: ''}); // clear badge
}

const activateApp = function() {
  document.getElementById('termsSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
  showRecordingDiv('notYetRecordingSection');
  window.scrollTo(0, 0);
}

const btnAutoRecordingWhat = document.getElementById('btnAutoRecordingWhat');
btnAutoRecordingWhat.addEventListener('click', async () => {
  const recordingContext = await SETTINGS.RECORDING.getContext();
  const contextParsedUrl = SETTINGS.RECORDING.getAutoParsedUrl(recordingContext);
  await activateOrLaunchParsedUrlTab(contextParsedUrl);
  await closeWindow();
});

// activate the tab that has the corresponding url...
// OR open a new tab having it
const activateOrLaunchParsedUrlTab = async function(parsedUrl) {
  const nitterDomain = await SETTINGS.NITTER.getNitterDomain();
  const builtUrl = URLPARSE.buildUrl(parsedUrl, nitterDomain);
  
  const tabs = await chrome.tabs.query({ });
  for (let i = 0; i < tabs.length; i++) {
    let tab = tabs[i];
    // we can only see the tabs that match our manifest pattern and where user has clicked for the popup
    if (tab.url) {
      let tabParsedUrl = URLPARSE.parseUrl(tab.url);
      if (URLPARSE.equivalentParsedUrl(parsedUrl, tabParsedUrl) == true) {
        chrome.tabs.update(tab.id, {selected: true});
        return;
      }
    }
  }

  // none found; launch tab
  chrome.tabs.create({ url: builtUrl });
}

const btnClose = document.getElementById('btnClose');
btnClose.addEventListener('click', async () => {
  await closeWindow();
  return false;
});

const closeWindow = async function() {
  // on close, ensure that all the recently saved thread url keys are removed from local cache
  const urlKeys = Array.from(_savedThreads);
  for (let i = 0; i < urlKeys.length; i++) {
    let urlKey = urlKeys[i];
    await SETTINGS.RECORDING.removeThreadExpansionUrlKey(urlKey);
  }
  window.close();
}