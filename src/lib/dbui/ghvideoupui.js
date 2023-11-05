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
    document.getElementById('uploadPending').classList.remove('d-none');
    document.getElementById('uploadSuccess').classList.add('d-none');
    document.getElementById('uploadError').classList.add('d-none');

    const fileNameSet = new Set();
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      let cleanName = STR.cleanDownloadedFileName(file.name);
      if (!fileNameSet.has(cleanName)) {
        GHVIDEOUP_UI.processVideoUpload(file);
        fileNameSet.add(cleanName);
      }
    }
  },

  processVideoUpload: function(file)  {
    const reader = new FileReader();

    // set the event for when reading completes
    reader.onload = async function(e) {
      const uploadedCntElem = document.getElementById('uploadedCnt');
      uploadedCntElem.innerText = parseInt(uploadedCntElem.innerText) + 1;
      // base64.guru/converter/encode/video
      let b64Data = e.target.result;
      
      await GITHUB.VIDEOS.uploadVideoWorker(
        b64Data, 
        reader.fileName, 
        GHVIDEOUP_UI.onUploadVideoSuccess, 
        GHVIDEOUP_UI.onUploadVideoError);
    }
  
    // start reading
    // stackoverflow.com/questions/36280818/how-to-convert-file-to-base64-in-javascript
    reader.fileName = file.name;
    // bacancytechnology.com/qanda/javascript/javascript-using-the-filereader-api
    reader.readAsDataURL(file);
  },

  onUploadVideoSuccess: async function(successMsg, repoConnInfo) {
    document.getElementById('uploadPending').classList.add('d-none');
    document.getElementById('uploadSuccess').classList.remove('d-none');
    document.querySelector('#uploadSuccess span').textContent = successMsg;

    const processedCntElem = document.getElementById('uploadProcessedCnt');
    processedCntElem.innerText = parseInt(processedCntElem.innerText) + 1;

    const repoType = GITHUB.REPO_TYPE.VIDEOS;
    const rateLimit = await GITHUB.getRateLimit(repoConnInfo.token, repoType);
    GHCONFIG_UI.renderRateLimit(rateLimit);
  },

  onUploadVideoError: function(errorMsg) {
    document.getElementById('uploadPending').classList.add('d-none');
    document.getElementById('uploadError').classList.remove('d-none');
    document.querySelector('#uploadError span').textContent = errorMsg;
  }
};