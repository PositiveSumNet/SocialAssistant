var TOPICS = {
  // fairly low-stakes, so wrapped in try/catch
  ensureRemoteTopicSettings: function() {
    try {
      TOPICS.ensureRemoteTopicsWorker();
    } catch (error) {
      console.log('failed pulling topics');
      console.log(error);
    }
  },

  ensureRemoteTopicsWorker: function() {
    const shouldPull = TOPICS.shouldPullRemoteTopics();
    if (!shouldPull) { return; }
    console.log('pulling remote server topics');
    localStorage.setItem(SETTINGS.REMOTE.LAST_TOPICS_PULL_TRY, Date.now());
    GITHUB.getRawContent(TOPICS.onFetchedRawTopicContent, GITHUB.PUBLISHER_ORG, GITHUB.TOPICS_REPO, GITHUB.TOPICS_FILE);
  },

  onFetchedRawTopicContent: function(content) {
    TOPICS.parseTopics(content);
    localStorage.setItem(SETTINGS.REMOTE.LAST_TOPICS_PULL_SUCCESS, Date.now());
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

    console.log(topics);
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