/*********************************************/
// general purpose utils for es6 dom & scraping
/*********************************************/

function distinctify(arr) {
  const set = new Set();
  for (let i = 0; i < arr.length; i++) {
    set.add(arr[i]);
  }
  return Array.from(set);
}

function getDepthFirstTree(elem, elems = null) {
  elems = elems ?? [];
  
  if (elem) {
    elems.push(elem);
    
    if (elem.childNodes) {
      for (let i = 0; i < elem.childNodes.length; i++) {
        let child = elem.childNodes[i];
        getDepthFirstTree(child, elems);
      }
    }
  }
  
  return elems;
}

// joshwcomeau.com/snippets/javascript/debounce/
function debounce(callback, wait) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

function findUpClass(el, cls, selfCheck = true) {
  if(selfCheck === true && el && el.classList.contains(cls)) { return el; }
  while (el.parentNode) {
    el = el.parentNode;
    if (el.classList.contains(cls)) {
      return el;
    }
  }
  return null;
}

// stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
// stackoverflow.com/questions/7332179/how-to-recursively-search-all-parentnodes/7333885#7333885
function findUpTag(el, tag, selfCheck = true) {
  if(selfCheck === true && el && sameText(el.tagName, tag)) { return el; }
  while (el.parentNode) {
    el = el.parentNode;
    if (sameText(el.tagName, tag)) {
      return el;
    }
  }
  return null;
}

// stackoverflow.com/questions/21776389/javascript-object-grouping
function groupBy(arr, prop) {
  const map = new Map(Array.from(arr, obj => [obj[prop], []]));
  arr.forEach(obj => map.get(obj[prop]).push(obj));
  return Array.from(map.values());
}

// accounts for emojis
function getUnfurledText(elem) {
  let elems = getDepthFirstTree(elem);
  
  const elps = '…'; // twitter ellipses
  let concat = '';
  
  for (let i = 0; i < elems.length; i++) {
    let e = elems[i];
    let txt = '';
    if (e.tagName && e.tagName.toLowerCase() === 'img') {
      let altAttr = e.getAttribute('alt');  // possible emoji
      if (isEmoji(altAttr)) {
        txt = altAttr;
      }
    }
    else if (e.nodeType == 3 && e.data && e.data != elps) {
      // text node
      txt = e.data;
    }
    
    concat = `${concat}${txt}`;
  }

  return concat;
}
