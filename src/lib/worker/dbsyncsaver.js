var DBSYNCSAVER = {
  // called by continueRestore
  // reminder, we're on the worker thread
  saveForRestore: function(request) {
    const step = request.step;
    const rateLimit = request.rateLimit;
    const data = request.data;
    const rows = (data && data.data) ? data.data : [];  // data node holds the records
    
    if (rows.length > 0) {
      const mapper = IMPORT_MAPPER_FACTORY.getMapper(step[SYNCFLOW.STEP.type]);
      const savableSet = mapper.mapSavableSet(data);
      DBORM.SAVING.execSaveSet(savableSet);
    }

    const result = SYNCFLOW.PULL_EXEC.buildPulledResult(step, rows, rateLimit);
    
    postMessage({ 
      type: MSGTYPE.FROMDB.SAVED_FOR_RESTORE, 
      result: result
    });
  }
};