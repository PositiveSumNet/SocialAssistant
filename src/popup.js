const ITEM_SAVED = '(saved) ';
const ITEM_DOWNLOADED = '(downloaded) '
const _guidedNavPageSize = 10;
var _guidedNavPageNum = 1;
var _emptyThreadPage = false;
const _savedThreads = new Set();
const _downloadedVideoUrlKeys = new Set();

// listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // stackoverflow.com/a/73836810
  let returnsData = false;
  switch (request.actionType) {
    case MSGTYPE.TO_POPUP.DEAD_THREAD:
    case MSGTYPE.TO_POPUP.SAVED_THREAD:
    default:
      break;
  }

  (async () => {
    switch (request.actionType) {
      case MSGTYPE.TO_POPUP.DEAD_THREAD:
        // happens if e.g. clicked a protected tweet; want to move on to the next
        hideSpinners();
        await clearDeadThreadUrl(request.parsedUrl);
        await tryAutoAdvance();
        return returnsData;
      case MSGTYPE.TO_POPUP.SAVED_THREAD:
        hideSpinners();
        await onSavedViaNav(request.threadUrlKeys);
        return returnsData;
      case MSGTYPE.TO_POPUP.DOWNLOAD_MEDIA:
        hideSpinners();
        await downloadVideo(request);
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
        const priorTo = SETTINGS.RECORDING.getAutoRecordPriorTo(context);
        const priorToElm = document.getElementById('txtAutoRecordPriorTo');
        if (STR.hasLen(priorTo) && !STR.hasLen(priorToElm.value)) {
          priorToElm.value = priorTo;
        }
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
});
const btnManualPreviewExamplePage = document.getElementById('btnManualPreviewExamplePage');
btnManualPreviewExamplePage.addEventListener('click', async () => {
  const forTweets = document.getElementById('chkManualRecordsTweets').checked == true;
  await viewExamplePage(forTweets);
});

const linkManualSampleDateRange = document.getElementById('linkManualSampleDateRange');
linkManualSampleDateRange.addEventListener('click', async() => {
  await viewSampleForDateRange();
  return false;
});

const viewSampleForDateRange = async function() {
  const url = 'https://twitter.com/search?q=from%3A%40positivesumnet%20until%3A2023-03-01&src=typed_query&f=live';
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  chrome.tabs.update(tab.id, {url: url});
}

document.getElementById('btnDoneNav').addEventListener('click', async () => {
  showRecordingDiv('notYetRecordingSection');
  return false;
});

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

const updateManuallyRecordingWhatDisplay = function(context) {
  const shouldRecordFollows = SETTINGS.RECORDING.getManualRecordsFollows(context);
  document.getElementById('chkManualRecordsFollowLists').checked == shouldRecordFollows;
  
  const shouldRecordTweets = SETTINGS.RECORDING.getManualRecordsTweets(context);
  document.getElementById('chkManualRecordsTweets').checked == shouldRecordTweets;
  
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

  const txtPriorToElm = document.getElementById('txtAutoRecordPriorTo');

  const context = await SETTINGS.RECORDING.getContext();
  context.state = SETTINGS.RECORDING.STATE.AUTO_SCROLL;
  context.auto = {};
  context.auto.owner = STR.stripPrefix(owner, '@');
  context.auto.site = site;
  context.auto.pageType = pageType;
  context.auto.priorTo = txtPriorToElm.value;
  await SETTINGS.RECORDING.saveContext(context);
  const parsedUrl = SETTINGS.RECORDING.getAutoParsedUrl(context);
  SETTINGS.RECORDING.setLastParsedUrl(parsedUrl);

  if (STR.hasLen(txtPriorToElm.value) && !isNaN(STR.dateFromMmDdYyyy(txtPriorToElm.value))) {
    const afterDt = STR.dateFromMmDdYyyy(txtPriorToElm.value);
    await launchTwitterSearchTab(parsedUrl, afterDt);
  }
  else {
    await activateOrLaunchParsedUrlTab(parsedUrl);
  }

  await closeWindow();
});

const btnEscapeAutoRecordingConfig = document.getElementById('btnEscapeAutoRecordingConfig');
btnEscapeAutoRecordingConfig.addEventListener('click', async () => {
  showRecordingDiv('notYetRecordingSection');
});

const updateAutoRecordingWhatDisplay = function(context) {
  let display = 'Recording Twitter';
  let priorTo = '';
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
        priorTo = SETTINGS.RECORDING.getAutoRecordPriorTo(context) || '';
        break;
      default:
        break;
    }

    if (context.auto.site == SITE.NITTER) {
      display = `${display} via Nitter`;
    }
  }

  document.getElementById('btnAutoRecordingWhat').textContent = display;
  document.getElementById('txtAutoRecordPriorTo').value = priorTo;
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
    const pageType = URLPARSE.finalizePageType(parsedUrl.pageType);
    queryString = `?pageType=${pageType}&owner=${owner}`;
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

// https://twitter.com/search?q=from%3A%40positivesumnet%20until%3A2023-03-01&src=typed_query&f=live
const launchTwitterSearchTab = async function(parsedUrl, postedAfterDt) {
  let owner = STR.stripPrefix(parsedUrl.owner, '@');
  const yy = postedAfterDt.getFullYear();
  const mm = STR.padLeft(postedAfterDt.getMonth() + 1, '0', 2);
  const dd = STR.padLeft(postedAfterDt.getDate(), '0', 2);
  const url = `https://x.com/search?q=from%3A%40${owner}%20until%3A${yy}-${mm}-${dd}&src=typed_query&f=live`;
  chrome.tabs.create({ url: url });
}

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
    await SETTINGS.RECORDING.THREAD_EXPANSION.removeThreadExpansionUrlKey(urlKey);
  }
  window.close();
}

// VIDEO
// THREADS & VIDEOS
// top-most screen
const btnChooseThreadFinisher = document.getElementById('btnChooseThreadFinisher');
btnChooseThreadFinisher.addEventListener('click', async () => {
  await enterRecordingFinisherMode(false);
});

const btnChooseVideoExtracter = document.getElementById('btnChooseVideoExtracter');
btnChooseVideoExtracter.addEventListener('click', async () => {
  await enterRecordingFinisherMode(true);
});

const enterRecordingFinisherMode = async function(videoMode) {
  document.getElementById('txtNavFilterOwner').value = SETTINGS.RECORDING.getAuthorFilter();
  await setVideoMode(videoMode);
  await loadThreadList();
  cmbNavThreadHow.value = SETTINGS.RECORDING.getNavxPreferredDomain();
  setNitterTipViz();
  cmbVideoRes.value = SETTINGS.RECORDING.VIDEO_EXTRACTION.getPreferredVideoRes();
  showRecordingDiv('navFinisherSection');
}

const setVideoMode = async function(videoMode) {
  const sectionElm = document.getElementById('navFinisherSection');
  if (videoMode == true) {
    sectionElm.classList.add('videoMode');
  }
  else {
    // thread-finisher mode
    sectionElm.classList.remove('videoMode');
    const minReplies = await SETTINGS.RECORDING.THREAD_EXPANSION.getMinReplyRecording();
    const autoAdvance = await SETTINGS.RECORDING.THREAD_EXPANSION.getAutoAdvance();
    document.getElementById('chkThreadFinishMinReplies').checked = minReplies;
    document.getElementById('chkThreadFinishAutoAdvance').checked = autoAdvance;
  }
}

const getVideoMode = function() {
  const sectionElm = document.getElementById('navFinisherSection');
  return sectionElm.classList.contains('videoMode');
}

// finish-recording screen
// videos
const cmbVideoRes = document.getElementById('cmbVideoRes');
cmbVideoRes.addEventListener('change', (event) => {
  SETTINGS.RECORDING.VIDEO_EXTRACTION.setPreferredVideoRes(cmbVideoRes.value);
});
// threads
const cmbNavThreadHow = document.getElementById('cmbNavThreadHow');
cmbNavThreadHow.addEventListener('change', (event) => {
  setNitterTipViz();
});

const setNitterTipViz = function() {
  const domain = cmbNavThreadHow.value;
  SETTINGS.RECORDING.setNavxPreferredDomain(domain);
  const nitterTip = document.getElementById('nitterTipSection');
  if (domain && domain.indexOf('nitter') > -1) {
    nitterTip.style.visibility = 'visible';
  }
  else {
    nitterTip.style.visibility = 'hidden';
  }
}

const chkThreadFinishMinReplies = document.getElementById('chkThreadFinishMinReplies');
chkThreadFinishMinReplies.addEventListener('change', async function(event) {
  await SETTINGS.RECORDING.THREAD_EXPANSION.saveMinReplyRecording(chkThreadFinishMinReplies.checked);
});

const chkThreadFinishAutoAdvance = document.getElementById('chkThreadFinishAutoAdvance');
chkThreadFinishAutoAdvance.addEventListener('change', async function(event) {
  await SETTINGS.RECORDING.THREAD_EXPANSION.saveAutoAdvance(chkThreadFinishAutoAdvance.checked);
  await tryAutoAdvance();
});

const clearDeadThreadUrl = async function(parsedUrl) {
  const urlKey = STR.makeTweetRelativeUrl(parsedUrl.owner, parsedUrl.threadDetailId);
  let allOptionElms = Array.from(lstNavFinisher.querySelectorAll('option'));
  const matchedOptionElm = allOptionElms.find(function(elm) { return elm.getAttribute('value') == urlKey; });
  if (matchedOptionElm) {
    matchedOptionElm.remove();
  }
  await SETTINGS.RECORDING.THREAD_EXPANSION.removeThreadExpansionUrlKey(urlKey);
}

const tryAutoAdvance = async function() {
  const shouldAutoAdvance = await SETTINGS.RECORDING.THREAD_EXPANSION.getAutoAdvance();
  if (shouldAutoAdvance == true) {
    await autoAdvanceToNextThread();
  }
}

const btnNavFilterOwner = document.getElementById('btnNavFilterOwner');
btnNavFilterOwner.onclick = async function(event) {
  await loadThreadList();
  return false;
};

const lstNavFinisher = document.getElementById('lstNavFinisher');
lstNavFinisher.addEventListener('change', async (event) => {
  await onClickNavFinisher();
});

const onClickNavFinisher = async function() {
  const urlKey = lstNavFinisher.value;
  const videoMode = getVideoMode();
  if (STR.hasLen(urlKey)) {
    let fullUrl;
    if (videoMode == true) {
      let resolution = cmbVideoRes.value;
      fullUrl = STR.buildSquidlrUrl(urlKey, resolution, false);
    }
    else {
      fullUrl = STR.expandTweetUrl(urlKey, cmbNavThreadHow.value);
    }
    let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    showSpinners();
    chrome.tabs.update(tab.id, {url: fullUrl});
    // then via content.js it's automatically recorded (or video navigated-to in the case of squidlr)
  }
}

const showSpinners = function() {
  Array.from(document.querySelectorAll('.spinner-border')).forEach(function(elm) {
    elm.classList.remove('d-none');
  });
}

const hideSpinners = function() {
  Array.from(document.querySelectorAll('.spinner-border')).forEach(function(elm) {
    elm.classList.add('d-none');
  });
}

const loadThreadList = async function() {
  // make sure the setting is stored (in case they didn't hit 'Apply' but they're hitting some other action like 'next page'; they'll still expect textbox edits to take effect on that click)
  SETTINGS.RECORDING.setAuthorFilter(document.getElementById('txtNavFilterOwner').value);
  const owner = SETTINGS.RECORDING.getAuthorFilter();

  const videoMode = getVideoMode();
  const skip = (_guidedNavPageNum - 1) * _guidedNavPageSize;
  
  let urlKeys = [];

  if (videoMode == true) {
    // urlKeys to finish videos
    urlKeys = await SETTINGS.RECORDING.VIDEO_EXTRACTION.getEmbeddedVideoUrlKeys(_guidedNavPageSize, skip, owner);
  }
  else {
    // urlKeys are for visiting and expanding threads
    urlKeys = await SETTINGS.RECORDING.THREAD_EXPANSION.getExpandThreadUrlKeys(_guidedNavPageSize, skip, owner);
  }
  
  let html = '';
  if (urlKeys.length == 0) {
    _emptyThreadPage = true;
  }
  else {
    _emptyThreadPage = false;
    for (let i = 0; i < urlKeys.length; i++) {
      let urlKey = urlKeys[i];
      let threadLabel = writeUrlFinisherLabel(urlKey, videoMode);
      let optHtml = `<option value='${urlKey}'>${threadLabel}</option>`;
      html = STR.appendLine(html, optHtml);
    }
  }

  lstNavFinisher.innerHTML = DOMPurify.sanitize(html);
}

const setExpandThreadsBtnViz = async function() {
  const threadUrlKeys = await SETTINGS.RECORDING.THREAD_EXPANSION.getExpandThreadUrlKeys(1);
  if (threadUrlKeys.length > 0) {
    btnChooseThreadFinisher.style.display = 'block';
  }
  else {
    btnChooseThreadFinisher.style.display = 'none';
  }

  const videoUrlKeys = await SETTINGS.RECORDING.VIDEO_EXTRACTION.getEmbeddedVideoUrlKeys(1);
  if (videoUrlKeys.length > 0) {
    btnChooseVideoExtracter.style.display = 'block';
  }
  else {
    btnChooseVideoExtracter.style.display = 'none';
  }
}

const onSavedViaNav = async function(urlKeys) {
  const videoMode = getVideoMode();
  for (let i = 0; i < urlKeys.length; i++) {
    let urlKey = urlKeys[i];
    if (videoMode == true) {
      _downloadedVideoUrlKeys.add(urlKey);
    }
    else {
      _savedThreads.add(urlKey);
    }
    const optionElms = Array.from(lstNavFinisher.querySelectorAll('option'));
    for (let i = 0; i < optionElms.length; i++) {
      let optionElm = optionElms[i];
      let optionVal = optionElm.getAttribute('value');
      // video workflow drops the #quoted suffix on quote tweet videos
      let optionCompareText = optionVal && videoMode == true ? STR.stripUrlHashSuffix(optionVal) : optionVal;
      if (optionVal && STR.sameText(optionCompareText, urlKey)) {
        optionElm.textContent = writeUrlFinisherLabel(urlKey, videoMode);
      }
    }
  }

  if (!videoMode) {
    const shouldAutoAdvance = await SETTINGS.RECORDING.THREAD_EXPANSION.getAutoAdvance();
    if (shouldAutoAdvance == true) {
      await autoAdvanceToNextThread();
    }
  }
}

const autoAdvanceToNextThread = async function() {
  const selectedUrlKey = lstNavFinisher.value;
  
  // include the selected one plus all that aren't yet processed
  let allOptionElms = Array.from(lstNavFinisher.querySelectorAll('option'));
  
  const relevantUrlKeys = allOptionElms.filter(function(elm) {
    return elm.getAttribute('value') == selectedUrlKey || elm.textContent.indexOf(ITEM_SAVED) < 0;
  }).map(function(elm) {
    return elm.getAttribute('value');
  });

  let nextUrlKey;
  let hitSelected = false;
  for (let i = 0; i < relevantUrlKeys.length; i++) {
    let urlKey = relevantUrlKeys[i];
    if (hitSelected == true) {
      nextUrlKey = urlKey;
      break;
    }
    else if (STR.hasLen(selectedUrlKey) && selectedUrlKey == urlKey) {
      hitSelected = true;
    }
  }

  if (!STR.hasLen(nextUrlKey)) {
    const nextClickCandidates = relevantUrlKeys.filter(function(k) { return !STR.sameText(k, selectedUrlKey); });
    if (nextClickCandidates.length > 0) {
      nextUrlKey = relevantUrlKeys[0];
    }
  }

  if (STR.hasLen(nextUrlKey)) {
    lstNavFinisher.value = nextUrlKey;
    await onClickNavFinisher();
  }
  else {
    if (_emptyThreadPage == true) {
      // we've already loaded an empty page; consider us done
      hideSpinners();
    }
    else {
      // simulate clicking the next button
      await navNextWorker();
      // *and* clicking the first item
      allOptionElms = Array.from(lstNavFinisher.querySelectorAll('option'));
      if (allOptionElms.length == 0) {
        hideSpinners();
      }
      else {
        lstNavFinisher.value = allOptionElms[0].getAttribute('value');
        await onClickNavFinisher();
      }
    }
  }
}

const downloadVideo = async function(request) {
  ES6.downloadMediaFile(request.cdnUrl, request.fileName);
  await onSavedViaNav([request.urlKey]);
}

const writeUrlFinisherLabel = function(urlKey, videoMode) {
  const labelIfDone = (videoMode == true) ? ITEM_DOWNLOADED : ITEM_SAVED;
  const isDone = (videoMode == true) ? _downloadedVideoUrlKeys.has(urlKey) : _savedThreads.has(urlKey);
  let labelToUse = '';
  if (isDone) {
    labelToUse = labelIfDone;
  }
  return `${labelToUse}${urlKey}`;
}

const btnNavPrior = document.getElementById('btnNavPrior');
btnNavPrior.addEventListener('click', async () => {
  if (_guidedNavPageNum > 1) {
    _guidedNavPageNum--;
    await loadThreadList();
  }
  return false;
});

const btnNavNext = document.getElementById('btnNavNext');
btnNavNext.addEventListener('click', async () => {
  await navNextWorker();
  return false;
});

const navNextWorker = async function() {
  const currentPageItemCnt = Array.from(lstNavFinisher.querySelectorAll('option')).length;
  if (currentPageItemCnt > 0) {
    _guidedNavPageNum++;
    await loadThreadList();
  }
}

const btnClearSelNav = document.getElementById('btnClearSelNav');
btnClearSelNav.addEventListener('click', async () => {
  const optElms = Array.from(lstNavFinisher.querySelectorAll('option'));
  const videoMode = getVideoMode();
  for (let i = 0; i < optElms.length; i++) {
    let optElm = optElms[i];
    let urlKey = optElm.getAttribute('value');
    if (videoMode == true) {
      await SETTINGS.RECORDING.VIDEO_EXTRACTION.removeVideoUrlKey(urlKey);
    }
    else {
      await SETTINGS.RECORDING.THREAD_EXPANSION.removeThreadExpansionUrlKey(urlKey);
    }
  }
  
  // reload
  _guidedNavPageNum = 1;
  await loadThreadList(); // load first page

  return false;
});

const btnClearNavAll = document.getElementById('btnClearNavAll');
btnClearNavAll.addEventListener('click', async () => {
  const videoMode = getVideoMode();
  if (videoMode == true) {
    const urlKeys = await SETTINGS.RECORDING.VIDEO_EXTRACTION.getEmbeddedVideoUrlKeys();
    for (let i = 0; i < urlKeys.length; i++) {
      await SETTINGS.RECORDING.VIDEO_EXTRACTION.removeVideoUrlKey(urlKeys[i]);
    }
  }
  else {
    const urlKeys = await SETTINGS.RECORDING.THREAD_EXPANSION.getExpandThreadUrlKeys();
    for (let i = 0; i < urlKeys.length; i++) {
      await SETTINGS.RECORDING.THREAD_EXPANSION.removeThreadExpansionUrlKey(urlKeys[i]);
    }
  }

  // reset
  _guidedNavPageNum = 1;
  setExpandThreadsBtnViz();
  showRecordingDiv('notYetRecordingSection');

  return false;
});

