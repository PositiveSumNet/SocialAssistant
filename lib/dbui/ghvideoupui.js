/************************/
// Upload/Import (videos)
// smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/
/************************/
var GHVIDEOUP_UI = {
  bindElements: function() {
    const dropArea = document.getElementById("drop-area");
    const fileElem = document.getElementById('fileElem');

    // a full page refresh is in order (helps avoid disk log + redraws the full page)
    document.getElementById('uploadDone').onclick = function(event) {
      // a full page refresh is in order
      location.reload();
      return false;
    };  

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, ES6.preventDragBehaviors, false)   
      document.body.addEventListener(eventName, ES6.preventDragBehaviors, false)
    });

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, function() {
        dropArea.classList.add('highlightDropArea');
      }, false)
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, function() {
        dropArea.classList.remove('active');
      }, false)
    });

    // Handle dropped files
    dropArea.addEventListener('drop', function(e) {
      var dt = e.dataTransfer;
      var files = dt.files;
    
      GHVIDEOUP_UI.handleUploadFiles(files);
    }, false);

    fileElem.addEventListener('change', (event) => {
      GHVIDEOUP_UI.handleUploadFiles(event.target.files);
    });
  },

  handleUploadFiles: function(files) {
    files = [...files];
    files.forEach(GHVIDEOUP_UI.processVideoUpload);
  },

  processVideoUpload: function(file)  {
    const reader = new FileReader();

    // set the event for when reading completes
    reader.onload = async function(e) {
      const uploadedCntElem = document.getElementById('uploadedCnt');
      uploadedCntElem.innerText = parseInt(uploadedCntElem.innerText) + 1;
      // base64.guru/converter/encode/video
      // outputs e.g.:
      // data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA...
      let buffer = e.target.result;
      console.log(buffer);
      // outputs e.g.: 'scafaria_status_1626566689864163329 (1).mp4'
      console.log(reader.fileName);
      // let videoBlob = new Blob([new Uint8Array(buffer)], { type: 'video/mp4' });
      // let url = window.URL.createObjectURL(videoBlob);
  
      GHVIDEOUP_UI.onProcessedUploadBatch();
    }
  
    // start reading
    // stackoverflow.com/questions/36280818/how-to-convert-file-to-base64-in-javascript
    reader.fileName = file.name;
    // bacancytechnology.com/qanda/javascript/javascript-using-the-filereader-api
    reader.readAsDataURL(file);
  },

  onProcessedUploadBatch: function() {
    const processedCntElem = document.getElementById('uploadProcessedCnt');
    processedCntElem.innerText = parseInt(processedCntElem.innerText) + 1;
  }
};