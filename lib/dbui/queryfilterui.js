var QUERYFILTER_UI = {
  setQueryOptionVisibility: function() {
    QUERYFILTER_UI.setConnectionOptionsVisibility();
    QUERYFILTER_UI.setPostOptionVisibility();
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
  }
};