// the UI accessing the sqlite worker
const _worker = new Worker('worker.js?sqlite3.dir=jswasm');

var QUERYWORK_UI = {
  
  bindElements: function() {
    
    // click for prior page
    document.getElementById('priorPage').onclick = function(event) {
      QUERYWORK_UI.navToPriorPage();
      return false;
    };

    // click for next page
    document.getElementById('nextPage').onclick = function(event) {
      QUERYWORK_UI.navToNextPage();
      return false;
    };
    document.getElementById('continuePaging').onclick = function(event) {
      QUERYWORK_UI.navToNextPage();
      return false;
    };
    
    // hit enter on page number
    document.getElementById('txtPageNum').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        QUERYWORK_UI.executeSearch();
      }
    });

    document.getElementById('pageGear').onclick = function(event) {
      const pageSize = SETTINGS.getPageSize();
      const input = prompt("Choose page size", pageSize.toString());
      
      if (input != null) {
        const intVal = parseInt(input);
        if (isNaN(intVal)) {
          alert("Invalid input; page size unchanged");
        }
        else if (intVal > 100) {
          alert("Max suggested page size is 100; leaving unchanged");
        }
        else {
          SETTINGS.localSet('pageSize', intVal);
          QUERYING_UI.PAGING.resetPage();
          QUERYWORK_UI.executeSearch();
        }
      }
      return false;
    };

    // owner filter
    document.getElementById('btnPickOwnerFavorites').onclick = function(event) {
      txtOwnerHandle.value = SPECIAL_OWNER.ALL_FAVORITES;
      QUERYWORK_UI.onChooseOwner();
      return false;
    };
    document.getElementById('btnPickOwnerFollowing').onclick = function(event) {
      txtOwnerHandle.value = SPECIAL_OWNER.ALL_FOLLOWING;
      QUERYWORK_UI.onChooseOwner();
      return false;
    };

    const txtOwnerHandle = document.getElementById('txtOwnerHandle');

    document.getElementById('listOwnerPivotPicker').onclick = function(event) {
      txtOwnerHandle.value = QUERYING_UI.OWNER.handleFromClickedOwner(event);
      QUERYWORK_UI.onChooseOwner();
    };
    // auto-populate with a few owners on-focus (if empty)
    txtOwnerHandle.onfocus = function () {
      const userInput = this.value;
      if (!userInput || userInput.length === 0 && !_deletingOwner) {
        QUERYWORK_UI.suggestAccountOwner(userInput);
      }
    };

    txtOwnerHandle.onblur = function() {
      // the delay is to give time to register a button-click
      setTimeout(() => {
        QUERYWORK_UI.setSpecialOwnerViz(false);
      }, 200);
    };

    txtOwnerHandle.addEventListener('keyup', function(e) {
      if (e.key == "Escape") {
        QUERYWORK_UI.setSpecialOwnerViz(false);
      }
    });

    QUERYWORK_UI.bindTypeahead(
      txtOwnerHandle, 
      // onBackspaceFn
      function() {
        _deletingOwner = true;
        _lastRenderedRequest = '';
        if (!STR.hasLen(txtOwnerHandle.value)) {
          txtOwnerHandle.blur();
          QUERYWORK_UI.onChooseOwner();
        }
      },
      // onOrdinaryInputFn
      function() {
        _deletingOwner = false;
        QUERYWORK_UI.setSpecialOwnerViz(false);
      },
      // onDebouncedFn
      QUERYWORK_UI.suggestAccountOwner,
      // listPickerElm
      document.getElementById('listOwnerPivotPicker'));
      
    // this is to support the filter menu appearance
    const postQueryOptions = document.getElementById('postQueryOptions');
    document.getElementById('postQueryOptions').onmouseover = function(e) {
      postQueryOptions.classList.add('hovering');
    };
    document.getElementById('postQueryOptions').onmouseout = function(e) {
      postQueryOptions.classList.remove('hovering');
    };
      
    // topic filter
    const txtTopicFilter = document.getElementById('txtTopicFilter');

    txtTopicFilter.onfocus = function () {
      const userInput = this.value || '';
      QUERYWORK_UI.suggestTopic(userInput);
      postQueryOptions.classList.add('editingTopicFilter');
    };
    txtTopicFilter.onblur = function () {
      postQueryOptions.classList.remove('editingTopicFilter');
      QUERYING_UI.FILTERS.TOPICS.hideTaggingTips();
    };
    txtTopicFilter.addEventListener('keyup', function(e) {
      if (e.key == "Escape") {
        postQueryOptions.classList.remove('editingTopicFilter');
        QUERYING_UI.FILTERS.TOPICS.hideTaggingTips();
      }
    });

    QUERYWORK_UI.bindTypeahead(
      txtTopicFilter, 
      // onBackspaceFn
      function() {
        _deletingTopicFilter = true;
        _lastRenderedRequest = '';
        if (!STR.hasLen(txtTopicFilter.value)) {
          QUERYING_UI.FILTERS.TOPICS.setTopicFilter('');
        }
      },
      // onOrdinaryInputFn
      function() {
        _deletingTopicFilter = false;
      },
      // onDebouncedFn
      QUERYWORK_UI.suggestTopic,
      // listPickerElm
      document.getElementById('listTopicPicker'));

    // searching
    const handleTypeSearch = ES6.debounce((event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    }, 250);
    // ... uses debounce
    document.getElementById('txtSearch').addEventListener('input', handleTypeSearch);

    const optSortByStars = document.getElementById('optSortByStars');
    optSortByStars.onclick = function(event) {
      optSortByStars.classList.toggle('toggledOn');
      const shouldSortByStars = QUERYING_UI.ORDERING.getSortByStarsFromUi();
      SETTINGS.setSortByStars(shouldSortByStars);
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
      return false;
    };
    
    const optDemandQualityPosts = document.getElementById('optDemandQualityPosts');
    optDemandQualityPosts.onclick = function(event) {
      optDemandQualityPosts.classList.toggle('toggledOn');
      const shouldDemandQualityPosts = QUERYING_UI.POST_QUALITY.getDemandQualityPostsFromUi();
      SETTINGS.setDemandQualityPosts(shouldDemandQualityPosts);
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
      return false;
    };
    
    const optGuessTopics = document.getElementById('optGuessTopics');
    optGuessTopics.onclick = function(event) {
      optGuessTopics.classList.toggle('toggledOn');
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
      return false;
    };

    const optWithRetweets = document.getElementById('optWithRetweets');
    optWithRetweets.onclick = function(event) {
      optWithRetweets.classList.toggle('toggledOn');
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
      return false;
    };
    
    const optClear = document.getElementById('optClear');
    optClear.addEventListener('change', (event) => {
      QUERYING_UI.FILTERS.setQueryOptionVisibility();
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });

    const chkMdonImFollowing = document.getElementById('chkMdonImFollowing');
    chkMdonImFollowing.addEventListener('change', (event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });

    const optWithUrl = document.getElementById('optWithUrl');
    optWithUrl.addEventListener('change', (event) => {
      QUERYING_UI.FILTERS.setQueryOptionVisibility();
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });

    const optWithEmail = document.getElementById('optWithEmail');
    optWithEmail.addEventListener('change', (event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });
        
    const optWithMdon = document.getElementById('optWithMdon');
    optWithMdon.addEventListener('change', (event) => {
      QUERYWORK_UI.onClickedMdonOption();
    });

    const chkFavorited = document.getElementById('chkFavorited');
    chkFavorited.addEventListener('change', (event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });

    const chkMutual = document.getElementById('chkMutual');
    chkMutual.addEventListener('change', (event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });

    document.getElementById('cmbType').addEventListener('change', (event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYING_UI.OWNER.resetUiOwner();
      QUERYING_UI.FILTERS.setQueryOptionVisibility();
      QUERYWORK_UI.executeSearch();
    });
    
    const btnClearThreadFilter = document.getElementById('btnClearThreadFilter');
    btnClearThreadFilter.onclick = function(event) {
      QUERYING_UI.THREAD.setOneThreadState(null);
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();  // no threadUrlKey passed in, so query string will be conformed to '' for thread
      return false;
    };
        
  },

  bindTypeahead: function(
    textBoxElm, 
    onBackspaceFn, 
    onOrdinaryInputFn,
    onDebouncedFn,
    listPickerElm) {
    // handle backspace
    textBoxElm.addEventListener('keyup', function(event) {
      if (event.key === "Backspace" || event.key === "Delete") {
        if (onBackspaceFn) {
          onBackspaceFn();
        }
      }
      else {
        if (onOrdinaryInputFn) {
          onOrdinaryInputFn();
        }
      }
    });

    // typeahead
    // w3collective.com/autocomplete-search-javascript/
    const searchFn = ES6.debounce((event) => {
      const userInput = textBoxElm.value;

      if (!userInput || userInput.length === 0) {
        listPickerElm.replaceChildren();
      }
      
      onDebouncedFn(userInput);
    }, 250);
    textBoxElm.addEventListener('input', searchFn);

  },

  bindWorker: function() {
    // receive messages from _worker
    _worker.onmessage = async function ({ data }) {
      switch (data.type) {
        case MSGTYPE.FROMDB.LOG.LEGACY:
          // legacy + error logging
          LOG_UI.logHtml(data.payload.cssClass, ...data.payload.args);
          break;
        case MSGTYPE.FROMDB.LOG.SQLITE_VERSION:
          LOG_UI.logSqliteVersion(data.payload);
          break;
        case MSGTYPE.FROMDB.LOG.DB_SCRIPT_VERSION:
          LOG_UI.logDbScriptVersion(data.payload);
          break;
        case MSGTYPE.FROMDB.WORKER_READY:
          TOPICS.ensureRemoteTopicSettings(QUERYWORK_UI.onFetchedRawTopicContent);
          await RENDERBIND_UI.initialRender();
          await QUERYWORK_UI.ensureCopiedToDb();
          break;
        case MSGTYPE.FROMDB.COPIED_TODB:
          await QUERYWORK_UI.onCopiedToDb(data.cacheKeys);
          break;
        case MSGTYPE.FROMDB.SAVE_AND_DELETE_DONE:
          QUERYWORK_UI.hideDbProcessingMsg();
          QUERYWORK_UI.onCompletedSaveAndDelete(data.payload);
          break;
        case MSGTYPE.FROMDB.LOG.DB_DONE_MIGRATING:
          QUERYWORK_UI.hideDbProcessingMsg();
          break;
        case MSGTYPE.FROMDB.LOG.DB_IS_MIGRATING:
          QUERYWORK_UI.showDbProcessingMainMsg(data.msg);
          break;
        case MSGTYPE.FROMDB.SAVE_STEP_STATUS_MSG:
          QUERYWORK_UI.showDbProcessingDetailMsg(data.msg);
          break;
        case MSGTYPE.FROMDB.DELETED_BY_SUBJECT:
          QUERYWORK_UI.onDeletedBySubject(data.request);
          break;
        case MSGTYPE.FROMDB.RENDER.SUGGESTED_OWNER:
          RENDERBIND_UI.renderSuggestedOwner(data.payload);
          break;
        case MSGTYPE.FROMDB.RENDER.MATCHED_OWNERS:
          RENDERBIND_UI.renderMatchedOwners(data.payload);
          break;
        case MSGTYPE.FROMDB.RENDER.CONNECTIONS:
          RENDERBIND_UI.renderConnections(data.payload);
          break;
        case MSGTYPE.FROMDB.RENDER.POST_STREAM:
          RENDERBIND_UI.renderPostStream(data.payload);
          break;
        case MSGTYPE.FROMDB.RENDER.NETWORK_SIZE:
          QUERYING_UI.COUNT.renderNetworkSize(data.payload);
          break;
        case MSGTYPE.FROMDB.RENDER.SEARCHED_INUSE_TOPICS:
          QUERYING_UI.FILTERS.TOPICS.renderFilteredTopics(data.payload);
          break;
        case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_COUNT:
          QUERYWORK_UI.onGotSavedCount(data.count, data.pageType, data.metadata);
          break;
        case MSGTYPE.FROMDB.ON_FETCHED_FOR_BACKUP:
          await SYNCFLOW.PUSH_EXEC.onFetchedForBackup(data.syncable);
          break;
        case MSGTYPE.FROMDB.CONTINUE_RESTORE:
          await SYNCFLOW.PULL_EXEC.continueRestore(data.request, data.rows);
          break;
        case MSGTYPE.FROMDB.SAVED_FOR_RESTORE:
          SYNCFLOW.onGithubSyncStepOk(data.result, SYNCFLOW.DIRECTION.RESTORE);
          break;
        default:
          LOG_UI.logHtml('error', 'Unhandled message:', data.type);
          break;
      }
    };
  },

  setSpecialOwnerViz: function(visible) {
    if (visible == true) {
      document.getElementById('specialOwnerPicker').classList.remove('d-none');
      document.getElementById('txtOwnerHandle').setAttribute('placeholder', 'Type or pick below');
    }
    else {
      document.getElementById('specialOwnerPicker').classList.add('d-none');
      document.getElementById('txtOwnerHandle').setAttribute('placeholder', 'account');
    }
  },

  onCopiedToDb: async function(cacheKeys) {
    // we can clear out the cache keys
    for (let i = 0; i < cacheKeys.length; i++) {
      let cacheKey = cacheKeys[i];
      await chrome.storage.local.remove(cacheKey);
    }
    
    // and queue up the next run
    await QUERYWORK_UI.ensureCopiedToDb();
  },

  ensureCopiedToDb: async function() {
    const kvps = await SETTINGS.getCacheKvps(STORAGE_PREFIX.FOR_DB);
  
    const xferring = document.getElementById('dbProcessingMsg');
    if (kvps.length > 0) {
      xferring.style.display = 'inline-block';
      const mainMsgElm = document.getElementById('dbProcessingMainMsg');
      mainMsgElm.textContent = 'Copying ' + kvps.length + ' pages to local database...';
    }
    
    // allow sqlite to do process in larger batches than what was cached
    const batches = [];
    const maxBatches = 10;
    const monoMultiplier = 10; // if these aren't arrays, we'll process 100 items instead of 10 array pages
    let ctr = 0;
    let hitArray = false;
    for (let i = 0; i < kvps.length; i++) {
      let kvp = kvps[i];
      batches.push(kvp);
      ctr++;
      
      if (Array.isArray(kvp.val)) {
        hitArray = true;
      }
  
      if ((hitArray == true && ctr >= maxBatches) || (hitArray == false && ctr >= maxBatches * monoMultiplier)) {
        // come back for more rather than sending massive messages around
        break;
      }
    }
    
    if (batches.length > 0) {
      _worker.postMessage( { batches: batches, actionType: MSGTYPE.TODB.XFER_CACHE_TODB } );
    }
    else {
      // if we got to here, we've fully copied into the db
      if (xferring.style.display == 'inline-block') {
        // this means we showed it; so let them know it's ready
        // the reason we nudge toward a Refresh is because if the user is busy a page refresh would be jarring.
        QUERYWORK_UI.showDbProcessingMainMsg('Saved! Please refresh the page.', true);
        xferring.classList.add('completed');
        if (QUERYWORK_UI.isListEmpty() == true) {
          document.location.reload();
        }
      }
    }
  },

  hideDbProcessingMsg: function() {
    document.getElementById('dbProcessingMsg').style.display = 'none';
    document.getElementById('dbProcessingMainMsg').textContent = '';
    document.getElementById('dbProcessingMsgDetails').textContent = '';
    QUERYWORK_UI.displayMsgAtMainListIfEmpty(EMPTY_LIST_MSG);
  },

  showDbProcessingMainMsg: function(msg, clearDetail) {
    document.getElementById('dbProcessingMsg').style.display = 'inline-block';
    document.getElementById('dbProcessingMainMsg').textContent = msg;
    QUERYWORK_UI.displayMsgAtMainListIfEmpty(msg);
    if (clearDetail == true) {
      document.getElementById('dbProcessingMsgDetails').textContent = '';
    }
  },

  // note: visibility is based on ensureCopiedToDb because other types of processing (like favoriting) are handled in real time without need to refresh etc.
  showDbProcessingDetailMsg: function(msg) {
    document.getElementById('dbProcessingMsg').style.display = 'inline-block';
    document.getElementById('dbProcessingMsgDetails').textContent = msg;
    QUERYWORK_UI.displayMsgAtMainListIfEmpty(msg);
  },

  isListEmpty: function() {
    const listElm = document.getElementById('paginated-list');
    return !listElm.children || listElm.children.length == 0;
  },

  displayMsgAtMainListIfEmpty: function(msg) {
    if (QUERYWORK_UI.isListEmpty() == true) {
      // list is empty; clone the message there so it's easy to see
      document.getElementById('paginated-list').textContent = msg;
    }
  },

  // returns back a copy of the saved data
  onCompletedSaveAndDelete: function(payload) {
    switch (payload.onSuccessType) {
      case SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS:
        SETTINGS.localSet(SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS, Date.now());
        break;
      case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_POST_TAG:
        TAGGING.POSTS.onTaggingSuccess(payload);
        break;
      case MSGTYPE.FROMDB.ON_SUCCESS.SAVED_TOPIC:
        TOPICS.onSavedTopicSubtopicPairs(payload);
        break;
      default:
        // no-op
        break;
    }
  },

  onDeletedBySubject: function(request) {
    switch(request.entDefn) {
      case APPSCHEMA.SocialPostTime.Name:
        QUERYING_UI.DELETION.onDeletedPost(request.subject);
        break;
      default:
        console.log('not implemented on-deletion for ' + request.entDefn);
        break;
    }
  },

  onGotSavedCount: function(count, pageType, metadata) {
    const site = PAGETYPE.getSite(pageType);
  
    switch (site) {
      case SITE.MASTODON:
        MASTODON.onGotSavedCount(count, metadata.ownerAccountId, MASTODON.getFollowDirectionFromPageType(pageType));
        return;
      case SITE.TWITTER:
      default:
        // no rendering planned
        console.log('Saved ' + count);
        break;
    }
  },

  // site tab is twitter and clicked to filter to mastodon
  onClickedMdonOption: function() {
    // ensure we prompt for server on first-time click of 'w/ mastodon' without them having to click the gear
    SETTINGS_UI.ensureAskedMdonServer();
    
    QUERYING_UI.FILTERS.setQueryOptionVisibility();

    // continue even if user cancelled the chance to input a mdon server
    QUERYING_UI.PAGING.resetPage();
    QUERYWORK_UI.executeSearch();  
  },

  navToPriorPage: function() {
    const pageNum = QUERYING_UI.PAGING.getPageNumFromUi();
    if (pageNum > 1) {
      QUERYING_UI.PAGING.setPageNumUiValue(pageNum - 1);
      QUERYWORK_UI.executeSearch();
    }
  },

  navToNextPage: function() {
    const pageNum = QUERYING_UI.PAGING.getPageNumFromUi();
    const txtPageNum = document.getElementById('txtPageNum');
    txtPageNum.value = pageNum + 1;
    QUERYWORK_UI.executeSearch();
  },

  onChooseOwner: function() {
    QUERYING_UI.initMainListUiElms();
    const listOwnerPivotPicker = document.getElementById('listOwnerPivotPicker');
    listOwnerPivotPicker.replaceChildren();
    QUERYING_UI.PAGING.resetPage();
    QUERYWORK_UI.executeSearch();
  },

  suggestTopic: function(userInput) {
    const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    const site = PAGETYPE.getSite(pageType);

    _worker.postMessage({
      actionType: MSGTYPE.TODB.SEARCH_INUSE_TOPICS,
      site: site,
      searchText: userInput
    });
  },

  isAccountOwnerFocused: function() {
    const focusedElm = document.activeElement;
    if (!focusedElm) { return false; }
    const txtOwnerHandle = document.getElementById('txtOwnerHandle');
    return focusedElm === txtOwnerHandle;
  },

  suggestAccountOwner: function(userInput) {
    const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    switch (pageType) {
      case PAGETYPE.TWITTER.TWEETS:
      case PAGETYPE.MASTODON.TOOTS:
        if (!STR.hasLen(userInput)) {
          if (!_deletingOwner || QUERYWORK_UI.isAccountOwnerFocused()) {
            // only show the special owner buttons if the textbox still has focus
            QUERYWORK_UI.setSpecialOwnerViz(true);
          }
          // we aren't interested to show the auto-furled top-5 list with tweets because it's not worth it relative to the trouble of clearing the choices (no ui element for that yet)
          const listOwnerPivotPicker = document.getElementById('listOwnerPivotPicker');
          listOwnerPivotPicker.replaceChildren();
          QUERYWORK_UI.executeSearch();
          return;
        }
        break;
      default:
        break;
    }
  
    if (!_deletingOwner) {
      _worker.postMessage({
        actionType: MSGTYPE.TODB.INPUT_OWNER,
        pageType: pageType,
        searchText: userInput,
        limit: 5
      });
    }
  },

  // topic dropdown isn't populated yet on initial render, which is why that can be useful to pass in
  executeSearch: function(forceRefresh, leaveHistoryStackAlone, topic) {
    QUERYING_UI.QUERY_STRING.conformAddressBarUrlQueryParmsToUi(leaveHistoryStackAlone, topic);
  
    const msg = QUERYING_UI.REQUEST_BUILDER.buildSearchRequestFromUi();
    if (STR.hasLen(topic)) {
      msg.topic = topic;
    }
  
    const requestJson = JSON.stringify(msg);
    SETTINGS.cachePageState(msg);
  
    if (!forceRefresh && _lastRenderedRequest === requestJson) {
      // we already have this rendered; avoid double-submission
      return;
    }
    
    if (forceRefresh) {
      // ensure that the follow count is re-requested
      QUERYING_UI.COUNT.clearCachedCountForCurrentRequest();
    }
  
    QUERYING_UI.SEARCH.showSearchProgress(true);
    _docLocSearch = document.location.search; // aids our popstate behavior
    _worker.postMessage(msg);
  },
  
  requestTotalCount: function() {
    const owner = QUERYING_UI.OWNER.getOwnerFromUi();
    if (!owner) {
      return;
    }
    
    const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    
    const key = QUERYING_UI.COUNT.makeNetworkSizeCounterKey(owner, pageType);
    if (_counterSet.has(key)) {
      const counter = _counters.find(function(c) { return c.key === key; });
      if (counter && counter.value) {
        // we already have this count cached; apply it
        QUERYING_UI.PAGING.displayTotalCount(counter.value);
      }
      // else wait for fetch to finish; either way, we're done
      return;
    }
    
    const atOwner = STR.ensurePrefix(owner, '@'); // DB includes @ prefix
    const msg = {actionType: MSGTYPE.TODB.GET_NETWORK_SIZE, networkOwner: atOwner, pageType: pageType};
    
    _worker.postMessage(msg);
    // record knowledge that this count has been requested
    _counterSet.add(key);
    _counters.push({key: key});   // value not set yet; will be when called back
  },
  
  onFetchedRawTopicContent: function(content) {
    const serverTopics = TOPICS.parseTopics(content);
    const existingLocalTopics = SETTINGS.TOPICS.getLocalCacheTopics();
    const sansDeprecatedMergedTopics = TOPICS.mergeTopics(serverTopics, existingLocalTopics, false);
    SETTINGS.TOPICS.saveTopicsToLocalCache(sansDeprecatedMergedTopics);
    RENDER.POST.TAGGING.initTopicTags();
    
    // we want to ensure that the DB saves in knowledge of what's deprecated
    const withDeprecatedMergedTopics = TOPICS.mergeTopics(serverTopics, existingLocalTopics, true);
    const serverSets = TOPICS.buildSets(withDeprecatedMergedTopics);

    _worker.postMessage({
      actionType: MSGTYPE.TODB.EXECUTE_SAVE_AND_DELETE,
      savableSet: serverSets.savableSet,
      deletableSet: serverSets.deletableSet,
      onSuccessType: SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS
    });
  },

  saveTopic: function(topicName, subtopicName) {
    const savableSet = TOPICS.buildSavableTopicSet(topicName, subtopicName);

    _worker.postMessage({
      actionType: MSGTYPE.TODB.EXECUTE_SAVE_AND_DELETE,
      savableSet: savableSet,
      deletableSet: null,
      onSuccessType: MSGTYPE.FROMDB.ON_SUCCESS.SAVED_TOPIC
    });
  }
};