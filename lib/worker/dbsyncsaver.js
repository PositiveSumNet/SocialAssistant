var DBSYNCSAVER = {
  saveForRestore: function(step, data) {
    const mapper = IMPORT_MAPPER_FACTORY.getMapper(step[SYNCFLOW.STEP.type]);
    const savableSet = mapper.mapSavableSet(step, data);
    console.log(data);
  }
};