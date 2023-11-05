var _topicTags = [];
var _ranTopicInit = false;

var TOPICS = {
  // TopicName: SubtopicName
  TOPIC_SUBTOPIC_COLON: ': ',

  // for a sync file we use
  // topicname_sub_subtopicname
  TOPIC_SUBTOPIC_FOR_FILE: '_sub_',
  
  concatTopicFullName: function(topicName, subtopicName) {
    return `${topicName}${TOPICS.TOPIC_SUBTOPIC_COLON}${subtopicName}`;
  },

  // saved to database; this is the callbacck
  onSavedTopicSubtopicPairs: function(payload) {
    const savedPairs = APPSCHEMA.SAVING.getSubset(payload.savableSet, APPSCHEMA.SocialTopicSubtopic.Name).sogs.map(function(sog) {
      return {
        topic: sog.s,
        subtopic: sog.o
      };
    });

    const topicNames = new Set(savedPairs.map(function(p) { return p.topic; }));

    // make sure the localStorage cache has them
    for (let i = 0; i < savedPairs.length; i++) {
      let savedPair = savedPairs[i];
      let addable = {
        Name: savedPair.topic,
        Subtopics: [
          {
            Name: savedPair.subtopic
          }
        ]
      };
      // handles merging, so we don't have to worry about losing existing subtopics
      SETTINGS.TOPICS.addTopic(addable);
    }
    
    // make sure the UI has them
    const allTopics = SETTINGS.TOPICS.getLocalCacheTopics();
    const relevantTopics = allTopics.filter(function(t) { return topicNames.has(t.Name); });
    RENDER.POST.TAGGING.ensureRenderedTopicChoices(relevantTopics);
  },
  
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

  buildSavableTopicSet: function(topicName, subtopicName) {
    const entDefn = APPSCHEMA.SocialTopicSubtopic;
    const entDefns = [entDefn];
    const savableSet = APPSCHEMA.SAVING.newSavableSet(entDefns, false);
    const record = {s: topicName.trim(), o: subtopicName.trim(), g: APPGRAPHS.METADATA};
    APPSCHEMA.SAVING.getSubset(savableSet, entDefn.Name).sogs.push(record);
    return savableSet;
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
        let subtopicName = subtopic.Name;
        if (subtopicName.endsWith(DEPRECATED_SUFFIX)) {
          subtopicName = STR.stripSuffix(subtopicName, DEPRECATED_SUFFIX);
          deprecated = true;
        }
        
        const topicSubtopicRecord = {s: topicName, o: subtopicName, g: graph};
        const topicSubtopicSet = deprecated == true ? deletableSet : savableSet;
        APPSCHEMA.SAVING.getSubset(topicSubtopicSet, APPSCHEMA.SocialTopicSubtopic.Name).sogs.push(topicSubtopicRecord);

        for (let w = 0; w < subtopic.Keywords.length; w++) {
          let word = subtopic.Keywords[w];
          let wordDep = deprecated;
          if (word.endsWith(DEPRECATED_SUFFIX)) {
            word = STR.stripSuffix(word, DEPRECATED_SUFFIX);
            wordDep = true;
          }

          const subtopicWordRecord = {s: subtopicName, o: word, g: graph };
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

  mergeTopics: function(serverTopics, localTopics, includeDeprecated) {
    const mergedTopics = [];
    mergedTopics.push(...localTopics);
    for (let i = 0; i < serverTopics.length; i++) {
      let serverTopic = serverTopics[i];
      if (!TOPICS.isDeprecatedTopic(serverTopic)) {
        let localTopic = mergedTopics.find(function(t) { return STR.sameText(t.Name, serverTopic.Name); });
        if (!localTopic) {
          mergedTopics.push(serverTopic);
        }
        else {
          // server and local both exist; make sure the local knows about all its subtopics
          for (let j = 0; j < serverTopic.Subtopics.length; j++) {
            let serverSubtopic = serverTopic.Subtopics[j];
            if (!TOPICS.isDeprecatedSubtopic(serverSubtopic)) {
              let localSubtopic = localTopic.Subtopics.find(function(t) { return STR.sameText(t.Name, serverSubtopic.Name); });
              if (!localSubtopic) {
                localTopic.Subtopics.push(serverSubtopic);
              }
            }
            else if (includeDeprecated == true) {
              localTopic.Subtopics.push(serverSubtopic);
            }
          }
        }
      }
      else if (includeDeprecated == true) {
        mergedTopics.push(serverTopic);
      }
    }

    return mergedTopics;
  },

  getMatchedTopic: function(topics, topicName, subtopicName) {
    return topics.find(function(t) {
      if (STR.sameText(t.Name, topicName)) {
        let matchedSubtopic = t.Subtopics.find(function(s) {
          return STR.sameText(s.Name, subtopicName);
        });
        if (matchedSubtopic) { 
          return true; 
        }
        else {
          return false;
        }
      }
      else {
        return false;
      }
    });
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
        let words = (subParts.length == 1) ? [] : subParts[1].split(', ').map(function(p) { return p.trim(); });
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
  },

  fromConcatNames: function(concatNames) {
    concatNames = concatNames.sort();
    const topics = [];
    for (let i = 0; i < concatNames.length; i++) {
      let concatName = concatNames[i];
      let splat = concatName.split(TOPICS.TOPIC_SUBTOPIC_COLON);
      if (splat.length == 2) {
        let topicName = splat[0];
        let subtopicName = splat[1];
        let topic = topics.find(function(t) { return STR.sameText(t.Name, topicName); });
        if (!topic) {
          topic = {
            Name: topicName,
            Subtopics: []
          };
          topics.push(topic);
        }
        let subtopic = topic.Subtopics.find(function(s) { return STR.sameText(s.Name, subtopicName); });
        if (!subtopic) {
          topic.Subtopics.push({Name: subtopicName});
        }
      }
    }

    return topics;
  }
}