/*********************************************/
// general purpose utils for es6 dom & scraping
/*********************************************/

var ES6 = {
  
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
  
  findUpClass: function(el, cls, selfCheck = true) {
    if(selfCheck === true && el && el.classList.contains(cls)) { return el; }
    while (el.parentNode) {
      el = el.parentNode;
      if (el.classList.contains(cls)) {
        return el;
      }
    }
    return null;
  },

  // stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
  // stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
  findUpTag: function(el, tag, selfCheck = true) {
    if(selfCheck === true && el && STR.sameText(el.tagName, tag)) { return el; }
    while (el.parentNode) {
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
  getUnfurledText: function(elem) {
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
      }
      else if (e.nodeName.toLowerCase() === 'br' || e.nodeName.toLowerCase() === 'p') {
        // newline
        txt = '\n';
      }
      
      concat = `${concat}${txt}`;
    }

    return concat;
  }

};