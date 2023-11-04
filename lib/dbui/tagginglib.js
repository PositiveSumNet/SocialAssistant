var _inUseTags = new Set();

var TAGGING = {
  CONSTANTS: {
    TAG_RATE: '-- Set topic & rate --',
    TAG_FILTER_BY: '-- Filter by topic --',
    UNTAG_THIS_POST: 'Untag this post',
    REQUEST_TOPIC: 'Add a topic',
    REQUEST_SUBTOPIC: 'Add a subtopic',
  },
  POSTS: {
    onTaggingSuccess: function(saveTagMsg) {
      const postScoredTaggerElm = RENDER.getElmByEditingId(saveTagMsg.editingId);
      let hasTag = false;
      // tag name is via concatSubtopicRatingTag
      let concatSubtopic;
      let rating;
      const sogs = APPSCHEMA.SAVING.getSogs(saveTagMsg.savableSet, APPSCHEMA.SocialPostSubtopicRating.Name);
      if (sogs.length == 1) {
        const tagName = sogs[0].o;
        const splt = STR.splitSubtopicRatingTag(tagName);
        if (splt) {
          concatSubtopic = splt.subtopic;
          rating = splt.rating;
        }

        postScoredTaggerElm.classList.remove('noneSelected');
      }
      else {
        postScoredTaggerElm.classList.add('noneSelected');
      }

      if (rating) {
        hasTag = true;
      }
      
      const clsNames = Array.from(postScoredTaggerElm.classList);
      for (let i = 0; i < clsNames.length; i++) {
        let clsName = clsNames[i];
        if (clsName.startsWith('quintile-')) {
          postScoredTaggerElm.classList.remove(clsName);
        }
      }

      if (rating) {
        postScoredTaggerElm.classList.add(`quintile-${rating}`);
      }
      
      // also update the cls of the container (for + sign visibility)
      const container = ES6.findUpClass(postScoredTaggerElm, 'postScoredTaggers');
      if (hasTag == true) {
        container.classList.add('hasTag');
      }
      else {
        container.classList.remove('hasTag');
      }

      if (STR.hasLen(concatSubtopic)) {
        postScoredTaggerElm.setAttribute('data-testid', concatSubtopic);
        const found = _inUseTags.has(concatSubtopic);
        if (!STR.hasLen(found)) {
          _inUseTags.add(concatSubtopic);
          // call out to index.js
          adjustTopicFilterVisibility();
        }
      }
      else {
        // if there's another tagging element in place, we don't need this one
        const familyElms = Array.from(container.querySelectorAll('.postScoredTagger'));
        if (familyElms.length > 1) {
          postScoredTaggerElm.remove();
          return;
        }
      }

      // now visually update the tagger ui
      const txtBox = postScoredTaggerElm.querySelector('.postTagText');
      txtBox.value = concatSubtopic;
      txtBox.setAttribute('title', concatSubtopic); // in case it's too big to see the whole thing
      RENDER.POST.TAGGING.finishTagEdits(postScoredTaggerElm);
    },
    
    buildSaveTagMsg: function(postScoredTaggerElm, newRatedSubtopic, oldRatedSubtopic, pageType) {
      if (!STR.hasLen(newRatedSubtopic) && !STR.hasLen(oldRatedSubtopic)) { return null; }
      
      const editingId = RENDER.setEditingId(postScoredTaggerElm);
      const urlKey = RENDER.POST.getPostUrlKey(postScoredTaggerElm);
      
      const entDefns = [APPSCHEMA.SocialPostSubtopicRating];
      const savableSet = APPSCHEMA.SAVING.newSavableSet(entDefns, false);
      const deletableSet = APPSCHEMA.SAVING.newSavableSet(entDefns, false);
      const graph = APPGRAPHS.getGraphByPageType(pageType);

      if (STR.hasLen(newRatedSubtopic)) {
        const newTopic = { s: urlKey, o: newRatedSubtopic, g: graph };
        APPSCHEMA.SAVING.getSubset(savableSet, APPSCHEMA.SocialPostSubtopicRating.Name).sogs.push(newTopic);
      }
      if (STR.hasLen(oldRatedSubtopic)) {
        const oldTopic = { s: urlKey, o: oldRatedSubtopic, g: graph };
        APPSCHEMA.SAVING.getSubset(deletableSet, APPSCHEMA.SocialPostSubtopicRating.Name).sogs.push(oldTopic);
      }

      return {
        actionType: MSGTYPE.TODB.EXECUTE_SAVE_AND_DELETE,
        savableSet: savableSet,
        deletableSet: deletableSet,
        urlKey: urlKey,
        editingId: editingId,
        onSuccessType: MSGTYPE.FROMDB.ON_SUCCESS.SAVED_POST_TAG
      };
    },

    setRating: function(postScoredTaggerElm, rating) {
      const cmbElm = postScoredTaggerElm.querySelector('select');
      const selValue = STR.hasLen(cmbElm.value) ? STR.fromBase64(cmbElm.value) : '';
      let subtopicName = '';

      if (selValue == TAGGING.CONSTANTS.REQUEST_TOPIC) {
        // tell the user how to suggest tags
        window.open('https://github.com/PositiveSumNet/Democracy/blob/main/README.md', '_blank');
        return;
      } else if (selValue != TAGGING.CONSTANTS.UNTAG_THIS_POST && selValue != TAGGING.CONSTANTS.TAG_RATE) {
        subtopicName = selValue;
      }

      TAGGING.POSTS.setRatingWorker(postScoredTaggerElm, rating, subtopicName);
    },

    setRatingWorker: function(postScoredTaggerElm, rating, subtopicName) {
      const pageType = QUERYING_UI.PAGE_TYPE.getPageTypeFromUi();
      const oldSubtopicName = postScoredTaggerElm.getAttribute('data-testid');
      
      const oldRating = Array.from(postScoredTaggerElm.classList)
        .filter(function(cls) { 
          return cls.startsWith('quintile-')
        }).map(function(cls) { 
          return parseInt(cls.split('-')[1]); 
        });
      
      if (!rating && STR.hasLen(subtopicName)) {
        // no rating was provided; and yet we are trying to tag (non-null subtopic)
        // retain existing stars
        rating = oldRating;
      }

      const newTagName = STR.hasLen(subtopicName) ? STR.concatSubtopicRatingTag(subtopicName, rating) : null;

      let oldTagName;
      if (STR.hasLen(oldSubtopicName)) {
        oldTagName = STR.concatSubtopicRatingTag(oldSubtopicName, oldRating);
      }
      
      // the actual save
      const saveTagMsg = TAGGING.POSTS.buildSaveTagMsg(postScoredTaggerElm, newTagName, oldTagName, pageType);
      _worker.postMessage(saveTagMsg);
     }
  }
};