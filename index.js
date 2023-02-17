const logHtml = function (cssClass, ...args) {
  const ln = document.createElement('div');
  if (cssClass) ln.classList.add(cssClass);
  ln.append(document.createTextNode(args.join(' ')));
  document.body.append(ln);
};

const ensureCopiedToDb = async function() {
  const all = await chrome.storage.local.get();
  for (const [key, val] of Object.entries(all)) {
    if (key.startsWith('fordb-')) {
      worker.postMessage(val);
    }
  }
}

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
// receive messages from worker
worker.onmessage = function ({ data }) {
  switch (data.type) {
    case 'log':
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    case 'workerReady':
      ensureCopiedToDb();
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
      break;
  }
};
