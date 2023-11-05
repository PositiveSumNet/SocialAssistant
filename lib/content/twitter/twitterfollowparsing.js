/******************************************************/
// parsing twitter follow lists
// see connsaver.js for Person schema
/******************************************************/

var TFOLLOWPARSE = {

  // The twitter profile photo points upward to anchor with href of '/myhandle' 
  // then upward to div with data-testid of UserCell.
  // The UserCell has two anchor elements (other than the img anchor), the first for DisplayName and the next with Handle (myhandle).
  // So we can grab everything using this photo node.
  buildTwitterFollowFromPhoto: function(img, parsedUrl) {
    const imgSrc = img.getAttribute('src');
    const imgAnchor = ES6.findUpTag(img, 'a', false);
    const profileUrl = imgAnchor.getAttribute('href');
    const atHandle = TPARSE.twitterHandleFromProfileUrl(profileUrl); 
    const userCell = TFOLLOWPARSE.findUpTwitterUserCell(img);
    // one is handle, one is description
    
    const textAnchors = Array.from(userCell.getElementsByTagName('a')).filter(function(a) { return a != imgAnchor; });
    
    const displayNameAnchor = textAnchors.find(function(a) { 
      return a.innerText && a.innerText.length > 0 && 
              a.innerText.toLowerCase() != atHandle.toLowerCase(); 
    });
    
    const displayName = ES6.getUnfurledText(displayNameAnchor);
    const description = TFOLLOWPARSE.getTwitterProfileDescription(displayNameAnchor);
    
    // include the @ symbol
    // see PERSON_ATTR for Person schema
    const person = {
      handle: atHandle,
      displayName: displayName,
      description: description,
      pageType: parsedUrl.pageType,
      owner: STR.ensurePrefix(parsedUrl.owner, '@'),
      imgCdnUrl: imgSrc
    };
    
    person.accounts = STR.extractAccounts([person.displayName, person.description]);
    return person;
  },

  // from an element within a twitter profile list item, navigate up to the parent 'UserCell'
  findUpTwitterUserCell: function(el) {
    while (el.parentNode) {
      el = el.parentNode;
      if (ES6.isElementNode(el)) {
        let role = el.getAttribute('data-testid');
        if (role === 'UserCell') {
          return el;
        }
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
  },
  
  getTwitterProfileDescription: function(displayNameAnchorElm) {
    if (!displayNameAnchorElm) { return null; }
    const parentCell = TFOLLOWPARSE.findUpTwitterUserCell(displayNameAnchorElm);
    if (!parentCell) { return null; }
    const descripElm = TFOLLOWPARSE.findTwitterDescriptionWithinUserCell(parentCell);
    if (!descripElm) { return null; }
    let text = ES6.getUnfurledText(descripElm);
    return text;
  }

};