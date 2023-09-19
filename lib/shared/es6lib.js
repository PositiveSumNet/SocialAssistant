/*********************************************/
// general purpose utils for es6 dom & scraping
/*********************************************/

var ES6 = {
  
  // make sure this stays small (eliminate when we can)
  // this is *only* here because popup needs parseUrl which needs getHomePageOwnerHandle()
  SPECIAL: {
    getTwitterHomePageOwnerHandle: function() {
      const profileAnchor = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
      if (!profileAnchor) { return null; }
      const href = profileAnchor.getAttribute('href');
      let handle = STR.stripPrefix(href, '/');
      handle = STR.ensurePrefix(handle, '@');
      return handle;
    }
  },

  TRISTATE: {
    initAll: function() {
      // css-tricks.com/indeterminate-checkboxes/
      Array.from(document.getElementsByClassName('chk-tristate')).forEach(function(chk) {
        chk.onclick = function(e) {
          const elm = e.target;
          if (elm.readOnly) {
            elm.checked = elm.readOnly=false;
          }
          else if (!elm.checked) {
            elm.readOnly = elm.indeterminate=true;
          }
        }
      });
    },
    
    setValue(chkElm, boolOrUndefined) {
      if (boolOrUndefined === true) {
        chkElm.checked = true;
        chkElm.indeterminate = false;
      }
      else if (boolOrUndefined === false) {
        chkElm.checked = false;
        chkElm.indeterminate = false;
      }
      else {
        // undefined
        chkElm.checked = false;
        chkElm.indeterminate = true;
        chkElm.readOnly = true;
      }
    },

    getValue(chkElm) {
      const checked = chkElm.checked;
      const indeterminate = chkElm.indeterminate;

      if (checked === true) {
        return true;
      }
      else if (indeterminate === true) {
        return undefined;
      }
      else {
        return false;
      }
    }
  },

  distinctify: function(arr) {
    const set = new Set();
    for (let i = 0; i < arr.length; i++) {
      set.add(arr[i]);
    }
    return Array.from(set);
  },

  getDepthFirstTree: function(elem, elems = null) {
    elems = elems ?? [];
    
    if (elem) {
      elems.push(elem);
      
      if (elem.childNodes) {
        for (let i = 0; i < elem.childNodes.length; i++) {
          let child = elem.childNodes[i];
          ES6.getDepthFirstTree(child, elems);
        }
      }
    }
    
    return elems;
  },
  
  // joshwcomeau.com/snippets/javascript/debounce/
  debounce: function(callback, wait) {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback.apply(null, args);
      }, wait);
    };
  },
  
  isElmaWithinElmB: function(elmA, elmB, selfCheck = true) {
    if(selfCheck === true && elmA === elmB ) { return true; }
    while (elmA.parentNode && elmA.parentNode.nodeType == 1 /* element */) {
      elmA = elmA.parentNode;
      if (elmA === elmB) {
        return true;
      }
    }
    return false;
  },

  findUpClass: function(el, cls, selfCheck = true) {
    if(selfCheck === true && el && el.classList.contains(cls)) { return el; }
    while (el.parentNode && el.parentNode.nodeType == 1 /* element */) {
      el = el.parentNode;
      if (el.classList.contains(cls)) {
        return el;
      }
    }
    return null;
  },

  findUpByAttrValue: function(el, attrName, attrValue) {
    while (el.parentNode && el.parentNode.nodeType == 1 /* element */) {
      el = el.parentNode;
      let foundValue = el.getAttribute(attrName);
      if (foundValue && STR.sameText(foundValue, attrValue)) {
        return el;
      }
    }
  
    return null;
  },

  // stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
  findUpTag: function(el, tag, selfCheck = true) {
    if (selfCheck === true && el && STR.sameText(el.tagName, tag)) { return el; }
    while (el.parentNode && el.parentNode.nodeType == 1 /* element */) {
      el = el.parentNode;
      if (STR.sameText(el.tagName, tag)) {
        return el;
      }
    }
    return null;
  },

  // stackoverflow.com/questions/21776389/javascript-object-grouping
  groupBy: function(arr, prop) {
    const map = new Map(Array.from(arr, obj => [obj[prop], []]));
    arr.forEach(obj => map.get(obj[prop]).push(obj));
    return Array.from(map.values());
  },

  // stackoverflow.com/questions/1129216/sort-array-of-objects-by-string-property-value
  sortBy: function(arr, prop) {
    return arr.slice(0).sort(function(a, b) {
      if (!a[prop] && !b[prop]) { return 0; }
      if (a[prop] && !b[prop]) { return 1; }
      if (!a[prop] && b[prop]) { return -1; }
      return (a[prop] > b[prop]) ? 1 : (a[prop] < b[prop]) ? -1 : 0;
    });
  },

  sortByDesc: function(arr, prop) {
    return arr.slice(0).sort(function(a, b) {
      if (!a[prop] && !b[prop]) { return 0; }
      if (a[prop] && !b[prop]) { return -1; }
      if (!a[prop] && b[prop]) { return 1; }
      return (a[prop] > b[prop]) ? -1 : (a[prop] < b[prop]) ? 1 : 0;
    });
  },

  unfurlHtml: function(html) {
    
    if (!html || html.length === 0) {
      return '';
    }
    
    const elm = document.createElement('div');
    elm.innerHTML = DOMPurify.sanitize(html);
    const unfurled = ES6.getUnfurledText(elm);

    return unfurled;
  },

  // accounts for emojis and newlines
  getUnfurledText: function(elem, expandAnchors) {
    let elems = ES6.getDepthFirstTree(elem);
    
    const elps = '…'; // twitter ellipses
    let concat = '';
    
    for (let i = 0; i < elems.length; i++) {
      let e = elems[i];
      let txt = '';
      if (e.tagName && e.tagName.toLowerCase() === 'img') {
        let altAttr = e.getAttribute('alt');  // possible emoji
        if (EMOJI.isEmoji(altAttr)) {
          txt = altAttr;
        }
      }
      else if (e.nodeType == 3 && e.data && e.data != elps) {
        // text node
        txt = STR.cleanNewLineCharacters(e.data, '\n');
        if (e.parentNode && ES6.isElementNode(e.parentNode) && e.parentNode.tagName.toLowerCase() == 'a') {
          // it's common for an url to be displayed that omits the http prefix, but we need it
          let href = e.parentNode.getAttribute('href');
          if (STR.stripHttpWwwPrefix(txt) == STR.stripHttpWwwPrefix(href)) {
            // use the href instead
            txt = href;
          }
          else if (expandAnchors == true && txt.endsWith(elps)) {
            // this is abbreviated link text within an anchor; use the href instead
            txt = href;
          }
        }
      }
      else if (e.nodeName.toLowerCase() === 'br' || e.nodeName.toLowerCase() === 'p') {
        // newline
        txt = '\n';
      }
      
      concat = `${concat}${txt}`;
    }

    return concat;
  },

  getElementTextAsInt: function(elm) {
    if (!elm) { return undefined; }
    let val = elm.textContent;
    if (val && val.length > 0) {
      val = val.replace(',', '');
    }

    return parseInt(val);
  },

  addSeconds: function(date, seconds) {
    // Date.now() is in milliseconds
    return date + seconds * 1000;
  },

  // this is for case where the chrome extension context has become invalidated (e.g. on an upgrade)
  // insertion of the query string parameter is so we don't get caught in a refresh loop
  tryCureInvalidatedContext: function() {
    const parser = new URL(window.location.href);
    let dnr = parser.searchParams.get('dnr');
    if (dnr) {
      console.log('Page refresh is required, but we already tried! so this tab is simply disabled.');
      return false;
    }
    else {
      parser.searchParams.append('dnr', true);
      window.location = parser.href;
      return true;
    }
  },

  isElementNode: function(node) {
    return node && node.nodeType == 1;
  },

  previousElementNodeSibling: function(node) {
    let prior = node;
    // 10 should be plenty
    for (let i = 0; i < 10; i++) {
      prior = prior.previousSibling;
      if (prior == null) { return null; }
      if (ES6.isElementNode(prior)) { return prior; }
    }

    return null;
  },

  nextElementNodeSibling: function(node) {
    let next = node;
    // 10 should be plenty
    for (let i = 0; i < 10; i++) {
      next = next.nextSibling;
      if (next == null) { return null; }
      if (ES6.isElementNode(next)) { return next; }
    }

    return null;
  }
};