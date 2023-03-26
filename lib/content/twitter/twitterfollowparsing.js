/******************************************************/
// parsing twitter follow lists
/******************************************************/

var TFOLLOW = {

  // from an element within a twitter profile list item, navigate up to the parent 'UserCell'
  findUpTwitterUserCell: function(el) {
    while (el.parentNode) {
      el = el.parentNode;
      let role = el.getAttribute('data-testid');
      if (role === 'UserCell') {
        return el;
      }
    }
    return null;
  },

  findTwitterDescriptionWithinUserCell: function(cell) {
    const div = cell.lastElementChild.lastElementChild.lastElementChild;
    const dirAttr = div.getAttribute('dir');
    
    if (dirAttr === 'auto') {
      return div;
    }
    else {
      return null;
    }
  }
  
};