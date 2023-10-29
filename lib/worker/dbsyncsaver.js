var DBSYNCSAVER = {
  // called by continueRestore
  saveForRestore: function(request) {
    const step = request.step;
    const rateLimit = request.rateLimit;
    const data = request.data;

    const mapper = IMPORT_MAPPER_FACTORY.getMapper(step[SYNCFLOW.STEP.type]);
    const savableSet = mapper.mapSavableSet(data);
    // DBORM.SAVING.saveSet(savableSet);
    console.log('todo: kick off next step...');
  }
};