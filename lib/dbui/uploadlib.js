// smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/

let _dropArea = document.getElementById("drop-area");
let _uploadProgress = []
let _uploadProgressBar = document.getElementById('upload-progress-bar')
let _fileElem = document.getElementById('fileElem');

// Prevent default drag behaviors
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  _dropArea.addEventListener(eventName, preventDefaults, false)   
  document.body.addEventListener(eventName, preventDefaults, false)
});

// Highlight drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
  _dropArea.addEventListener(eventName, highlight, false)
});

['dragleave', 'drop'].forEach(eventName => {
  _dropArea.addEventListener(eventName, unhighlight, false)
});

// Handle dropped files
_dropArea.addEventListener('drop', handleDrop, false);

_fileElem.addEventListener('change', (event) => {
  handleUploadFiles(event.target.files);
});

function handleUploadFiles(files) {
  files = [...files];
  initializeUploadProgress(files.length);
  files.forEach(processUpload);
  //files.forEach(previewUploadFile);
}

function highlight(e) {
  _dropArea.classList.add('highlight');
}

function unhighlight(e) {
  _dropArea.classList.remove('active');
}

function handleDrop(e) {
  var dt = e.dataTransfer;
  var files = dt.files;

  handleUploadFiles(files);
}

function initializeUploadProgress(numFiles) {
  _uploadProgressBar.value = 0;
  _uploadProgress = [];

  for(let i = numFiles; i > 0; i--) {
    _uploadProgress.push(0);
  }
}

function updateUploadProgress(fileNumber, percent) {
  _uploadProgress[fileNumber] = percent;
  let total = _uploadProgress.reduce((tot, curr) => tot + curr, 0) / _uploadProgress.length;
  _uploadProgressBar.value = total;
}

function previewUploadFile(file) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function() {
    let img = document.createElement('img');
    img.src = reader.result;
    document.getElementById('upload-gallery').appendChild(img);
  };
}

// stackoverflow.com/questions/24886628/upload-file-inside-chrome-extension
function processUpload(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    console.log(e.target.result);
  }
  reader.readAsText(file);
}
