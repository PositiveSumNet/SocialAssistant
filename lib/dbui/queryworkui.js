// the UI accessing the sqlite worker
const _worker = new Worker('worker.js?sqlite3.dir=jswasm');

var QUERYWORK_UI = {
  
  bindElements: function() {
    
    const txtOwnerHandle = document.getElementById('txtOwnerHandle');

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

    // choose owner from typeahead results
    document.getElementById('listOwnerPivotPicker').onclick = function(event) {
      txtOwnerHandle.value = QUERYING_UI.OWNER.handleFromClickedOwner(event);
      QUERYWORK_UI.onChooseOwner();
    };

    // auto-populate with a few owners on-focus (if empty)
    txtOwnerHandle.onfocus = function () {
      const userInput = this.value;
      if (!userInput || userInput.length === 0) {
        QUERYWORK_UI.suggestAccountOwner(userInput);
      }
    };

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
          localStorage.setItem('pageSize', intVal);
          QUERYING_UI.PAGING.resetPage();
          QUERYWORK_UI.executeSearch();
        }
      }
      return false;
    };

    txtOwnerHandle.addEventListener('keydown', function(event) {
      if (event.key === "Backspace" || event.key === "Delete") {
        _deletingOwner = true;
        _lastRenderedRequest = '';
      }
      else {
        _deletingOwner = false;
      }
    });
    
    // typeahead for account owner
    // w3collective.com/autocomplete-search-javascript/
    const ownerSearch = ES6.debounce((event) => {
      const userInput = txtOwnerHandle.value;

      if (!userInput || userInput.length === 0) {
        document.getElementById('listOwnerPivotPicker').replaceChildren();
      }
      
      QUERYWORK_UI.suggestAccountOwner(userInput);
    }, 250);
    txtOwnerHandle.addEventListener('input', ownerSearch);

    // searching
    const handleTypeSearch = ES6.debounce((event) => {
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    }, 250);
    // ... uses debounce
    document.getElementById('txtSearch').addEventListener('input', handleTypeSearch);

    document.getElementById('cmbTopicFilter').addEventListener('change', (event) => {
      QUERYING_UI.FILTERS.TOPICS.setTopicFilterModeInUi();
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    });
    
    const optSortByStars = document.getElementById('optSortByStars');
    optSortByStars.onclick = function(event) {
      optSortByStars.classList.toggle('toggledOn');
      const shouldSortByStars = getUiValue('optSortByStars');
      SETTINGS.setSortByStars(shouldSortByStars);
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
      return false;
    };
    
    const optGuessTopics = document.getElementById('optGuessTopics');
    optGuessTopics.onclick = function(event) {
      optGuessTopics.classList.toggle('toggledOn');
      QUERYING_UI.FILTERS.TOPICS.setTopicFilterVisibility();
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
      QUERYING_UI.FILTERS.setQueryOptionVisibility();
      QUERYWORK_UI.executeSearch();
    });
        
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

  suggestAccountOwner: function(userInput) {
    const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    switch (pageType) {
      case PAGETYPE.TWITTER.TWEETS:
      case PAGETYPE.MASTODON.TOOTS:
        if (!userInput || userInput.length === 0) {
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
  
    _worker.postMessage({
      actionType: MSGTYPE.TODB.INPUT_OWNER,
      pageType: pageType,
      searchText: userInput,
      limit: 5
    });
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
  
  ensureInUseTopicsFilter: function() {
    _worker.postMessage({
      actionType: MSGTYPE.TODB.GET_INUSE_TOPICS
    });
  },

  onFetchedRawTopicContent: function(content) {
    const topics = TOPICS.parseTopics(content);
    TOPICS.cacheTopicsToLocal(topics);
    const sets = TOPICS.buildSets(topics);
    _worker.postMessage({
      actionType: MSGTYPE.TODB.EXECUTE_SAVE_AND_DELETE,
      savableSet: sets.savableSet,
      deletableSet: sets.deletableSet,
      onSuccessType: SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS
    });
  }
};