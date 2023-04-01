// hollow if not favorited
const _starOffCls = 'bi-star';
const _starOnCls = 'bi-star-fill'

// avoid double-submit
var _lastRenderedFollowsRequest = '';

// improves experience of deleting in owner textbox
var _deletingOwner = false;
var _lastOwner = '';

// so we can reduce how many times we ask for (expensive) total counts
var _counterSet = new Set();
var _counters = [];

// guides us as to which links to look for (e.g. so that if we're focused on mdon we don't distract the user with rendered email links)
const getPersonRenderAnchorsRule = function() {
  if (getUiValue('optWithMdon') === true) {
    return RENDER_CONTEXT.ANCHORS.MDON_ONLY;
  }
  else if (getUiValue('optWithEmail') === true) {
    return RENDER_CONTEXT.ANCHORS.EMAIL_ONLY;
  }
  else if (getUiValue('optWithUrl') === true) {
    return RENDER_CONTEXT.ANCHORS.EXTURL_ONLY;
  }
  else {
    return RENDER_CONTEXT.ANCHORS.ALL;
  }
}

// when sqlite pushes unhandled exception log messages, they log (ugly) as rendered divs
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
  // if concurrent access becomes a problem, we can revert to hiding the list while importing (for now commented out)
  const filterSet = document.getElementById('listFilterSet');
  const connList = document.getElementById('connList');
  
  xferring.innerHTML = 'Copying ' + entries.length + ' pages to local database...';
  
  if (entries.length > 0) {
    xferring.style.display = 'inline-block';
    //filterSet.style.display = 'none';
    //connList.style.display = 'none';
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
    worker.postMessage( { batches: batches, actionType: MSGTYPE.TODB.XFER_CACHE_TODB } );
  }
  else {
    // if we got to here, we're fully copied
    xferring.style.display = 'none';
    //filterSet.style.display = 'flex';
    //connList.style.display = 'flex';
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
    pageType = SETTINGS.getCachedPageType();
  }
  
  initUi(owner, pageType);
}

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
// receive messages from worker
worker.onmessage = function ({ data }) {
  switch (data.type) {
    case MSGTYPE.FROMDB.LOG.LEGACY:
      // legacy + error logging
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    case MSGTYPE.FROMDB.LOG.SQLITE_VERSION:
      logSqliteVersion(data.payload);
      break;
    case MSGTYPE.FROMDB.LOG.DB_SCRIPT_VERSION:
      logDbScriptVersion(data.payload);
      break;
    case MSGTYPE.FROMDB.WORKER_READY:
      ensureCopiedToDb();
      break;
    case MSGTYPE.FROMDB.COPIED_TODB:
      onCopiedToDb(data.cacheKeys);
      break;
    case MSGTYPE.FROMDB.RENDER.SUGGESTED_OWNER:
      renderSuggestedOwner(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS:
      renderMatchedOwners(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.CONNECTIONS:
      renderConnections(data.payload);
      break;
    case MSGTYPE.FROMDB.RENDER.NETWORK_SIZE:
      renderNetworkSize(data.payload);
      break;
    case MSGTYPE.FROMDB.EXPORT.RETURN_EXPORTED_RESULTS:
      handleExportedResults(data.payload);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};

const initUi = function(owner, pageType) {
  // pageType/direction
  pageType = pageType || SETTINGS.getCachedPageType() || PAGETYPE.TWITTER.FOLLOWING;
  
  switch (pageType) {
    case PAGETYPE.TWITTER.FOLLOWERS:
      document.getElementById('optFollowers').checked = true;
      break;
    case PAGETYPE.TWITTER.FOLLOWING:
      document.getElementById('optFollowing').checked = true;
      break;
    default:
      break;
  }

  // set owner
  owner = owner || SETTINGS.getCachedOwner();
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
  
  txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
  
  if (waitForOwnerCallback === false) {
    networkSearch(owner, pageType);
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
    case RENDER_CONTEXT.PERSON.ACCOUNT_OWNER:
      imgSize = 46;
      roleInfo = ` role='button'`;  // clickable
      withDetail = false;
      withAnchors = false;
      break;
    case RENDER_CONTEXT.PERSON.FOLLOW_RESULT:
      break;
    default:
      break;
  }
  
  const imgType = STR.inferImageFileExt(person.ImgCdnUrl);
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
  const renderAnchorsRule = getPersonRenderAnchorsRule();
  const preparedDisplayName = RENDER.prepareDisplayText(person.DisplayName, withAnchors, renderAnchorsRule);
  let preparedDetail = RENDER.prepareDisplayText(person.Detail, withAnchors, renderAnchorsRule);
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
  
  let starCls = _starOffCls;
  if (person.InList == 1 && person.ListName === LIST_FAVORITES) {
    starCls = _starOnCls;
  }
  
  return `<div class='person row striped pt-1' ${roleInfo}>
    <div class='col-sm-auto'><a href='#' class='canstar' data-testid='${sansAt}'><i class='${starCls}'></i></a></div>
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
  listOwnerPivotPicker.innerHTML = '';
  
  if (owners.length === 1 && !_deletingOwner) {
    // exact match; pick it! (after an extra check that the user isn't 
    // trying to delete, in which case auto-complete would be annoying)
    txtOwnerHandle.value = STR.stripPrefix(owners[0].Handle, '@');
    onChooseOwner();
  }
  else {
    for (i = 0; i < owners.length; i++) {
      listOwnerPivotPicker.innerHTML += renderPerson(owners[i], 'owner');
    }
  }
}

const renderSuggestedOwner = function(payload) {
  const owner = payload.owner;
  if (!owner || !owner.Handle || owner.Handle.length === 0) {
    return;
  }
  
  const value = getUiValue('txtOwnerHandle');
  
  if (!value || value.length === 0) {
    document.getElementById('txtOwnerHandle').value = owner.Handle;
    // we're doing a page init and so far it's empty, so let's
    resetPage();
    networkSearch();
  }
}

const getUiValue = function(id) {
  switch (id) {
    case 'txtOwnerHandle':
      return txtOwnerHandle.value;
    case 'optFollowDirection':
      return document.getElementById('optFollowers').checked ? 'followers' : 'following';
    case 'txtConnSearch':
      return txtConnSearch.value;
    case 'txtPageNum':
      return parseInt(txtPageNum.value);
    case 'chkMutual':
      return chkMutual.checked;
    case 'chkFavorited':
      return chkFavorited.checked;
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
  return SITE.TWITTER;
}

const getPageType = function(direction) {
  direction = direction || getUiValue('optFollowDirection');
  const site = getSite();
  switch (site) {
    case SITE.TWITTER:
      switch (direction) {
        case 'following':
          return PAGETYPE.TWITTER.FOLLOWING;
        case 'followers':
          return PAGETYPE.TWITTER.FOLLOWERS;
        default:
          return undefined;
      }
      break;
    default:
      return undefined;
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
  const pageSize = SETTINGS.getPageSize();
  const skip = (pageNum - 1) * pageSize;
  return skip;
}

// this ensures we prompt for server on first-time click of 'w/ mastodon' without them having to click the gear
const onClickedMdonOption = function() {
  const asked = SETTINGS.getAskedMdonServer();
  
  if (!asked) {
    confirmMdonServer();
  }
  
  // continue even if user cancelled the chance to input a mdon server
  resetPage();
  networkSearch();  
}

const confirmMdonServer = function() {
  const mdonServer = SETTINGS.getMdonServer() || '';
  const input = prompt("For the best experience, input the Mastodon server where you have an account (e.g. 'toad.social').", mdonServer);
  
  if (input != null) {
    localStorage.setItem(SETTINGS.MDON_SERVER, mdonServer);
  }
  
  // even if they cancelled, we'll avoid showing again (they can click the gear if desired)
  localStorage.setItem(SETTINGS.ASKED.MDON_SERVER, true);
  return input;
}

const getOwnerFromUi = function() {
  // trim the '@'
  let owner = getUiValue('txtOwnerHandle');
  owner = owner && owner.startsWith('@') ? owner.substring(1) : owner;
  return owner;
}

const buildNetworkSearchRequestFromUi = function() {
  const owner = STR.ensurePrefix(getOwnerFromUi(), '@');  // prefixed in the db
  const pageType = getPageType();
  const pageSize = SETTINGS.getPageSize();
  const searchText = getUiValue('txtConnSearch');
  const skip = calcSkip();
  const mutual = getUiValue('chkMutual');
  const favorited = getUiValue('chkFavorited');
  const withMdon = getUiValue('optWithMdon');
  const withEmail = getUiValue('optWithEmail');
  const withUrl = getUiValue('optWithUrl');
  
  const msg = { 
    actionType: MSGTYPE.TODB.NETWORK_SEARCH, 
    pageType: pageType,
    networkOwner: owner, 
    searchText: searchText, 
    orderBy: 'Handle',  // Handle or DisplayName
    skip: skip,
    take: pageSize,
    // filters
    mutual: mutual,
    list: LIST_FAVORITES,
    requireList: favorited,
    withMdon: withMdon,
    withEmail: withEmail,
    withUrl: withUrl
    };
  
  return msg;
}

const showNetworkSearchProgress = function(show) {
  const elm = document.getElementById('connListProgress');
  if (show === true) {
    elm.style.visibility = 'visible';
  }
  else {
    elm.style.visibility = 'hidden';
  }
}

const makeNetworkSizeCounterKey = function(owner, pageType) {
  return `${owner}-${pageType}`;
}

const requestTotalCount = function() {
  const owner = getOwnerFromUi();

  if (!owner) {
    return;
  }
  
  const pageType = getPageType();
  
  const key = makeNetworkSizeCounterKey(owner, pageType);
  if (_counterSet.has(key)) {
    const counter = _counters.find(function(c) { return c.key === key; });
    if (counter && counter.value) {
      // we already have this count cached; apply it
      setFollowLabelCaption(pageType, counter.value);
    }
    // else wait for fetch to finish; either way, we're done
    return;
  }
  
  const atOwner = STR.ensurePrefix(owner, '@'); // DB includes @ prefix
  const msg = {actionType: 'getNetworkSize', networkOwner: atOwner, pageType: pageType};
  
  worker.postMessage(msg);
  // record knowledge that this count has been requested
  _counterSet.add(key);
  _counters.push({key: key});   // value not set yet; will be when called back
}

const networkSearch = function() {
  const msg = buildNetworkSearchRequestFromUi();
  const requestJson = JSON.stringify(msg);
  
  if (_lastRenderedFollowsRequest === requestJson) {
    // we already have this rendered; avoid double-submission
    return;
  }
  
  SETTINGS.cachePageState(msg);
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
  
  const dbOwnerSansPrefix = STR.stripPrefix(payload.request.networkOwner, '@');
  
  if (uiPageType != payload.request.pageType || uiOwner != dbOwnerSansPrefix) {
    return; // page status has changed since request was made
  }
  
  const key = makeNetworkSizeCounterKey(uiOwner, uiPageType);
  let counter = _counters.find(function(c) { return c.key === key; });
  
  if (!counter) {
    counter = {key: key};
    _counters.push(counter); // surprising
  }
  
  const count = payload.totalCount;
  counter.value = count;  // cached for later
  setFollowLabelCaption(uiPageType, count);
}

const renderConnections = function(payload) {
  const plist = document.getElementById('paginated-list');
  plist.innerHTML = '';
  
  // rows
  const rows = payload.rows;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    plist.innerHTML += renderPerson(row, 'followResult');
  }
  
  const pageGearTip = `Page size is ${SETTINGS.getPageSize()}. Click to modify.`;
  document.getElementById('pageGear').setAttribute("title", pageGearTip);
  
  showNetworkSearchProgress(false);
  onAddedFollows(plist);
  requestTotalCount();
  
  _lastRenderedFollowsRequest = JSON.stringify(payload.request);
}

const configureFavoriting = function(a) {
  a.onclick = function(event) {
    const pageType = getPageType();
    const handle = this.getAttribute('data-testid');
    const atHandle = STR.ensurePrefix(handle, '@');
    const iconElm = this.querySelector('i');
    
    const alreadyFavorited = iconElm.classList.contains(_starOnCls);
    let removeFromFavorites;
    if (alreadyFavorited) {
      // toggle to not-favorite
      iconElm.classList.remove(_starOnCls)
      iconElm.classList.add(_starOffCls);
      removeFromFavorites = true;
    }
    else {
      // toggle to is-favorite
      if (iconElm.classList.contains(_starOffCls)) {
        iconElm.classList.remove(_starOffCls);
      }
      iconElm.classList.add(_starOnCls);
      removeFromFavorites = false;
    }
    
    // tell the db (see DBORM.setListMember)
    const msg = {
      actionType: MSGTYPE.TODB.SET_LIST_MEMBER, 
      list: LIST_FAVORITES, 
      member: atHandle, 
      pageType: pageType,
      removal: removeFromFavorites
    };
    
    worker.postMessage(msg);
    return false;
  };
}

const onAddedFollows = function(container) {
  // favoriting
  Array.from(container.getElementsByClassName("canstar")).forEach(a => configureFavoriting(a));
}

const txtOwnerHandle = document.getElementById('txtOwnerHandle');
const listOwnerPivotPicker = document.getElementById('listOwnerPivotPicker');
const optFollowing = document.getElementById('optFollowing');
const optFollowers = document.getElementById('optFollowers');
const followSearch = document.getElementById('txtConnSearch');
const txtPageNum = document.getElementById('txtPageNum');
const chkMutual = document.getElementById('chkMutual');
const optWithMdon = document.getElementById('optWithMdon');
const optWithEmail = document.getElementById('optWithEmail');
const optWithUrl = document.getElementById('optWithUrl');
const optClear = document.getElementById('optClear');

optFollowing.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optFollowers.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});

chkMutual.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
chkFavorited.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optWithMdon.addEventListener('change', (event) => {
  onClickedMdonOption();
});
optWithEmail.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optWithUrl.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});
optClear.addEventListener('change', (event) => {
  resetPage();
  networkSearch();
});

// searching
const handleTypeSearch = ES6.debounce((event) => {
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

const suggestAccountOwner = function(userInput) {
  const pageType = getPageType();
  
  worker.postMessage({
    actionType: MSGTYPE.TODB.INPUT_FOLLOW_OWNER,
    pageType: pageType,
    searchText: userInput,
    limit: 5
  });
}

// typeahead for account owner
// w3collective.com/autocomplete-search-javascript/
const ownerSearch = ES6.debounce((event) => {
  const userInput = getUiValue('txtOwnerHandle');

  if (!userInput || userInput.length === 0) {
    listOwnerPivotPicker.innerHTML = '';
  }
  
  suggestAccountOwner(userInput);
}, 250);
txtOwnerHandle.addEventListener('input', ownerSearch);

// auto-populate with a few owners on-focus (if empty)
txtOwnerHandle.onfocus = function () {
  const userInput = this.value;
  if (!userInput || userInput.length === 0) {
    suggestAccountOwner(userInput);
  }
};

txtOwnerHandle.addEventListener('keydown', function(event) {
  if (event.key === "Backspace" || event.key === "Delete") {
    _deletingOwner = true;
  }
  else {
    _deletingOwner = false;
  }
});

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
  const pageSize = SETTINGS.getPageSize();
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
listOwnerPivotPicker.onclick = function(event) {
  const personElm = ES6.findUpClass(event.target, 'person');
  const handleElm = personElm.querySelector('.personLabel > .personHandle');
  let handleText = handleElm.innerText;
  handleText = STR.stripPrefix(handleText, '@');
  txtOwnerHandle.value = handleText;
  onChooseOwner();
};

const onChooseOwner = function() {
  // when owner changes, we need to reset the counts and then request a refreshed count
  // the nbsp values are to be less jarring with width changes
  document.getElementById('optFollowersLabel').innerHTML = `followers&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
  document.getElementById('optFollowingLabel').innerHTML = `following&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
  listOwnerPivotPicker.innerHTML = "";
  resetPage();
  networkSearch();
  _lastOwner = getOwnerFromUi();
}

document.getElementById('exportBtn').onclick = function(event) {
  startExport();
  return false;
};

const startExport = function() {
  const msg = {
    actionType: MSGTYPE.TODB.EXPORT_BACKUP,
    exportTimeMs: Date.now()
  };

  worker.postMessage(msg);
}

const handleExportedResults = function(payload) {
  // for now, we download to json (later, we could push to user's github etc)
  const result = payload.result;
  const start = result.skip + 1;
  const end = result.skip + result.rows.length;
  const fileName = `${result.entity}-${result.exportTimeMs}-${start}-${end}.json`;
  const json = JSON.stringify(result, null, 2);
  RENDER.saveTextFile(json, fileName);
  
  // kick off next page if appropriate
  if (!payload.done) {
    const msg = {
      actionType: MSGTYPE.TODB.EXPORT_BACKUP,
      nextEntity: payload.nextEntity,
      nextSkip: payload.nextSkip,
      nextTake: payload.nextTake
    };

    worker.postMessage(msg);
  }
  else {
    console.log('download complete');
  }
}