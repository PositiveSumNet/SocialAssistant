var QUERYING_UI = {
  
  initMainListUiElms: function() {
    const txtOwnerHandle= document.getElementById('txtOwnerHandle');
    const owner = txtOwnerHandle.value;
    if (STR.hasLen(owner)) {
      optWithRetweets.style.display = 'inline-block';
    }
    else {
      optWithRetweets.style.display = 'none';
    }
    
    document.getElementById('paginated-list').replaceChildren();
    document.getElementById('listOwnerPivotPicker').replaceChildren();
    document.getElementById('txtSearch').setAttribute('placeholder', 'search...');
  
    const pageGearTip = `Page size is ${SETTINGS.getPageSize()}. Click to modify.`;
    document.getElementById('pageGear').setAttribute("title", pageGearTip);
  },

  REQUEST_BUILDER: {
    buildSearchRequestFromUi: function() {
      const owner = STR.ensurePrefix(QUERYING_UI.OWNER.getOwnerFromUi(), '@');  // prefixed in the db
      const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
      const site = PAGETYPE.getSite(pageType);
      const pageSize = SETTINGS.getPageSize();
      const searchText = document.getElementById('txtSearch').value;
      const skip = QUERYING_UI.PAGING.calcSkip();
      const mutual = document.getElementById('chkMutual').checked;
      const favorited = document.getElementById('chkFavorited').checked;
      const withRetweets = QUERYING_UI.FILTERS.getWithRetweetsFromUi();
      const guessTopics = QUERYING_UI.FILTERS.TOPICS.getGuessTopicsFromUi();
    
      const threadUrlKey = URLPARSE.getQueryParm(URL_PARM.THREAD) || '';
    
      // conditional filters
      const withUrl = document.getElementById('optWithUrl').checked;
      const withMdon = site == SITE.TWITTER ? document.getElementById('optWithMdon').checked : false;
      const withEmail = site == SITE.TWITTER ? document.getElementById('optWithEmail').checked : false;
      
      // if haven't yet clicked to the mastodon tab, we might still only have the cached mdon user
      let myMastodonHandle = _mdonConnectedUser ? _mdonConnectedUser.Handle : undefined;
      myMastodonHandle = myMastodonHandle || (_mdonRememberedUser ? _mdonRememberedUser.Handle : undefined);
    
      const mdonFollowing = ES6.TRISTATE.getValue(chkMdonImFollowing);
    
      const topic = QUERYING_UI.FILTERS.TOPICS.getTopicFilterChoiceFromUi();
    
      const orderBy = QUERYING_UI.ORDERING.getOrderByFromUi(pageType, threadUrlKey, topic);
    
      const msg = { 
        actionType: MSGTYPE.TODB.EXECUTE_SEARCH, 
        pageType: pageType,
        site: site,
        networkOwner: owner, 
        searchText: searchText, 
        orderBy: orderBy,
        skip: skip,
        take: pageSize,
        // post filters
        withRetweets: withRetweets,
        guessTopics: guessTopics,
        topic: topic,
        threadUrlKey: threadUrlKey,
        // conn filters
        mutual: mutual,
        list: LIST_FAVORITES,
        requireList: favorited,
        withMdon: withMdon,
        withEmail: withEmail,
        withUrl: withUrl,
        myMastodonHandle: myMastodonHandle,
        mdonFollowing: mdonFollowing
      };
    
      return msg;
    }
  },

  QUERY_STRING: {
    conformAddressBarUrlQueryParmsToUi: function(leaveHistoryStackAlone, topic) {
      const urlParms = new URLSearchParams(document.location.search);
      urlParms.set(URL_PARM.OWNER, QUERYING_UI.OWNER.getOwnerFromUi() || '');
      urlParms.set(URL_PARM.PAGE_TYPE, QUERYING_UI.PAGE_TYPE.getPageTypeFromUi() || '');
      urlParms.set(URL_PARM.SEARCH, QUERYING_UI.SEARCH.getSearchTextFromUi() || '');
      urlParms.set(URL_PARM.SIZE, SETTINGS.getPageSize() || 25);
      urlParms.set(URL_PARM.PAGE, QUERYING_UI.PAGING.getPageNumFromUi() || 1);
      urlParms.set(URL_PARM.WITH_RETWEETS, QUERYING_UI.FILTERS.getWithRetweetsFromUi() || false);
      urlParms.set(URL_PARM.GUESS_TOPICS, QUERYING_UI.FILTERS.TOPICS.getGuessTopicsFromUi() || false);
      urlParms.set(URL_PARM.TOPIC, topic || QUERYING_UI.FILTERS.TOPICS.getTopicFilterChoiceFromUi() || '');
      urlParms.set(URL_PARM.THREAD, QUERYING_UI.THREAD.getThreadUrlKeyFromUi() || '');
    
      if (!leaveHistoryStackAlone) {
        history.pushState(null, null, "?"+urlParms.toString());
      }
    
      _docLocSearch = document.location.search;
    }
  },

  PAGE_TYPE: {
    updateUiForCachedSite: function() {
      const site = SETTINGS.getCachedSite();
      QUERYING_UI.initMainListUiElms();
      _lastRenderedRequest = '';
      
      const owner = SETTINGS.getCachedOwner(site);
      txtOwnerHandle.value = STR.stripPrefix(owner, '@') || '';
      
      const twitterBtn = document.getElementById('twitterLensBtn');
      const mastodonBtn = document.getElementById('mastodonLensBtn');
      const mastodonApiUi = document.getElementById('mdonApiUi');
      const githubBtn = document.getElementById('githubLensBtn');
      const syncUi = document.getElementById('syncUi');
    
      QUERYING_UI.FILTERS.setQueryOptionVisibility();
    
      if (site == SITE.TWITTER) {
        twitterBtn.classList.add('active');
        
        if (mastodonBtn.classList.contains('active')) {
          mastodonBtn.classList.remove('active');
        }
        if (githubBtn.classList.contains('active')) {
          githubBtn.classList.remove('active');
        }
        
        twitterBtn.setAttribute('aria-current', 'page');
        mastodonBtn.removeAttribute('aria-current');
        mastodonApiUi.style.display = 'none';
        githubBtn.removeAttribute('aria-current');
        syncUi.style.display = 'none';
    
        // render list
        document.getElementById('dbui').style.display = 'flex';
      }
      else if (site == SITE.MASTODON) {
        
        if (twitterBtn.classList.contains('active')) {
          twitterBtn.classList.remove('active');
        }
        if (githubBtn.classList.contains('active')) {
          githubBtn.classList.remove('active');
        }
    
        mastodonBtn.classList.add('active');
        twitterBtn.removeAttribute('aria-current');
        mastodonBtn.setAttribute('aria-current', 'page');
        githubBtn.removeAttribute('aria-current');
        syncUi.style.display = 'none';
        
        MASTODON.render();
        mastodonApiUi.style.display = 'block';
      }
      else if (site == SITE.GITHUB) {
        githubBtn.classList.add('active');
        
        if (twitterBtn.classList.contains('active')) {
          twitterBtn.classList.remove('active');
        }
        if (mastodonBtn.classList.contains('active')) {
          mastodonBtn.classList.remove('active');
        }
        
        githubBtn.setAttribute('aria-current', 'page');
        twitterBtn.removeAttribute('aria-current');
        mastodonBtn.removeAttribute('aria-current');
        mastodonApiUi.style.display = 'none';
    
        document.getElementById('dbui').style.display = 'none';
    
        syncUi.style.display = 'flex';
      }
      else {
        return;
      }
    
      QUERYING_UI.PAGING.resetPage();
      QUERYING_UI.FILTERS.resetFilters();
    },
    
    getPageTypeFromUi: function() {
      const site = SETTINGS.getCachedSite();

      if (site == SITE.GITHUB) {
        return TABS_UI.SYNC.getActiveSyncTabPageTypeFromUi();
      }
      else {
        const type = document.getElementById('cmbType').value;
        if (type == POSTS) {
          switch (site) {
            case SITE.TWITTER:
              return PAGETYPE.TWITTER.TWEETS;
            case SITE.MASTODON:
              return PAGETYPE.MASTODON.TOOTS;
            default:
              return undefined;
          }
        }
        else {
          return PAGETYPE.getPageType(site, type);
        }
      }
    }
  },

  OWNER: {
    getOwnerFromUi: function() {
      const txtOwnerHandle = document.getElementById('txtOwnerHandle');
      // trim the '@'
      let owner = txtOwnerHandle.value;
      owner = owner && owner.startsWith('@') ? owner.substring(1) : owner;
      return owner;
    },

    handleFromClickedOwner: function(event) {
      const personElm = ES6.findUpClass(event.target, 'person');
      if (!personElm) {
        console.log('Errant owner click');
        return;
      }
      const handleElm = personElm.querySelector('.personLabel .personHandle');
      let handleText = handleElm.innerText;
      handleText = STR.stripPrefix(handleText, '@');
      return handleText;
    }
  },

  DELETION: {
    configureDeletePost: function(btnDelPostElm) {
      btnDelPostElm.onclick = function(event) {
        const parentElm = ES6.findUpClass(btnDelPostElm, 'delpostDiv');
        parentElm.classList.add('deleting');
        return false;
      }
    },

    configureDeletePostConfirmed: function(btnDelPostConfirmElm) {
      btnDelPostConfirmElm.onclick = function(event) {
        const postUrlKey = RENDER.POST.getPostUrlKey(btnDelPostConfirmElm);

        const msg = {
          actionType: MSGTYPE.TODB.DELETE_ENTITY_SUBJECT_UX, 
          entDefn: APPSCHEMA.SocialPostTime.Name,
          subject: postUrlKey
        };
        _worker.postMessage(msg);
        return false;
      }
    },

    configureDeletePostCanceled: function(btnDelPostCancelElm) {
      btnDelPostCancelElm.onclick = function(event) {
        const parentElm = ES6.findUpClass(btnDelPostCancelElm, 'delpostDiv');
        parentElm.classList.remove('deleting');
        return false;
      }
    },

    onDeletedPost: function(postUrlKey) {
      const postBody = RENDER.POST.getPostBodyByUrlKey(postUrlKey);
      // put focus on a nearby element before deleting so the window doesn't autoscroll upon deletion
      const socialPostElm = ES6.findUpClass(postBody, 'socialPost');
      socialPostElm.focus();
      postBody.remove();
    }
  },

  THREAD: {
    configureViewThread: function(btnViewThreadElm) {
      btnViewThreadElm.onclick = function(event) {
        const threadUrlKey = btnViewThreadElm.getAttribute('data-testid');
        QUERYING_UI.THREAD.setOneThreadState(threadUrlKey);
        QUERYING_UI.PAGING.resetPage();
        QUERYWORK_UI.executeSearch();
        return false;
      }
    },
    
    setOneThreadState: function(threadUrlKey) {
      const container = document.getElementById('mainContainer');
      const txtOwnerHandle = document.getElementById('txtOwnerHandle');
      const cmbTopicFilter = document.getElementById('cmbTopicFilter');
      if (STR.hasLen(threadUrlKey)) {
        container.classList.add('oneThread');
        container.setAttribute('data-testid', threadUrlKey);
        // clear all that which might confuse a user about why they aren't seeing the full thread
        // clear owner
        txtOwnerHandle.value = '';
        // clear search
        txtSearch.value = '';
        // clear topic filter
        cmbTopicFilter.value = -1;  // clear
      }
      else {
        container.removeAttribute('data-testid');
        container.classList.remove('oneThread');
      }
    },
  
    getThreadUrlKeyFromUi: function() {
      return document.getElementById('mainContainer').getAttribute('data-testid') || '';
    }
  },

  SEARCH: {
    getSearchTextFromUi: function() {
      return document.getElementById('txtSearch').value;
    },
    
    showSearchProgress: function(showProgressBar) {
      const progressElm = document.getElementById('connListProgress');
      const continuePaging = document.getElementById('continuePaging');
      if (showProgressBar === true) {
        progressElm.style.visibility = 'visible';
        continuePaging.style.display = 'none';
      }
      else {
        progressElm.style.visibility = 'hidden';
        // see if there are any list elements
        const listElmCount = Array.from(document.querySelectorAll('#paginated-list div')).length;
        continuePaging.style.display = listElmCount > 0 ? 'block' : 'none';
      }
    }
  },

  COUNT: {
    renderNetworkSize: function(payload) {
      const uiPageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
      const uiOwner = QUERYING_UI.OWNER.getOwnerFromUi();
      const dbOwnerSansPrefix = STR.stripPrefix(payload.request.networkOwner, '@');
      
      if (uiPageType != payload.request.pageType || uiOwner != dbOwnerSansPrefix) {
        return; // page status has changed since request was made
      }
      
      const key = QUERYING_UI.COUNT.makeNetworkSizeCounterKey(uiOwner, uiPageType);
      let counter = _counters.find(function(c) { return c.key === key; });
      
      if (!counter) {
        counter = {key: key};
        _counters.push(counter); // surprising
      }
      
      const count = payload.totalCount;
      counter.value = count;  // cached for later
      QUERYING_UI.PAGING.displayTotalCount(count);
    },
    
    clearCachedCountForCurrentRequest: function() {
      const owner = QUERYING_UI.OWNER.getOwnerFromUi();
      const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
    
      if (!owner || !pageType) {
        return;
      }
    
      const key = QUERYING_UI.COUNT.makeNetworkSizeCounterKey(owner, pageType);
      if (_counterSet.has(key)) {
        _counterSet.delete(key);
      }
    },
    
    makeNetworkSizeCounterKey: function(owner, pageType) {
      return `${owner}-${pageType}`;
    }
  },

  ORDERING: {
    getSortByStarsFromUi: function() {
      return document.getElementById('optSortByStars').classList.contains('toggledOn');
    },
    
    setTopicSortInUi: function() {
      const byStars = SETTINGS.getSortByStars();
      const optSortByStars = document.getElementById('optSortByStars');
      if (byStars == true) {
        optSortByStars.classList.add('toggledOn');
      }
      else {
        optSortByStars.classList.remove('toggledOn');
      }
    },

    getOrderByFromUi: function(pageType, threadUrlKey, topic) {
      switch (pageType) {
        case PAGETYPE.TWITTER.TWEETS:
        case PAGETYPE.MASTODON.TOOTS:
          if (STR.hasLen(threadUrlKey)) {
            // thread-view shows oldest first
            return ORDER_BY.POST_TIME_ASC;
          }
          else if (STR.hasLen(topic)) {
            if (SETTINGS.getSortByStars() == true) {
              return ORDER_BY.POST_RATING;
            }
            else {
              return ORDER_BY.POST_TIME_DESC;
            }
          }
          else {
            // default
            return ORDER_BY.POST_TIME_DESC;
          }
        default:
          return ORDER_BY.HANDLE;
      }
    }
  },

  PAGING: {
    calcSkip: function() {
      const pageNum = QUERYING_UI.PAGING.getPageNumFromUi();
      const pageSize = SETTINGS.getPageSize();
      const skip = (pageNum - 1) * pageSize;
      return skip;
    },
    
    displayTotalCount: function(count) {
      document.getElementById('txtSearch').setAttribute('placeholder', `search (${count} total)...`);
    },
    
    resetPage: function() {
      document.getElementById('txtPageNum').value = 1;      
    },

    getPageNumFromUi: function() {
      const txtPageNum = document.getElementById('txtPageNum');
      let pageNum = parseInt(txtPageNum.value);
      if (isNaN(pageNum)) { pageNum = 1 };
      return pageNum;
    },

    setPageNumUiValue: function(pageNum) {
      const txtPageNum = document.getElementById('txtPageNum');
      txtPageNum.value = pageNum;
    }
  },

  FILTERS: {
    detailReflectsFilter: function() {
      return document.getElementById('optWithMdon').checked === true || 
        document.getElementById('optWithEmail').checked === true || 
        document.getElementById('optWithUrl').checked === true;
    },
    
    renderTopicFilterChoices: function() {
      let choices = [];
      choices.push(CMB_SPECIAL.TAG_FILTER_BY);
      choices.push(..._topicTags);
      
      let html = '';
      for (let i = 0; i < choices.length; i++) {
        let tag = choices[i];
        // the "-- clear selection --" option should always be visible
        let cls = i == 0 || _inUseTags.has(tag) ? '' : ` class='d-noneif'`;
        html = STR.appendLine(html, `<option value='${i - 1}'${cls}>${tag}</option>`);
      }
      html = DOMPurify.sanitize(html);
      document.getElementById('cmbTopicFilter').innerHTML = html;
    },
    
    resetFilters: function() {
      document.getElementById('chkMutual').checked = false;
      document.getElementById('chkFavorited').checked = false;
      document.getElementById('optClear').checked = true;
    },
    
    setQueryOptionVisibility: function() {
      QUERYING_UI.FILTERS.setConnectionOptionsVisibility();
      QUERYING_UI.FILTERS.setPostOptionVisibility();
    },
    
    setPostOptionVisibility: function() {
      const queryOptions = document.getElementById('postQueryOptions');
      const cmbType = document.getElementById('cmbType');
    
      if (cmbType.value != POSTS) {
        queryOptions.style.display = 'none';
        return;
      }
      
      queryOptions.style.display = 'block';
    },
    
    setConnectionOptionsVisibility: function() {
      const queryOptions = document.getElementById('connQueryOptions');
      const cmbType = document.getElementById('cmbType');
    
      if (cmbType.value == POSTS) {
        queryOptions.style.display = 'none';
        return;
      }
      
      queryOptions.style.display = 'block';
    
      // default to undefined (no filter applied) for the tri-state
      const chkMdonImFollowing = document.getElementById('chkMdonImFollowing');
      ES6.TRISTATE.setValue(chkMdonImFollowing, undefined);
    
      const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
      const site = PAGETYPE.getSite(pageType);
      const mdonMode = document.getElementById('optWithMdon').checked;
    
      const filterTwitterWithMdonLink = document.getElementById('filterTwitterWithMdonLink');
      const filterMdonImFollowing = document.getElementById('filterMdonImFollowing');
      const filterWithEmail = document.getElementById('filterWithEmail');
      const btnFollowAllOnMastodon = document.getElementById('btnFollowAllOnMastodon');
      const optPosts = document.getElementById('optPosts');
    
      if (site === SITE.MASTODON || mdonMode === true) {
        // cell (1,2) switches from the Mastodon radio button (which is already true) to the 'Where I'm following' filter
        filterTwitterWithMdonLink.style.display = 'none';
        filterMdonImFollowing.style.display = 'block';
        // cell (1,3) switches from 'w/ Email' to the 'Follow on Mastodon!' button
        filterWithEmail.style.display = 'none';
        btnFollowAllOnMastodon.style.display = 'inline-block';
        optPosts.style.display = 'none';
      }
      else {
        filterTwitterWithMdonLink.style.display = 'block';
        filterMdonImFollowing.style.display = 'none';
        filterWithEmail.style.display = 'block';
        btnFollowAllOnMastodon.style.display = 'none';
        optPosts.style.display = 'inline';
      }
    },

    getWithRetweetsFromUi: function() {
      const optWithRetweets = document.getElementById('optWithRetweets');
      return optWithRetweets.classList.contains('toggledOn');
    },

    setOptToggleBtn: function(elm, toggledOn) {
      if (toggledOn == true || toggledOn == 'true') {
        elm.classList.add('toggledOn');
      }
      else {
        elm.classList.remove('toggledOn');
      }
    },

    TOPICS: {
      getGuessTopicsFromUi: function() {
        const optGuessTopics = document.getElementById('optGuessTopics');
        return optGuessTopics.classList.contains('toggledOn');
      },
      
      setTopicFilterChoiceInUi: function(topic) {
        let intVal = -1;
        const tags = _topicTags;
        for (let i = 0; i < tags.length; i++) {
          let tag = tags[i];
          if (topic == tag) {
            intVal = i;
            break;
          }
        }
      
        const cmbTopicFilter = document.getElementById('cmbTopicFilter');
        cmbTopicFilter.value = intVal;
        QUERYING_UI.FILTERS.TOPICS.setTopicFilterModeInUi();
      },

      setTopicFilterVisibility: function() {
        const guessTopics = QUERYING_UI.FILTERS.TOPICS.getGuessTopicsFromUi();
        const cmbTopicFilter = document.getElementById('cmbTopicFilter');
        if (guessTopics == true) {
          cmbTopicFilter.classList.remove('d-nonefor');
        }
        else {
          cmbTopicFilter.classList.add('d-nonefor');
        }
      },

      adjustTopicFilterVizWhen: function() {
        const cmbTopicFilter = document.getElementById('cmbTopicFilter');
        const options = Array.from(cmbTopicFilter.querySelectorAll('option'));
        options.forEach(function(option) {
          let intVal = option.value;
          // visibility
          if (intVal < 0 || _inUseTags.has(_topicTags[intVal])) {
            option.classList.remove('d-noneif');
          }
          else {
            option.classList.add('d-noneif');
          }
        });
      },
      
      getTopicFilterChoiceFromUi: function() {
        const cmbTopicFilter = document.getElementById('cmbTopicFilter');
        const intValue = parseInt(cmbTopicFilter.value);
        if (!isNaN(intValue) && intValue > -1 && _topicTags.length >= intValue + 1) {
          return _topicTags[intValue];
        }
        else {
          return null;
        }
      },

      setTopicFilterModeInUi: function() {
        const container = document.getElementById('mainContainer');
        const topic = QUERYING_UI.FILTERS.TOPICS.getTopicFilterChoiceFromUi();
        
        if (STR.hasLen(topic)) {
          container.classList.add('oneTopic');
        }
        else {
          container.classList.remove('oneTopic');
        }
      }
    }
  }
};