const logHtml = function (cssClass, ...args) {
  const ln = document.createElement('div');
  if (cssClass) ln.classList.add(cssClass);
  ln.append(document.createTextNode(args.join(' ')));
  document.body.append(ln);
};

const worker = new Worker('worker.js?sqlite3.dir=jswasm');
worker.onmessage = function ({ data }) {
  switch (data.type) {
    case 'log':
      logHtml(data.payload.cssClass, ...data.payload.args);
      break;
    default:
      logHtml('error', 'Unhandled message:', data.type);
  }
};
