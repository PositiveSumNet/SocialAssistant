var LOG_UI = {
  // when sqlite pushes unhandled exception log messages, they log (ugly) as rendered divs
  logHtml: function(cssClass, ...args) {
    let elm = document.getElementById('logMsgSection')
  
    if (!elm) { 
      elm = document.createElement('div') 
      elm.append(document.createTextNode(args.join(' ')));
      document.body.append(elm);
    }
    else {
      elm.classList.remove('d-none');
      elm.textContent = args.join('\n');
    }
    
    if (cssClass) elm.classList.add(cssClass);
  },

  logSqliteVersion: function(versionInfo) {
    document.getElementById('sqliteVersionLib').textContent = versionInfo.libVersion;
    document.getElementById('sqliteOpfsOk').textContent = versionInfo.opfsOk.toString();
    //document.getElementById('sqliteSourceId').textContent = versionInfo.sourceId;
  },

  logDbScriptVersion: function(versionInfo) {
    document.getElementById('dbScriptNumber').textContent = versionInfo.version.toString();
  }
};