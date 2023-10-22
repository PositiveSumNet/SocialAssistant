// more tightly coupled to the rest of the UI than renderlib.js
var RENDERBIND_UI = {
  renderSuggestedOwner: function(payload) {
    const owner = payload.owner;
    if (!owner || !owner.Handle || owner.Handle.length === 0) {
      return;
    }
    
    const value = document.getElementById('txtOwnerHandle').value;
    
    if (!value || value.length === 0) {
      document.getElementById('txtOwnerHandle').value = owner.Handle;
      // we're doing a page init and so far it's empty, so let's
      QUERYING_UI.PAGING.resetPage();
      QUERYWORK_UI.executeSearch();
    }
  }
};