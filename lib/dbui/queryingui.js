var QUERYING_UI = {
  
  SEARCH: {
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

  ORDERING: {
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
      const pageNum = QUERYING_UI.PAGING.getPageNum();
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

    getPageNum: function() {
      const txtPageNum = document.getElementById('txtPageNum');
      let pageNum = parseInt(txtPageNum.value);
      if (isNaN(pageNum)) { pageNum = 1 };
      return pageNum;
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
    
      const pageType = getPageType();
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

    TOPICS: {
      adjustTopicFilterVizWhen: function() {
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