// the UI accessing the sqlite worker
const _worker = new Worker('worker.js?sqlite3.dir=jswasm');

var QUERYWORK_UI = {
  
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