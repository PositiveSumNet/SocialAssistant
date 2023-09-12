var _topicTags = [];
var _ranTopicInit = false;

var TOPICS = {
  RENDER_DELIM: ': ',
  
  // fairly low-stakes, so wrapped in try/catch
  ensureRemoteTopicSettings: function(rawContentCallback) {
    try {
      TOPICS.ensureRemoteTopicsWorker(rawContentCallback);
    } catch (error) {
      console.log('failed pulling topics');
      console.log(error);
    }
  },

  ensureRemoteTopicsWorker: function(rawContentCallback) {
    const shouldPull = TOPICS.shouldPullRemoteTopics();
    if (!shouldPull) { return; }
    console.log('pulling remote server topics');
    localStorage.setItem(SETTINGS.REMOTE.LAST_TOPICS_PULL_TRY, Date.now());
    GITHUB.getRawContent(rawContentCallback, GITHUB.PUBLISHER_ORG, GITHUB.TOPICS_REPO, GITHUB.TOPICS_FILE);
  },

  // returns { savableSet, deletableSet }
  // We need a way for the remote settings to tell us locally to delete deprecated records
  // so that stale concepts are no longer used by auto-complete
  buildSets: function(topics) {
    const entDefns = [
      APPSCHEMA.SocialTopicSubtopic,
      APPSCHEMA.SocialSubtopicKeyword
    ];

    const savableSet = APPSCHEMA.SAVING.newSavableSet(entDefns, false);
    const deletableSet = APPSCHEMA.SAVING.newSavableSet(entDefns, false);
    const graph = APPGRAPHS.METADATA;

    for (let t = 0; t < topics.length; t++) {
      let topic = topics[t];
      let topicName = topic.Name;
      let deprecated = false;
      if (topicName.endsWith(DEPRECATED_SUFFIX)) {
        topicName = STR.stripSuffix(topicName, DEPRECATED_SUFFIX);
        deprecated = true;
      }
      for (let s = 0; s < topic.Subtopics.length; s++) {
        let subtopic = topic.Subtopics[s];
        let subTopicName = subtopic.Name;
        if (subTopicName.endsWith(DEPRECATED_SUFFIX)) {
          subTopicName = STR.stripSuffix(subTopicName, DEPRECATED_SUFFIX);
          deprecated = true;
        }
        
        const topicSubtopicRecord = {s: topicName, o: subTopicName, g: graph};
        const topicSubtopicSet = deprecated == true ? deletableSet : savableSet;
        APPSCHEMA.SAVING.getSubset(topicSubtopicSet, APPSCHEMA.SocialTopicSubtopic.Name).sogs.push(topicSubtopicRecord);

        for (let w = 0; w < subtopic.Keywords.length; w++) {
          let word = subtopic.Keywords[w];
          let wordDep = deprecated;
          if (word.endsWith(DEPRECATED_SUFFIX)) {
            word = STR.stripSuffix(word, DEPRECATED_SUFFIX);
            wordDep = true;
          }

          const subtopicWordRecord = {s: subTopicName, o: word, g: graph };
          const subtopicWordSet = wordDep == true ? deletableSet : savableSet;
          APPSCHEMA.SAVING.getSubset(subtopicWordSet, APPSCHEMA.SocialSubtopicKeyword.Name).sogs.push(subtopicWordRecord);
        }
      }
    }

    return {
      savableSet: savableSet,
      deletableSet: deletableSet
    }
  },

  // to localStorage
  cacheTopicsToLocal: function(topics) {
    localStorage.setItem('topics', JSON.stringify(topics));
    _topicTags = [];  // invalidate the in-memory cache
  },

  // from localStorage
  getLocalCacheTopics: function() {
    const json = localStorage.getItem('topics');
    if (!STR.hasLen(json)) { return []; }
    return JSON.parse(json);
  },

  isDeprecatedTopic: function(topic) {
    return topic.Name.endsWith(DEPRECATED_SUFFIX);
  },

  isDeprecatedSubtopic: function(subtopic) {
    return subtopic.Name.endsWith(DEPRECATED_SUFFIX);
  },

  isDeprecatedWord: function(word) {
    return word.endsWith(DEPRECATED_SUFFIX);
  },

  parseTopics: function(content) {
    const lines = content.split('\n');
    const topics = [];
    let topic;
    let subtopic;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      if (line.startsWith('# ')) {
        // topic
        topic = {
          Name: STR.stripPrefix(line, '# ').trim(),
          Subtopics: []
        };
        topics.push(topic);
      }
      else if (line.startsWith('- ')) {
        // subtopic
        let subLine = STR.stripPrefix(line, '- ').trim();
        let subParts = subLine.split(': ');
        let words = subParts[1].split(', ').map(function(p) { return p.trim(); });
        subtopic = {
          Name: subParts[0].trim(),
          Keywords: words
        };
        topic.Subtopics.push(subtopic);
      }
    }

    return topics;
  },

  shouldPullRemoteTopics: function() {
    const tryMsAgoCutoff = 5 * 60 * 1000; // 5 minutes
    const successMsAgoCutoff = 6 * 60 * 60 * 1000; // 6 hours
    
    return SETTINGS.shouldRetryNow(
      SETTINGS.REMOTE.LAST_TOPICS_PULL_TRY, 
      SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS, 
      tryMsAgoCutoff, 
      successMsAgoCutoff);
  }
}