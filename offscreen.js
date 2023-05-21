chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  switch (message.actionType) {
    case 'navFrameUrl':
      await navFrameUrl(message);
      return true;
    default:
      return false;
  }
}

async function navFrameUrl(message) {
  const oldFrame = document.getElementById('extUrlFrame');
  oldFrame.parentElement.removeChild(oldFrame);
  const newFrame = document.createElement('iframe');
  newFrame.setAttribute('id', 'extUrlFrame');
  newFrame.src = message.url;
  document.body.appendChild(newFrame);
}