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
    document.getElementById('uploadSuccess').classList.add('d-none');
    document.getElementById('uploadError').classList.add('d-none');

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
      let b64Data = e.target.result;
      await GHVIDEOUP_UI.uploadVideoWorker(b64Data, reader.fileName);
    }
  
    // start reading
    // stackoverflow.com/questions/36280818/how-to-convert-file-to-base64-in-javascript
    reader.fileName = file.name;
    // bacancytechnology.com/qanda/javascript/javascript-using-the-filereader-api
    reader.readAsDataURL(file);
  },

  onUploadVideoSuccess: function(result) {
    document.getElementById('uploadSuccess').classList.remove('d-none');
    document.querySelector('#uploadSuccess span').textContent = result.fileName;

    const processedCntElem = document.getElementById('uploadProcessedCnt');
    processedCntElem.innerText = parseInt(processedCntElem.innerText) + 1;
  },

  onUploadVideoError: function(errorMsg) {
    document.getElementById('uploadError').classList.remove('d-none');
    document.querySelector('#uploadError span').textContent = result.errorMsg;
  },

  // b64Data is e.g. "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAA...""
  // also see base64.guru/converter/encode/video
  // fileName e.g.: 'scafaria_status_1626566689864163329 (1).mp4'
  uploadVideoWorker: async function(b64Data, fileName) {
    fileName = STR.cleanDownloadedFileName(fileName);
    const repoType = GITHUB.REPO_TYPE.VIDEOS;
    const onFailure = GHCONFIG_UI.onGithubFailure;
    const repoConnInfo = await GITHUB.SYNC.getRepoConnInfo(onFailure, repoType);
    if (!repoConnInfo) { return; }

    // check accessibility
    const rateLimit = await GITHUB.getRateLimit(repoConnInfo.token, repoType);
    if (GITHUB.SYNC.checkIfRateLimited(rateLimit, onFailure) == true) {
      return;
    }

    // storing at the root
    const fileUrl = `https://api.github.com/repos/${repoConnInfo.userName}/${repoConnInfo.repoName}/contents/${fileName}`;
    //const existingSha = await GITHUB.SHAS.getBlobSha(relPath, repoConnInfo);

    try {
      
    }
    catch(err) {
      onFailure();
    }
    // onsuccess
    // GHVIDEOUP_UI.onProcessedUploadBatch();

  }
};