// figured this out by analyzing a-z values from:
// emojipedia.org/regional-indicator-symbol-letter-a/
// console.log('🇦'.charCodeAt(1));
// console.log('a'.charCodeAt(0));
// console.log('🇿'.charCodeAt(1));
// console.log('z'.charCodeAt(0));
const unicodeRegionCharToAscii = function(u) {
  if (u.charCodeAt(0) != 55356) {
    return u;
  }
  
  let ucc = u.charCodeAt(1);
  if (!ucc) { return u; }
  if (ucc < 56806 || ucc > 56831) { return u; }
  let asciCode = ucc - 56709;     // by analyzing regional 'a' vs ascii 'a'
  // convert it to char
  let chr = String.fromCharCode(asciCode);
  return chr;
}

// stackoverflow.com/questions/24531751/how-can-i-split-a-string-containing-emoji-into-an-array
const emojiStringToArray = function (str) {
  const split = str.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/);
  const arr = [];
  for (let i=0; i < split.length; i++) {
    let char = split[i]
    if (char !== "") {
      arr.push(char);
    }
  }
  
  return arr;
};

// microsoft doesn't render flag emojis, so this got funky
// unicode.org/reports/tr51/#EBNF_and_Regex
const _flagRegexCapture = /(\p{RI}\p{RI})/ug;
const injectFlagEmojis = function(raw) {
  if (!raw) { return raw; }
  
  return raw.replace(_flagRegexCapture, function(matched) { 
    const emojiArr = emojiStringToArray(matched);
    const asChars = emojiArr.map(function(u) { return unicodeRegionCharToAscii(u); });
    const concat = asChars.join('');
    return `<i class="flag flag-${concat}"></i>`; 
  });
}

const _emailRexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+(@| at |\(at\))[A-Za-z0-9.-]+(\.| dot |\(dot\))[A-Za-z]{2,4})\b/g;
const renderEmailAnchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_emailRexCapture, function(match) {
    let email = match.trim().replace(' at ', '@').replace('(at)', '@').replace(' dot ', '.').replace('(dot)', '.');
    return `<a href='mailto:${email}' target='_blank'>${match}</a>`;
  });
}

const stripHttpWwwPrefix = function(url) {
  if (!url) { return url; }
  return url.replace('https://','').replace('http://','').replace('www.','');
}

const stripSuffixes = function(txt, suffixes) {
  if (!txt) { return txt; }
  
  for (let i = 0; i < suffixes.length; i++) {
    let suffix = suffixes[i];
    if (txt.endsWith(suffix)) {
      txt = txt.substring(0, txt.length - suffix.length);
    }
  }
  
  return txt;
}

const couldBeMastodonServer = function(url) {
  if (!url) { return false; }
  url = stripSuffixes(url, ['/']); // trim ending slash before evaluating
  url = stripHttpWwwPrefix(url);
  const slashParts = url.split('/');
  if (slashParts.length > 1) { return false; }  // there's more attached
  const dotParts = url.split('.');
  return dotParts.length === 2;  // toad.social
}

const looksLikeMastodonAccountUrl = function(url) {
  if (!url) { return false; }
  url = stripSuffixes(url, ['/']); // trim ending slash before evaluating
  const parts = url.split('/');
  if (parts.length === 0) { return false; }
  const last = parts[parts.length-1];
  return last.startsWith('@');
}

// simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
const _urlRexCapture = /http[s]?:\/\/[^\s]+/g;
const renderUrlAnchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_urlRexCapture, function(url) {
    if (looksLikeMastodonAccountUrl(url) === true) { return url; }
    let display = stripHttpWwwPrefix(url);
    url = stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
    const maxLen = 30;
    if (display.length > maxLen) {
      display = display.substring(0, maxLen) + '...';
    }
    return `<a href='${url}' target='_blank'>${display}</a>`;
  });
}

const renderMastodonAnchor = function(display, handle, domain) {
    const maxLen = 30;
    display = stripHttpWwwPrefix(display);
    if (display.length > maxLen) {
      display = display.substring(0, maxLen) + '...';
    }
    
    let homeServer = getMdonServer();
    if (!couldBeMastodonServer(homeServer)) {
      homeServer = '';
    }
    
    let url;
    if (homeServer && homeServer.length > 0 && homeServer.toLowerCase() != domain.toLowerCase()) {
      // give an url that's clickable directly into a follow (can only follow from one's own home server)
      url = `https://${homeServer}/@${handle}@${domain}`;    
    }
    else {
      url = `https://${domain}/@${handle}`;    
    }
    
    return `<a href='${url}' target='_blank'>${display}</a>`;
}

// regex101.com/r/ac4fG5/1
// @scafaria@toad.social
const _mastodon1RexCapture = /(?:^|\s|\()@([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\b/g;
const renderMastodon1Anchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_mastodon1RexCapture, function(match, handle, domain) {
    return renderMastodonAnchor(match, handle, domain);
  });
}

// toad.social/@scafaria or https://toad.social/@scafaria
const _mastodon2RexCapture = /(?:^|\s|\()(https?:\/\/)?(www\.)?([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\/@([A-Za-z0-9._%+-]+)\b/g;
const renderMastodon2Anchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_mastodon2RexCapture, function(match, http, www, domain, handle) {
    return renderMastodonAnchor(match, handle, domain);
  });
}

// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const _mastodon3RexCapture = /(?:^|\s|\()([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.(social|online))\b/g;
const renderMastodon3Anchors = function(text) {
  if (!text) { return text; }
  
  return text.replace(_mastodon3RexCapture, function(match, handle, domain) {
    return renderMastodonAnchor(match, handle, domain);
  });
}

// guides us as to which links to look for (e.g. so that if we're focused on mdon we don't distract the user with rendered email links)
const getPersonRenderAnchorsRule = function() {
  if (getUiValue('optWithMdon') === true) {
    return 'mdonOnly';
  }
  else if (getUiValue('optWithEmail') === true) {
    return 'emailOnly';
  }
  else if (getUiValue('optWithUrl') === true) {
    return 'urlOnly';
  }
  else {
    return 'all';
  }
}

const prepareDisplayText = function(txt, withAnchors = true) {
  if (!txt) { return txt; }
  txt = injectFlagEmojis(txt);
  
  if (withAnchors) {
    
    const renderRule = getPersonRenderAnchorsRule();
    
    if (renderRule === 'urlOnly' || renderRule === 'all') {
      txt = renderUrlAnchors(txt);
    }
    
    if (renderRule === 'emailOnly' || renderRule === 'all') {
      txt = renderEmailAnchors(txt);
    }
    
    if (renderRule === 'mdonOnly' || renderRule === 'all') {
      txt = renderMastodon1Anchors(txt);
      txt = renderMastodon2Anchors(txt);
      txt = renderMastodon3Anchors(txt);
    }
  }
  
  return txt;
}

// joshwcomeau.com/snippets/javascript/debounce/
const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

const inferImageFileExt = function(url) {
  if (!url) {
    return 'png';
  }
  else if (url.endsWith('.jpg')) {
    return 'jpg';
  }
  else if (url.endsWith('.jpeg')) {
    return 'jpeg';
  }
  else if (url.endsWith('.gif')) {
    return 'gif';
  }
  else {
    return 'png';
  }
}

const findUpClass = function(el, cls, selfCheck = true) {
  if(selfCheck === true && el && el.classList.contains(cls)) { return el; }
  while (el.parentNode) {
    el = el.parentNode;
    if (el.classList.contains(cls)) {
      return el;
    }
  }
  return null;
}

// html grid via webdesign.tutsplus.com/tutorials/pagination-with-vanilla-javascript--cms-41896

// default (legacy) logging
const logHtml = function (cssClass, ...args) {
  const ln = document.createElement('div');
  if (cssClass) ln.classList.add(cssClass);
  ln.append(document.createTextNode(args.join(' ')));
  document.body.append(ln);
};

// specific logging
const logSqliteVersion = function(versionInfo) {
  document.getElementById('sqliteVersionLib').innerHTML = versionInfo.libVersion;
  document.getElementById('sqliteOpfsOk').innerHTML = versionInfo.opfsOk.toString();
  //document.getElementById('sqliteSourceId').innerHTML = versionInfo.sourceId;
}

const logDbScriptVersion = function(versionInfo) {
  document.getElementById('dbScriptNumber').innerHTML = versionInfo.version.toString();
}

const onCopiedToDb = async function(cacheKeys) {
  // we can clear out the cache keys
  for (let i = 0; i < cacheKeys.length; i++) {
    let cacheKey = cacheKeys[i];
    await chrome.storage.local.remove(cacheKey);
  }
  
  // and queue up the next run
  await ensureCopiedToDb();
}

const ensureCopiedToDb = async function() {
  const all = await chrome.storage.local.get();
  const entries = Object.entries(all);
  const xferring = document.getElementById('transferringMsg');
  const followList = document.getElementById('followList');
  
  xferring.innerHTML = 'Copying ' + entries.length + ' pages of data to local database...';
  
  if (entries.length > 0) {
    xferring.style.display = 'block';
    followList.style.display = 'none';
  }
  
  // allow sqlite to do process in larger batches than what was cached
  const batches = [];
  const maxBatches = 10;
  let ctr = 0;
  for (const [key, val] of entries) {
    if (key.startsWith('fordb-')) {
      let batch = { key: key, val: val };
      batches.push(batch);
      ctr++;
      
      if (ctr >= maxBatches) {
        // come back for more rather than sending massive messages around
        break;
      }
    }
  }
  
  if (batches.length > 0) {
    worker.postMessage( { batches: batches, actionType: 'xferCacheToDb' } );
  }
  else {
    // if we got to here, we're fully copied
    xferring.style.display = 'none';
    followList.style.display = 'block';
    initialRender();
  }
}

const initialRender = function() {
  const urlParams = new URLSearchParams(location.search);
  // defaults
  let owner;
  let pageType;
  
  for (const [key, value] of urlParams) {
    if (key === 'owner') {
      owner = value;
    }
    else if (key === 'pageType') {
      pageType = value;
    }
  }
  
  if (owner || pageType) {
    // clear url parms so that a page refresh going forward respects the UI state instead of the query string
    // stackoverflow.com/questions/38625654/remove-url-parameter-without-page-reloading
    const url= document.location.href;
    window.history.pushState({}, "", url.split("?")[0]);
  }
  
  if (!pageType) {
    pageType = getCachedPageType();
  }
  
  initUi(owner, pageType);
}

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
// receive messages from worker
worker.onmessage = function ({ data }) {
  switch (data.type) {
    case 'log':
      // legacy + error logging
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    case 'logSqliteVersion':
      logSqliteVersion(data.payload);
      break;
    case 'logDbScriptVersion':
      logDbScriptVersion(data.payload);
      break;
    case 'workerReady':
      ensureCopiedToDb();
      break;
    case 'copiedToDb':
      onCopiedToDb(data.cacheKeys);
      break;
    case 'renderSuggestedOwner':
      renderSuggestedOwner(data.payload);
      break;
    case 'renderMatchedOwners':
      renderMatchedOwners(data.payload);
      break;
    case 'renderFollows':
      renderFollows(data.payload);
      break;
    case 'renderNetworkSize':
      renderNetworkSize(data.payload);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};

const initUi = function(owner, pageType) {
  // pageType/direction
  pageType = pageType || getCachedPageType() || 'followingOnTwitter';
  
  switch (pageType) {
    case 'followersOnTwitter':
      document.getElementById('optFollowers').checked = true;
      break;
    case 'followingOnTwitter':
      document.getElementById('optFollowing').checked = true;
      break;
    default:
      break;
  }

  // set owner
  owner = owner || getCachedOwner();
  let waitForOwnerCallback = false;
  
  if (!owner || owner.length === 0) {
    // we'll initialize to empty string, but 
    // we'll tell the worker to call us back with the most sensible initial value
    const msg = { 
      actionType: 'suggestOwner', 
      pageType: pageType
    };
    
    waitForOwnerCallback = true;
    worker.postMessage(msg);
  }
  
  txtFollowPivotHandle.value = owner || '';
  
  if (waitForOwnerCallback === false) {
    networkSearch(owner, pageType);
    requestTotalCount();
  }
}

// the Detail returned back when we say "with" email/url/mdon is special and we'd like to bold it
const detailReflectsFilter = function() {
  return getUiValue('optWithMdon') === true || getUiValue('optWithEmail')  === true || getUiValue('optWithUrl') === true;
}

const renderPerson = function(person, context) {
  let roleInfo = '';
  let imgSize = 92;
  let withDetail = true;
  let withAnchors = true;
  
  switch (context) {
    case 'owner':
      imgSize = 46;
      roleInfo = ` role='button'`;  // clickable
      withDetail = false;
      withAnchors = false;
      break;
    case 'followResult':
      break;
    default:
      break;
  }
  
  const imgUrl = person.Img64Url || person.ImgCdnUrl;
  const imgType = inferImageFileExt(person.ImgCdnUrl);
  const imgStyling = `style='width:${imgSize}px;height:${imgSize}px;padding:2px;'`;
  
  let img = '';
  if (person.Img64Url) {
    img = `<img ${imgStyling} src='data:image/${imgType};base64,${person.Img64Url}'/>`;
  }
  else if (person.ImgCdnUrl) {
    img = `<img ${imgStyling} src='${person.ImgCdnUrl}'/>`;
  }
  else {
    img = `<img ${imgStyling} src='/images/noprofilepic.png'/>`;
  }
  
  const handle = person.Handle.startsWith('@') ? person.Handle : '@' + person.Handle;
  const sansAt = handle.startsWith('@') ? handle.substring(1) : handle;
  const preparedDisplayName = prepareDisplayText(person.DisplayName, withAnchors);
  let preparedDetail = prepareDisplayText(person.Detail, withAnchors);
  const filtered = detailReflectsFilter();

  if (filtered === true) {
    preparedDetail = `<b>${preparedDetail}</b>`;
  }

  const detail = (withDetail === true && person.Detail) ? `<div class='personDetail'>${preparedDetail}</div>` : ``;
  
  let renderedHandle = handle;

  // note: if we're focused on e.g. mdon, don't distract with link to twitter
  if (withAnchors && !filtered) {
    renderedHandle = `<a href='https://twitter.com/${sansAt}' target='_blank'>${handle}</a>`;
  }
  
  return `<div class='person row striped pt-1' ${roleInfo}>
    <div class='col-sm-auto'><a href='#' class='canstar text-muted'><i class='bi-star'></i></a></div>
    <div class='col-sm-auto personImg'>${img}</div>
    <div class='col personLabel'>
      <div class='personHandle'>${renderedHandle}</div>
      <div class='personDisplay'>${preparedDisplayName ?? ''}</div>
      ${detail}
    </div>
  </div>`;
}

const renderMatchedOwners = function(payload) {
  const owners = payload.owners;
  listFollowPivotPicker.innerHTML = '';
  
  for (i = 0; i < owners.length; i++) {
    listFollowPivotPicker.innerHTML += renderPerson(owners[i], 'owner');
  }
}

const renderSuggestedOwner = function(payload) {
  const owner = payload.owner;
  
  if (!owner || !owner.Handle || owner.Handle.length === 0) {
    return;
  }
  
  const value = getUiValue('txtFollowPivotHandle');
  
  if (!value || value.length === 0) {
    document.getElementById('txtFollowPivotHandle').value = owner.Handle;
    // we're doing a page init and so far it's empty, so let's
    resetPage();
    networkSearch();
    // if owner or pageType change (or in this case initialized), we want to refresh the total count
    requestTotalCount();
  }
}

const getUiValue = function(id) {
  switch (id) {
    case 'txtFollowPivotHandle':
      return txtFollowPivotHandle.value;
    case 'optFollowDirection':
      return document.getElementById('optFollowers').checked ? 'followers' : 'following';
    case 'txtFollowSearch':
      return txtFollowSearch.value;
    case 'txtPageNum':
      return parseInt(txtPageNum.value);
    case 'chkMutual':
      return chkMutual.checked;
    case 'optWithMdon':
      return optWithMdon.checked;
    case 'optWithEmail':
      return optWithEmail.checked;
    case 'optWithUrl':
      return optWithUrl.checked;
    default:
      return undefined;
  }
}

const getSite = function() {
  // the only one supported for now
  return 'twitter';
}

const getPageType = function(direction) {
  direction = direction || getUiValue('optFollowDirection');
  const site = getSite();
  switch (site) {
    case 'twitter':
      switch (direction) {
        case 'following':
          return 'followingOnTwitter';
        case 'followers':
          return 'followersOnTwitter';
        default:
          return undefined;
      }
      break;
    default:
      return undefined;
  }
}

const getMdonServer = function() {
  return localStorage.getItem('mdonServer');
}

const getPageSize = function() {
  let size = parseInt(localStorage.getItem('pageSize'));
  if (isNaN(size)) { size = 50 };
  return size;
}

const getCachedOwner = function() {
  return localStorage.getItem('networkOwner');
}

const getCachedPageType = function() {
  return localStorage.getItem('pageType');
}

const cachePageState = function(msg) {
  if (!msg) { return; }
  
  if (msg.networkOwner) {
    localStorage.setItem('networkOwner', msg.networkOwner);
  }
  
  if (msg.pageType) {
    localStorage.setItem('pageType', msg.pageType);
  }
}

const resetPage = function() {
  document.getElementById('txtPageNum').value = 1;
}

const getPageNum = function() {
  let pageNum = getUiValue('txtPageNum');
  if (isNaN(pageNum)) { pageNum = 1 };
  return pageNum;
}

const calcSkip = function() {
  const pageNum = getPageNum();
  const pageSize = getPageSize();
  const skip = (pageNum - 1) * pageSize;
  return skip;
}

// this ensures we prompt for server on first-time click of 'w/ mastodon' without them having to click the gear
const onClickedMdonOption = function() {
  const asked = localStorage.getItem('askedMdonServer');
  
  if (!asked) {
    confirmMdonServer();
  }
  
  // continue even if user cancelled the chance to input a mdon server
  resetPage();
  networkSearch();  
}

const confirmMdonServer = function() {
  const mdonServer = getMdonServer() || '';
  const input = prompt("For the best experience, input the Mastodon server where you have an account (e.g. 'toad.social').", mdonServer);
  
  if (input != null) {
    localStorage.setItem('mdonServer', mdonServer);
  }
  
  // even if they cancelled, we'll avoid showing again (they can click the gear if desired)
  localStorage.setItem('askedMdonServer', true);
  return input;
}

const getOwnerFromUi = function() {
  // trim the '@'
  let owner = getUiValue('txtFollowPivotHandle');
  owner = owner && owner.startsWith('@') ? owner.substring(1) : owner;
  return owner;
}

const buildNetworkSearchRequestFromUi = function() {
  const owner = getOwnerFromUi();
  const pageType = getPageType();
  const pageSize = getPageSize();
  const searchText = getUiValue('txtFollowSearch');
  const skip = calcSkip();
  const mutual = getUiValue('chkMutual');
  const withMdon = getUiValue('optWithMdon');
  const withEmail = getUiValue('optWithEmail');
  const withUrl = getUiValue('optWithUrl');
  
  const msg = { 
    actionType: 'networkSearch', 
    pageType: pageType,
    networkOwner: owner, 
    searchText: searchText, 
    orderBy: 'Handle',  // Handle or DisplayName
    skip: skip,
    take: pageSize,
    // filters
    mutual: mutual,
    withMdon: withMdon,
    withEmail: withEmail,
    withUrl: withUrl
    };
  
  return msg;
}

const showNetworkSearchProgress = function(show) {
  const elm = document.getElementById('followListProgress');
  if (show === true) {
    elm.style.visibility = 'visible';
  }
  else {
    elm.style.visibility = 'hidden';
  }
}

const requestTotalCount = function() {
  let owner = getOwnerFromUi();

  if (!owner) {
    return;
  }
  
  const pageType = getPageType();
  const msg = {actionType: 'getNetworkSize', networkOwner: owner, pageType: pageType};
  worker.postMessage(msg);
}

const networkSearch = function() {
  const msg = buildNetworkSearchRequestFromUi();
  cachePageState(msg);
  showNetworkSearchProgress(true);
  worker.postMessage(msg);
}

const setFollowLabelCaption = function(pageType, count) {
  switch (pageType) {
    case 'followingOnTwitter':
      document.getElementById('optFollowingLabel').innerHTML = `following (${count})`;
      return;
    case 'followersOnTwitter':
      document.getElementById('optFollowersLabel').innerHTML = `followers (${count})`;
      return;
    default:
      return;
  }
}

const renderNetworkSize = function(payload) {
  const uiPageType = getPageType();
  const uiOwner = getOwnerFromUi();
  
  if (uiPageType != payload.request.pageType || uiOwner != payload.request.networkOwner) {
    return; // page status has changed since request was made
  }
  
  const count = payload.totalCount;
  setFollowLabelCaption(uiPageType, count);
}

const renderFollows = function(payload) {
  const plist = document.getElementById('paginated-list');
  plist.innerHTML = '';
  
  // rows
  const rows = payload.rows;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    plist.innerHTML += renderPerson(row, 'followResult');
  }
  
  const pageGearTip = `Page size is ${getPageSize()}. Click to modify.`;
  document.getElementById('pageGear').setAttribute("title", pageGearTip);
  
  showNetworkSearchProgress(false);
}

const txtFollowPivotHandle = document.getElementById('txtFollowPivotHandle');
const listFollowPivotPicker = document.getElementById('listFollowPivotPicker');
const optFollowing = document.getElementById('optFollowing');
const optFollowers = document.getElementById('optFollowers');
const followSearch = document.getElementById('txtFollowSearch');
const txtPageNum = document.getElementById('txtPageNum');
const chkMutual = document.getElementById('chkMutual');
const optWithMdon = document.getElementById('optWithMdon');
const optWithEmail = document.getElementById('optWithEmail');
const optWithUrl = document.getElementById('optWithUrl');

optFollowing.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
  // if owner or pageType change, we want to refresh the total count
  requestTotalCount();
})
optFollowers.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
  // if owner or pageType change, we want to refresh the total count
  requestTotalCount();
})

chkMutual.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
})
optWithMdon.addEventListener('change', (event) => {
  onClickedMdonOption();
})
optWithEmail.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
})
optWithUrl.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
})

// searching
const handleTypeSearch = debounce((event) => {
  resetPage();
  networkSearch();
}, 250);
// ... uses debounce
followSearch.addEventListener('input', handleTypeSearch);

// hit enter on page number
txtPageNum.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    networkSearch();
  }
});

// hit enter on account owner
txtFollowPivotHandle.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    resetPage();
    networkSearch();
    // if owner or pageType change, we want to refresh the total count
    requestTotalCount();
  }
});

const suggestAccountOwner = function(userInput) {
  const pageType = getPageType();
  
  worker.postMessage({
    actionType: 'inputFollowOwner',
    pageType: pageType,
    searchText: userInput,
    limit: 5
  });
}

// typeahead for account owner
// w3collective.com/autocomplete-search-javascript/
txtFollowPivotHandle.oninput = function () {
  const userInput = this.value;

  if (!userInput || userInput.length === 0) {
    listFollowPivotPicker.innerHTML = '';
  }
  
  suggestAccountOwner(userInput);
};

// auto-populate with a few owners on-focus (even without typing)
txtFollowPivotHandle.onfocus = function () {
  const userInput = this.value;
  suggestAccountOwner(userInput);
};

// click for prior page
document.getElementById('priorPage').onclick = function(event) {
  const pageNum = getUiValue('txtPageNum');
  if (pageNum > 1) {
    txtPageNum.value = pageNum - 1;
    networkSearch();
  }
  return false;
};

document.getElementById('nextPage').onclick = function(event) {
  const pageNum = getPageNum();
  txtPageNum.value = pageNum + 1;
  networkSearch();
  return false;
};

document.getElementById('pageGear').onclick = function(event) {
  const pageSize = getPageSize();
  const input = prompt("Choose page size", pageSize.toString());
  
  if (input != null) {
    const intVal = parseInt(input);
    if (isNaN(intVal)) {
      alert("Invalid input; page size unchanged");
    }
    else {
      localStorage.setItem('pageSize', intVal);
      resetPage();
      networkSearch();
    }
  }
  return false;
};

document.getElementById('mdonGear').onclick = function(event) {
  const mdonServer = confirmMdonServer();
  
  if (mdonServer != null) {
    // re-render
    optWithMdon.checked = true;
    networkSearch();
  }
  return false;
};

// choose owner from typeahead results
listFollowPivotPicker.onclick = function(event) {
  const personElm = findUpClass(event.target, 'person');
  const handleElm = personElm.querySelector('.personLabel > .personHandle');
  let handleText = handleElm.innerText;
  handleText = handleText.startsWith('@') ? handleText.substring(1) : handleText;
  txtFollowPivotHandle.value = handleText;
  this.innerHTML = "";
  // trigger the same action as hitting "Enter"
  networkSearch();
  // if owner or pageType change, we want to refresh the total count
  requestTotalCount();
};
