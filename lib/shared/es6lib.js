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
