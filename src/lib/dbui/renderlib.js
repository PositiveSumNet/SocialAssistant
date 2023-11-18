var RENDER = {

  prepareDisplayText: function(txt, withAnchors, renderAnchorsRule) {
    if (!txt) { return txt; }
    txt = EMOJI.injectFlagEmojis(txt);
    
    txt = STR.cleanNewLineCharacters(txt, '<br>');

    if (withAnchors) {
      
      if (renderAnchorsRule === 'urlOnly' || renderAnchorsRule === 'all') {
        txt = RENDER.renderUrlAnchors(txt);
      }
      
      if (renderAnchorsRule === 'emailOnly' || renderAnchorsRule === 'all') {
        txt = RENDER.PERSON.renderEmailAnchors(txt);
      }
      
      if (renderAnchorsRule === 'mdonOnly' || renderAnchorsRule === 'all') {
        txt = RENDER.MASTODON.renderMastodon1Anchors(txt);
        txt = RENDER.MASTODON.renderMastodon2Anchors(txt);
        txt = RENDER.MASTODON.renderMastodon3Anchors(txt);
      }
    }
    
    return txt;
  },

  saveTextFile: function(txt, filename) {
    var a = document.createElement('a');
    var file = new Blob( [txt], {type: 'text/plain'} );
    
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
  
    URL.revokeObjectURL(a.href);
    a.remove();
  },

  // this is so callbacks can know which element was being edited
  setEditingId: function(elm) {
    const clsName = `editing-${Date.now()}`;
    elm.classList.add(clsName);
    return clsName;
  },

  getElmByEditingId: function(editingId) {
    if (!STR.hasLen(editingId)) { return null; }
    return document.querySelector(`.${editingId}`);
  },

  makeNukeTagBtn: function(klasses, clickFn) {
    const nukeA = document.createElement('a');
    if (klasses && Array.isArray(klasses)) {
      for (let i = 0; i < klasses.length; i++) {
        let klass = klasses[i];
        nukeA.classList.add(klass);
      }
    }
    if (clickFn) {
      nukeA.onclick = clickFn;
    }
    nukeA.classList.add('position-absolute');
    nukeA.classList.add('top-0');
    nukeA.classList.add('start-100');
    nukeA.classList.add('translate-middle');
    nukeA.classList.add('mt-1');
    const nukeIcon = document.createElement('i');
    nukeIcon.classList.add('bi-x');
    nukeA.appendChild(nukeIcon);
    return nukeA;
  },

  CLS: {
    // hollow if not favorited
    STAR_OFF_CLS: 'bi-star',
    STAR_ON_CLS: 'bi-star-fill'
  },

  POST: {
    
    // tag (topic) and rate (events call TAGGING.POSTS)
    TAGGING: {
      
      finishTagEdits: function(elm) {
        const container = ES6.findUpClass(elm, 'postScoredTaggers');
        container.classList.remove('pickingTag');
        // re-enable the textboxes
        const txtElms = Array.from(container.querySelectorAll('input[type="text"]'));
        for (let i = 0; i < txtElms.length; i++) {
          let txtElm = txtElms[i];
          txtElm.disabled = false;
        }

        // clear out any superfluous taggers (if they had clicked "+" and then canceled)
        const taggers = Array.from(container.querySelectorAll('.postScoredTagger'));
        for (let i = 0; i < taggers.length; i++) {
          let postScoredTaggerElm = taggers[i];
          postScoredTaggerElm.classList.remove('pickingTag');
          let concatSubtopic = RENDER.POST.TAGGING.getConcatSubtopic(postScoredTaggerElm);
          // starting at 1 (not 0) because we need at least the first one
          if (i > 0 && !STR.hasLen(concatSubtopic)) {
            postScoredTaggerElm.remove();
          }
        }
      },

      cancelTagEdits: function(cancelBtn) {
        cancelBtn.onclick = function(event) {
          RENDER.POST.TAGGING.finishTagEdits(cancelBtn);
          return false;
        }
      },

      configureAddAnotherTag: function(addBtn) {
        addBtn.onclick = function(event) {
          const ctrlHtml = RENDER.POST.TAGGING.renderTagControl();
          const container = ES6.findUpClass(addBtn, 'postScoredTaggers');
          addBtn.insertAdjacentHTML('beforebegin', ctrlHtml);
          const allElms = container.querySelectorAll('.postScoredTagger');
          const newElm = allElms[allElms.length - 1];
          RENDER.POST.TAGGING.configureTagAndRate(newElm);
          return false;
        }
      },

      clickClearSelection: function(event) {
        const topicA = event.target;
        const postScoredTaggerElm = ES6.findUpClass(topicA, 'postScoredTagger');
        TAGGING.POSTS.setRating(postScoredTaggerElm, undefined, '');
        const txtBox = postScoredTaggerElm.querySelector('.postTagText');
        txtBox.value = TAGGING.CONSTANTS.TAG_RATE;
        RENDER.POST.TAGGING.finishTagEdits(postScoredTaggerElm);
        return false;
      },

      clickRequestNewTopic: function(event) {
        const input = prompt("Name of topic:", '');
        if (input != null) {
          if (input.indexOf(TOPICS.TOPIC_SUBTOPIC_COLON) > -1) {
            alert(`Topic cannot include the ${TOPICS.TOPIC_SUBTOPIC_COLON} character`);
          }
          else {
            SETTINGS.TOPICS.unhideTopicName(input); // in case it was a hidden topic
            // there's nothing to persist permanently yet (until at least one subtopic exists)
            const dummyTopic = {};
            dummyTopic.Name = input;
            dummyTopic.Subtopics = [];
            SETTINGS.TOPICS.addTopic(dummyTopic);
            RENDER.POST.TAGGING.ensureRenderedTopicChoices([dummyTopic]);
            // QUERYWORK_UI.saveTopic(input, input);
          }
        }
        return false;
      },

      clickDeprecateSubtopicBtn: function(event) {
        const delBtnElm = event.target;
        const topicName = RENDER.POST.TAGGING.getElmTopicName(delBtnElm);
        const subtopicBtn = ES6.findUpClass(delBtnElm, 'subtopicBtn');
        const subtopicName = RENDER.POST.TAGGING.getElmSubtopicName(subtopicBtn);
        const concatName = TOPICS.concatTopicFullName(topicName, subtopicName);
        // same comment applies as clickDeprecateTopicBtn
        SETTINGS.TOPICS.saveHiddenConcatName(concatName);
        RENDER.POST.TAGGING.onDeprecation();
        return false;
      },

      clickDeprecateTopicBtn: function(event) {
        const btn = event.target;
        const topicName = RENDER.POST.TAGGING.getElmTopicName(btn);
        if (confirm(`Deprecate the '${topicName}' topic?`) == true) {
          // this is just a visual hide based on localStorage cache (not a DB purge)
          // note that SocialTopicSubtopic isn't used for much in the DB anyway except for "auto-magically" finding matched posts based on keywords
          SETTINGS.TOPICS.saveHiddenTopicName(topicName);
          RENDER.POST.TAGGING.onDeprecation();
        }
        return false;
      },

      getElmSubtopicName: function(elm) {
        const subtopicBtn = ES6.findUpClass(elm, 'subtopicBtn', true);  // in case the anchor was passed in instead
        if (subtopicBtn.classList.contains('addSubtopicBtn')) { return null; }
        return subtopicBtn.querySelector('.subtopicLnk').textContent.trim();
      },

      getElmTopicName: function(elm) {
        const topicLi = ES6.findUpClass(elm, 'topicListItem');
        return topicLi.getAttribute('data-testid');
      },

      clickRegularTopicAnchor: function(event) {
        const topicA = event.target;

        const ulElm = ES6.findUpTag(topicA, 'ul');
        Array.from(ulElm.querySelectorAll('.active')).forEach(function(elm) {
          // only one active at a time
          elm.classList.remove('active');
        });

        const liElm = ES6.findUpTag(topicA, 'li');
        liElm.classList.add('active');
  
        return false;
      },

      onDeprecation: function() {
        var hiddenTopics = new Set(SETTINGS.TOPICS.getHiddenTopicNames());
        var hiddenConcats = new Set(SETTINGS.TOPICS.getHiddenConcatNames());

        Array.from(document.querySelectorAll('.topicListItem')).forEach(function(topicLiElm) {
          let topicName = RENDER.POST.TAGGING.getElmTopicName(topicLiElm);
          if (STR.hasLen(topicName) && hiddenTopics.has(topicName)) {
            topicLiElm.classList.add('d-none');
          }
          else {
            Array.from(topicLiElm.querySelectorAll('.subtopicBtn')).forEach(function(subtopicBtn) {
              let subtopicName = RENDER.POST.TAGGING.getElmSubtopicName(subtopicBtn);
              let concat = TOPICS.concatTopicFullName(topicName, subtopicName);
              if (hiddenConcats.has(concat)) {
                subtopicBtn.classList.add('d-none');
              }
            });
          }
        });
      },

      ensureRenderedTopicChoices: function(topics) {
        const pickerElms = Array.from(document.querySelectorAll('.topicsPicker'));
        for (let i = 0; i < pickerElms.length; i++) {
          let pickerElm = pickerElms[i];
          let addAnotherElm = pickerElm.querySelector('.createTopicBtn');
          for (let j = 0; j < topics.length; j++) {
            let topic = topics[j];
            RENDER.POST.TAGGING.renderTopicChoice(pickerElm, topic, topic, null, undefined, addAnotherElm);
          }
        }
      },

      clickSubtopicAnchor: function(event) {
        const elm = event.target;
        const topicName = RENDER.POST.TAGGING.getElmTopicName(elm);
        const subtopicName = RENDER.POST.TAGGING.getElmSubtopicName(elm);
        const concatName = TOPICS.concatTopicFullName(topicName, subtopicName);
        const postScoredTaggerElm = ES6.findUpClass(elm, 'postScoredTagger');
        TAGGING.POSTS.setRating(postScoredTaggerElm, undefined, concatName);
        return false;
      },

      clickAddSubtopicBtn: function(event) {

        const elm = event.target;
        const topicName = RENDER.POST.TAGGING.getElmTopicName(elm);
        const input = prompt("Name of subtopic:", '');
        if (input != null) {
          if (input.indexOf(TOPICS.TOPIC_SUBTOPIC_COLON) > -1) {
            alert(`Cannot include the ${TOPICS.TOPIC_SUBTOPIC_COLON} character`);
          }
          else {
            const concatName = TOPICS.concatTopicFullName(topicName, input);
            SETTINGS.TOPICS.unhideConcatName(concatName);
            const subtopicsUl = ES6.findUpClass(elm, 'subtopicsUl');
            const existingLi = RENDER.POST.TAGGING.getExistingSubtopicLi(subtopicsUl, input);
            if (!existingLi) {
              QUERYWORK_UI.saveTopic(topicName, input);
            }
          }
        }
        return false;
      },

      getExistingSubtopicLi: function(subtopicsUl, subtopicName) {
        const found = Array.from(subtopicsUl.querySelectorAll('li.subtopicBtn')).find(function(li) {
          let elmSubtopicName = RENDER.POST.TAGGING.getElmSubtopicName(li);
          return elmSubtopicName && STR.sameText(elmSubtopicName, subtopicName);
        });
        return found;
      },

      renderAddSubtopicBtn: function(subtopicsUl) {
        const li = document.createElement('li');
        li.classList.add('subtopicBtn');
        li.classList.add('addSubtopicBtn');

        const a = document.createElement('a');
        a.href = '#';
        a.classList.add('subtopicLnk');
        const iconElm = document.createElement('i');
        iconElm.classList.add('bi-plus-circle');
        a.appendChild(iconElm);
        // extra space looks better
        const topicSpan = document.createElement('span');
        topicSpan.textContent = ` ${TAGGING.CONSTANTS.REQUEST_SUBTOPIC}`;
        a.appendChild(topicSpan);
        a.onclick = RENDER.POST.TAGGING.clickAddSubtopicBtn;
        li.appendChild(a);
        subtopicsUl.appendChild(li);
      },

      getExistingSubtopicLi: function(subtopicsUl, subtopicName) {
        return Array.from(subtopicsUl.querySelectorAll('li.subtopicBtn')).find(function(li) {
          let elmSubtopicName = RENDER.POST.TAGGING.getElmSubtopicName(li);
          return elmSubtopicName && STR.sameText(elmSubtopicName, subtopicName);
        });
      },

      renderSubtopic(subtopicsUl, subtopicName, isSelected) {
        let li = RENDER.POST.TAGGING.getExistingSubtopicLi(subtopicsUl, subtopicName);

        if (!li) {
          li = document.createElement('li');
          li.classList.add('subtopicBtn');
          li.classList.add('position-relative');
  
          const nukeBtn = RENDER.makeNukeTagBtn(['btnDeprecateSubtopic'], RENDER.POST.TAGGING.clickDeprecateSubtopicBtn);
          li.appendChild(nukeBtn);
      
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = subtopicName;
          a.classList.add('subtopicLnk');
          a.onclick = RENDER.POST.TAGGING.clickSubtopicAnchor;
          li.appendChild(a);
          subtopicsUl.appendChild(li);
        }

        if (isSelected == true) {
          Array.from(subtopicsUl.querySelectorAll('.active')).forEach(function(elm) {
            // only one active at a time
            elm.classList.remove('active');
          });
          li.classList.add('active');
        }
      },

      renderTopicAnchor: function(topicDiv, topic, specialOnClick, iconCls, isSelectedTopic, currentSubtopic) {
        const topicA = document.createElement('a');
        topicA.classList.add('topicPickBtn');
        const subtopicsUl = document.createElement('ul');
        subtopicsUl.classList.add('subtopicsUl');
        topicA.href = '#';
        let text = topic.Name || topic;
        if (STR.hasLen(iconCls)) {
          const iconElm = document.createElement('i');
          iconElm.classList.add(iconCls);
          topicA.appendChild(iconElm);
          // extra space looks better
          text = ` ${text}`;
        }
        const topicSpan = document.createElement('span');
        topicSpan.textContent = text;
        topicA.appendChild(topicSpan);
        topicA.onclick = specialOnClick || RENDER.POST.TAGGING.clickRegularTopicAnchor;
        // this method can also be used for simple text, so check for Subtopics
        if (topic.Subtopics) {
          for (let i = 0; i < topic.Subtopics.length; i++) {
            let subtopic = topic.Subtopics[i];
            
            let isSelectedSubtopic = isSelectedTopic == true && currentSubtopic && 
              STR.sameText(currentSubtopic.Name, subtopic.Name);
            
            RENDER.POST.TAGGING.renderSubtopic(subtopicsUl, subtopic.Name, isSelectedSubtopic);
          }
          RENDER.POST.TAGGING.renderAddSubtopicBtn(subtopicsUl);
        }
        topicDiv.appendChild(topicA);
        topicDiv.appendChild(subtopicsUl);
      },

      // { topic: topicObject, subtopic: string }
      getCurrentTopicTuple: function(postScoredTaggerElm, topics) {
        const currentTagValue = postScoredTaggerElm.getAttribute('data-testid');
        if (!STR.hasLen(currentTagValue)) { return null; }
        const parts = currentTagValue.split(TOPICS.TOPIC_SUBTOPIC_COLON);
        if (parts.length != 2) { return null; }
        const currentTopicName = parts[0];
        const topic = topics.find(function(t) {
          return STR.sameText(t.Name, currentTopicName);
        });

        if (topic == null) { return null; }
        const subtopic = topic.Subtopics.find(function(s) {
          return STR.sameText(s.Name, parts[1]);
        })

        return {
          topic: topic,
          subtopic: subtopic
        }
      },

      getExistingTopicLi: function(topicsUl, topicName) {
        return Array.from(topicsUl.querySelectorAll('li.topicListItem')).find(function(li) {
          let elmTopicName = RENDER.POST.TAGGING.getElmTopicName(li);
          return elmTopicName && STR.sameText(elmTopicName, topicName);
        });
      },

      renderTopicChoice: function(topicsUl, topic, currentTopic, currentSubtopic, specialOnClick, insertBeforeElm, iconCls) {
        let topicLi = RENDER.POST.TAGGING.getExistingTopicLi(topicsUl, topic.Name);
        const isSelectedTopic = currentTopic && STR.sameText(currentTopic.Name, topic.Name);        
        
        if (!topicLi) { 
        
          topicLi = document.createElement('li');
          topicLi.classList.add('topicListItem');
          topicLi.setAttribute('data-testid', topic.Name);
          topicLi.classList.add('position-relative');

          // the removal btn
          const nukeA = RENDER.makeNukeTagBtn(['btnDeprecateTopic'], RENDER.POST.TAGGING.clickDeprecateTopicBtn);
          topicLi.appendChild(nukeA);

          topicLi.classList.add('topicListItem');
          topicLi.classList.add('list-inline-item');

          const topicDiv = document.createElement('div');
          topicDiv.classList.add('topicChoice');
          RENDER.POST.TAGGING.renderTopicAnchor(topicDiv, topic, specialOnClick, iconCls, isSelectedTopic, currentSubtopic);
          topicLi.appendChild(topicDiv);
          if (insertBeforeElm) {
            topicsUl.insertBefore(topicLi, insertBeforeElm);
          }
          else {
            topicsUl.appendChild(topicLi);
          }
        }
        else {
          for (let i = 0; i < topic.Subtopics.length; i++) {
            let subtopic = topic.Subtopics[i];
            let subtopicsUl = topicLi.querySelector('.subtopicsUl');
            
            let isSelectedSubtopic = isSelectedTopic == true && currentSubtopic && 
              STR.sameText(currentSubtopic.Name, subtopic.Name);
  
            RENDER.POST.TAGGING.renderSubtopic(subtopicsUl, subtopic.Name, isSelectedSubtopic);
          }
        }

        if (isSelectedTopic == true) {
          Array.from(topicsUl.querySelectorAll('.active')).forEach(function(elm) {
            // only one subtopic active at a time
            elm.classList.remove('active');
          });
          topicLi.classList.add('active');
        }

        return topicLi;
      },

      renderTopicChoices: function(postScoredTaggerElm) {
        let topicsUl = postScoredTaggerElm.querySelector('.topicsPicker');
        if (topicsUl) { return; }
        const topics = SETTINGS.TOPICS.getLocalCacheTopics();
        const currentTopicTuple = RENDER.POST.TAGGING.getCurrentTopicTuple(postScoredTaggerElm, topics);
        const currentTopic = (currentTopicTuple) ? currentTopicTuple.topic : null;
        const currentSubtopic = (currentTopicTuple) ? currentTopicTuple.subtopic : null;
        topicsUl = document.createElement('ul');
        topicsUl.classList.add('topicsPicker');
        topicsUl.classList.add('list-inline');
        let clearSelectionElm = RENDER.POST.TAGGING.renderTopicChoice(topicsUl, TAGGING.CONSTANTS.UNTAG_THIS_POST, null, null, RENDER.POST.TAGGING.clickClearSelection, undefined, 'bi-eraser');
        clearSelectionElm.classList.add('clearTopicBtn');
        for (let t = 0; t < topics.length; t++) {
          let topic = topics[t];
          if (!TOPICS.isDeprecatedTopic(topic)) {
            RENDER.POST.TAGGING.renderTopicChoice(topicsUl, topic, currentTopic, currentSubtopic);
          }
        }
        let addAnotherElm = RENDER.POST.TAGGING.renderTopicChoice(topicsUl, TAGGING.CONSTANTS.REQUEST_TOPIC, null, null, RENDER.POST.TAGGING.clickRequestNewTopic, undefined, 'bi-plus-circle');
        addAnotherElm.classList.add('createTopicBtn');
        postScoredTaggerElm.appendChild(topicsUl);
      },

      configureTagAndRate: function(postScoredTaggerElm) {
        // textbox event
        const txtElm = postScoredTaggerElm.querySelector('input[type="text"]');
        txtElm.addEventListener('click', (event) => {
          txtElm.disabled = true;
          const container = ES6.findUpClass(txtElm, 'postScoredTaggers');
          container.classList.add('pickingTag');
          postScoredTaggerElm.classList.add('pickingTag');
          RENDER.POST.TAGGING.renderTopicChoices(postScoredTaggerElm);
        });

        // star events
        const starAnchors = Array.from(postScoredTaggerElm.querySelectorAll('.postTagStars a'));
        for (let i = 0; i < starAnchors.length; i++) {
          let starAnchor = starAnchors[i];
          starAnchor.onclick = function(event) {
            let concatSubtopic = RENDER.POST.TAGGING.getConcatSubtopic(postScoredTaggerElm);
            TAGGING.POSTS.setRating(postScoredTaggerElm, i + 1, concatSubtopic);
            return false;
          }
        }
      },

      getConcatSubtopic: function(postScoredTaggerElm) {
        return postScoredTaggerElm.getAttribute('data-testid');
      },

      initTopicTags: function() {
        if (_ranTopicInit == true || _topicTags.length > 0) { return; }  // already initialized
        
        const topics = SETTINGS.TOPICS.getLocalCacheTopics();
        if (!topics || topics.length == 0) { 
          _ranTopicInit = true;
          return ''; 
        }

        var tags = [];
        for (let t = 0; t < topics.length; t++) {
          let topic = topics[t];
          if (!TOPICS.isDeprecatedTopic(topic)) {
            for (let s = 0; s < topic.Subtopics.length; s++) {
              let subtopic = topic.Subtopics[s];
              if (!TOPICS.isDeprecatedSubtopic(subtopic)) {
                let concat = TOPICS.concatTopicFullName(topic.Name, subtopic.Name);
                tags.push(concat);
              }
            }
          }
        }

        _topicTags = tags.sort();
        _ranTopicInit = true;
      },
      
      renderTagControl: function(topicRating) {
        let postSubtopicValue = '';
        let postQuintile;

        if (topicRating) {
          postSubtopicValue = topicRating[TOPIC_RATING_SEL.Subtopic];
          postQuintile = parseInt(topicRating[TOPIC_RATING_SEL.Rating]);
        }

        const clsQuintile = postQuintile && postQuintile > 0 ? `quintile-${postQuintile} ` : '';
        let clsNoneSel = STR.hasLen(postSubtopicValue) ? '' : 'noneSelected ';

        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
          starsHtml = STR.appendLine(starsHtml, `<a href='#' class='star-${i + 1}'><i class='bi-star'></i><i class='bi-star-fill'></i></a>`);
        }

        const textDisplay = postSubtopicValue || TAGGING.CONSTANTS.TAG_RATE;
        // in case existing value needs overflow room, make that the tiptext
        const tipText = STR.hasLen(postSubtopicValue) ? postSubtopicValue : 'Exceptional posts are worth tagging. After assigning its topic, you can rate it.';

        const html = `
        <span class='${clsNoneSel}${clsQuintile}postScoredTagger' data-testid='${postSubtopicValue}'>
          <input class='postTagText' type='text' value='${textDisplay}' data-toggle='tooltip' title='${tipText}'>
          <span class='postTagStars' data-toggle='tooltip' title='Rate the quality of this post.'>
            ${starsHtml}
          </span>
        </span>
        `;

        return DOMPurify.sanitize(html);
      },

      renderTagControls: function(post) {
        const topicRatings = post[POST_SEL.TopicRatings];
        const hasTag = topicRatings && topicRatings.length > 0;
        
        let containerCls = "postScoredTaggers";
        if (hasTag) {
          containerCls = STR.appendSpaced(containerCls, "hasTag");
        }

        let html = `<span class="${containerCls}">`;

        const cancelBtnHtml = `
        <a class='postTagCancel' href='#'>
          <i class='bi-x-circle'></i> Cancel edits
        </a>
        `;

        html = STR.appendLine(html, cancelBtnHtml);

        if (!hasTag) {
          html = STR.appendLine(html, RENDER.POST.TAGGING.renderTagControl());
        }
        else {
          for (let i = 0; i < topicRatings.length; i++) {
            let topicRating = topicRatings[i];
            html = STR.appendLine(html, RENDER.POST.TAGGING.renderTagControl(topicRating));
          }
        }

        html = STR.appendLine(html, '<a class="postAnotherTag ps-2" href="#"><i class="bi-plus-circle-dotted" data-toggle="tooltip" title="Add another tag"></i></a>');
        
        html = STR.appendLine(html, '</span>');
        return html;
      }
    },
    
    renderRepostedBy: function(post, site) {
      
      if (!STR.hasLen(post.ReposterHandle)) {
        return '';
      }
      
      let handle = DOMPurify.sanitize(post.ReposterHandle);
      handle = STR.ensurePrefix(handle, '@');
      let displayName = DOMPurify.sanitize(post.ReposterName || handle);
      displayName = RENDER.prepareDisplayText(displayName, false);
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());

      return `
      <span class='repostedBy'>
        <span><i class='bi-repeat'></i> Reposted by </span>
        <a href='${profileUrl}' target='_blank'>
          <span class='repostedByName'>${displayName}</span>
          <span class='basicSep'> / </span>
          <span class='repostedByHandle'>${handle}</span>
        </a>
      </span>
      `;
    },

    renderStats: function(post) {
      let replyCount = post[POST_SEL.ReplyCount];
      let likeCount = post[POST_SEL.LikeCount];
      let reshareCount = post[POST_SEL.ReshareCount];

      let clsOtherReply = ' ';
      let clsOtherLike = ' ';
      let clsOtherReshare = ' ';

      if (!replyCount) {
        replyCount = '';
        clsOtherReply = ' lightfont';
      }
      if (!likeCount) {
        likeCount = '';
        clsOtherLike = ' lightfont';
      }
      if (!reshareCount) {
        reshareCount = '';
        clsOtherReshare = ' lightfont';
      }

      let html = `
      <span class='postStats text-secondary' data-toggle='tooltip' title='Number of replies, likes, and re-posts as of the time recorded'>
        <span class='replyCount${clsOtherReply}'><i class='bi-chat-left'></i> ${replyCount}</span>
        <span class='basicSep'> | </span>
        <span class='likeCount${clsOtherLike}'><i class='bi-heart'></i> ${likeCount}</span>
        <span class='basicSep'> | </span>
        <span class='reshareCount${clsOtherReshare}'><i class='bi-repeat'></i> ${reshareCount}</span>
      </span>
      `;

      return DOMPurify.sanitize(html);
    },

    renderPostTime: function(post) {
      const dt = new Date(post.PostTime);
      if (isNaN(dt)) { return ''; }
      
      return `
      <span class='postTime'>
        <a href='${STR.expandTweetUrl(post.PostUrlKey)}' target='_blank'>${dt.toLocaleString()}</a>
      </span>
      `;
    },

    // reply and main-tweet
    renderLinkedTimestamp: function(post, site) {
      
      switch (site) {
        case SITE.TWITTER:
          // that's what we know how to render...
          break;
        default:
          return '';
      }
      
      return `
      <span class='basicSep'> | </span>
      ${RENDER.POST.renderPostTime(post)}
      <a href='${STR.expandTweetUrl(post.PostUrlKey)}' target='_blank'><i class='bi-twitter'></i></a>
      <a href='${STR.expandTweetUrl(post.PostUrlKey, 'nitter.net')}' target='_blank' data-toggle='tooltip' title='Review on nitter.net'>N</a>
      <a href='${STR.expandTweetUrl(post.PostUrlKey, 'nitter.cz')}' target='_blank' title='Review on nitter.cz'>N</a>
      `;
    },

    renderReplyTo: function(post, site) {
      if (!post.ReplyToTweet) { return ''; }

      const authorElm = RENDER.POST.renderAuthorName(post.ReplyToTweet.AuthorHandle, post.ReplyToTweet.AuthorName, site, 'replyToAuthorName', 'replyToAuthorHandle', 'replyToAuthorAnchor');

      let postText = STR.ellipsed(post.ReplyToTweet.PostText, 300);
      postText = DOMPurify.sanitize(postText);

      const linkedTime = RENDER.POST.renderLinkedTimestamp(post.ReplyToTweet, site);

      return `
      <div class='replyToPost small'>
        <div class='replyToAuthor'>
          <span>Replying to </span>
          ${authorElm}
          ${linkedTime}
        </div>
        <div class='replyToContent'>
          ${postText}
        </div>
      </div>
      `;
    },

    renderPostImage: function(imgCdnUrl, img64Url) {
      if (!img64Url) { return ''; }
      imgCdnUrl = DOMPurify.sanitize(imgCdnUrl);
      img64Url = DOMPurify.sanitize(img64Url);

      let imgSrc = '';
      if (img64Url) {
        imgSrc = IMAGE.writeBase64Src(imgCdnUrl, img64Url);
      }

      return `
      <div class='postContentImg'>
        <div class='videoHeader'>
          <a href='#' class='fw-bold'><i class='bi-play-btn'></i> <i class='bi-info-circle-fill'></i> <span>VIDEO</span></a>
        </div>
        <div class='mediaContainer'><img alt='src-img' src='${imgSrc}' style='max-width:800px;max-height:400px;'/></div>
      </div>`;
    },

    renderPostContent: function(post) {
      
      const postText = RENDER.prepareDisplayText(post.PostText, true, 'urlOnly');

      let cardElm = '';
      if (STR.hasLen(post.CardText) || STR.hasLen(post.CardImg64Url)) {
        const cardText = STR.hasLen(post.CardText) ? RENDER.prepareDisplayText(post.CardText, true, 'urlOnly') : '';
        const cardUrl = post.CardFullUrl || post.CardShortUrl || STR.expandTweetUrl(post.PostUrlKey);
        const imgUrl = RENDER.POST.renderPostImage(post.CardImgCdnUrl, post.CardImg64Url);

        cardElm = `
        <a class='postCard' href='${cardUrl}' target='_blank'>
          <span class='postCardText'>${cardText}</span>
          ${imgUrl}
        </a>
        `;
      }

      let regImgsHtml = '';
      if (post.Images) {
        for (let i = 0; i < post.Images.length; i++) {
          let regImg = post.Images[i];

          regImgsHtml = `
          ${regImgsHtml}
          ${RENDER.POST.renderPostImage(null, regImg.RegImg64Url)}
          `;
        }
      }

      const concatEmbVideoCls = STR.isTruthy(post[POST_SEL.EmbedsVideo]) ? ' embedsVideo' : '';

      return `
      <div class='postContent${concatEmbVideoCls}'>
        <div class='postDirectText'>${DOMPurify.sanitize(postText)}</div>
        ${cardElm}
        ${regImgsHtml}
      </div>
      `;
    },
    
    renderPostAuthorImg: function(post, site, authorTip) {
      let handle = DOMPurify.sanitize(post.AuthorHandle);
      handle = STR.ensurePrefix(handle, '@');

      let imgCdnUrl = DOMPurify.sanitize(post.AuthorImgCdnUrl);
      let img64Url = DOMPurify.sanitize(post.AuthorImg64Url);
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());

      let imgSrc = '/images/noprofilepic.png';
      if (img64Url) {
        imgSrc = IMAGE.writeBase64Src(imgCdnUrl, img64Url);
      }

      return `
      <a class='postAuthorLink' href='${profileUrl}' target='_blank'>
        <img class='postAuthorImg' alt='${handle}' src='${imgSrc}' ${authorTip}>
      </a>`;
    },

    renderAuthorName: function(handle, displayName, site, clsAuthorName, clsAuthorHandle, clsAnchor) {
      handle = DOMPurify.sanitize(handle);
      handle = STR.ensurePrefix(handle, '@');
      displayName = DOMPurify.sanitize(displayName || handle);
      displayName = RENDER.prepareDisplayText(displayName, false);
      
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());

      return `
      <a href='${profileUrl}' target='_blank' class='${clsAnchor}'>
        <span class='${clsAuthorName}'>${displayName}</span>
        <span class='basicSep'> / </span>
        <span class='${clsAuthorHandle}'>${handle}</span>
      </a>
      `;
    },

    getPostBodyByUrlKey: function(urlKey) {
      if (!STR.hasLen(urlKey)) { return null; }
      return document.querySelector(`.postBody[data-testid="${urlKey}"]`);
    },

    getPostUrlKey: function(elm) {
      const postBodyElm = ES6.findUpClass(elm, 'postBody', true);
      return postBodyElm.getAttribute('data-testid');
    },

    renderViewThreadBtn: function(post) {
      if (!post[POST_SEL.ConvoCount]) { return ''; }
      if (!STR.hasLen(post[POST_SEL.ThreadUrlKey])) { return ''; }
      const convoCount = parseInt(post[POST_SEL.ConvoCount]);
      if (isNaN(convoCount) || convoCount < 2) { return ''; }
      
      return `<div><a href='#' class='btnViewThread' data-testid='${post[POST_SEL.ThreadUrlKey]}'>${EMOJI.THREAD}${convoCount}</a></div>`;
    },

    renderPostBody: function(post, site) {
      const reposterElm = RENDER.POST.renderRepostedBy(post, site);
      const linkedTime = RENDER.POST.renderLinkedTimestamp(post, site);
      const replyToElm = RENDER.POST.renderReplyTo(post, site);
      const contentElm = RENDER.POST.renderPostContent(post);
      const statsElm = RENDER.POST.renderStats(post);
      const tagggingElm = RENDER.POST.TAGGING.renderTagControls(post);
      
      let bodyCls = 'container postBody';
      let isFavoriteAuthor = (post[POST_SEL.FavoritedAuthor] == 1);
      if (isFavoriteAuthor) {
        bodyCls = `${bodyCls} favoriteAuthor`;
      }
      let authorTip = '';
      if (post[POST_SEL.ImportantAuthor] == true) {
        bodyCls = `${bodyCls} importantAuthor`;
        authorTip = `data-toggle='tooltip' title='Author is in your tracked network'`;
      }
      else if (post[POST_SEL.Followers] && post[POST_SEL.Followers].length > 0) {
        const delimFbys = post[POST_SEL.Followers].join(', ');
        bodyCls = `${bodyCls} followedBy`;
        authorTip = `data-toggle='tooltip' title='Followed by ${delimFbys}'`;
      }

      return `
        <div class='${bodyCls}' data-testid='${post.PostUrlKey}'>
          <div>
            ${reposterElm}
            <div class='floatright text-end'>
              <div class='delpostDiv pb-2'>
                <a class='btnDelPost' href='#' data-toggle='tooltip' title='Delete'><i class='bi-trash'></i></a>
                <a class='btnDelPostCancel' href='#' data-toggle='tooltip' title='Cancel deletion'><i class='bi-arrow-counterclockwise'></i> Cancel</a>
                <a class='btnDelPostConfirm' href='#' data-toggle='tooltip' title='Confirm deletion'> | <i class='bi-trash-fill'></i> Confirm</a>
              </div>
              ${RENDER.POST.renderViewThreadBtn(post)}
            </div>
          </div>
          <div class='postHeadline row'>
            <div class='col-sm-auto' style='padding-right:0px;'>
              ${RENDER.POST.renderPostAuthorImg(post, site, authorTip)}
            </div>
            <div class='col'>
              <div class='row p-1'>
                <div>
                  ${RENDER.POST.renderAuthorName(post.AuthorHandle, post.AuthorName, site, 'postAuthorName', 'postAuthorHandle', 'postAuthorLink')}
                  ${linkedTime}
                </div>
              </div>
              <div class='row p-1'>
                <div>
                  ${statsElm}
                  <span class='basicSep'> | </span>
                  ${tagggingElm}
                </div>
              </div>
            </div>
          </div>
          <div class='row'>
            ${contentElm}
            ${replyToElm}
          </div>
        </div>
        `;
    },
    
    renderPost: function(post, site) {
      const body = RENDER.POST.renderPostBody(post, site);

      let qt = '';
      if (post.QuoteTweet) {
        qt = RENDER.POST.renderPostBody(post.QuoteTweet, site);
        qt = `
        <div class='quotedPost'>
        ${qt}
        </div>
        `;
      }

      return `
      <div class='socialPost row striped pt-1'>
        ${body}
        ${qt}
      </div>`;
    }
  },

  PERSON: {
    renderPerson: function(person, context, renderAnchorsRule, filtered) {
      let roleInfo = '';
      let imgSize = 92;
      let withDetail = true;
      let withAnchors = true;
      let avatarOnly = false;
      let linkImage = true;
      let imgClass = '';
    
      switch (context) {
        case RENDER_CONTEXT.PERSON.AUTHD_USER:
          imgSize = 46;
          withDetail = false;
          withAnchors = false;
          avatarOnly = true;
          imgClass = ` class='rounded-circle'`;
          linkImage = false;
          break;
        case RENDER_CONTEXT.PERSON.ACCOUNT_OWNER:
          imgSize = 46;
          roleInfo = ` role='button'`;  // clickable
          withDetail = false;
          withAnchors = false;
          linkImage = false;
          break;
        default:
          break;
      }
      
      // we select out from the DB the SCHEMA_CONSTANTS.COLUMNS.NamedGraph
      let site = person.Site || APPGRAPHS.getSiteFromGraph(person.NamedGraph) || SETTINGS.getCachedSite();
      let handle = DOMPurify.sanitize(person.Handle);
      let displayName = DOMPurify.sanitize(person.DisplayName);
      let detail = DOMPurify.sanitize(person.Detail);
      let imgCdnUrl = DOMPurify.sanitize(person.ImgCdnUrl);
      let img64Url = DOMPurify.sanitize(person.Img64Url);
  
      handle = STR.ensurePrefix(handle, '@');
      const profileUrl = STR.makeProfileUrl(handle, site, SETTINGS.getMdonServer());
      
      const imgStyling = `style='width:${imgSize}px;height:${imgSize}px;padding:2px;'`;
  
      let img = '';
      if (img64Url && img64Url.length > 50) {
        const imgSrc = IMAGE.writeBase64Src(imgCdnUrl, img64Url);
        img = `<img alt='${handle}' ${imgStyling}${imgClass} src='${imgSrc}'/>`;
      }
      // else if (imgCdnUrl && imgCdnUrl.length > 10 && !STR.looksLikeCdnRestrictedImg(imgCdnUrl)) {
      // COMMENTED OUT because images give ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep when rendered from external context
      // instead, we use deferred image load to base64 data per the "else"
      //  img = `<img ${imgStyling} src='${imgCdnUrl}'/>`;
      // }
      else {
        const data64Attr = (imgCdnUrl && IMAGE.shouldDeferLoadImages(site, imgCdnUrl)) ? IMAGE.writeDeferredLoadTag(imgCdnUrl) : '';
        img = `<img alt='${handle}' ${imgStyling}${imgClass} src='/images/noprofilepic.png' ${data64Attr}/>`;
      }
      
      if (linkImage) {
        const mdonLinkCls = site === SITE.MASTODON ? ` class='${CLS.MASTODON.ACCOUNT_LINK}'` : '';
        img = `<a href='${profileUrl}' target='_blank'${mdonLinkCls}>${img}</a>`;
      }
  
      const sansAt = STR.stripPrefix(handle, '@');
      const preparedDisplayName = RENDER.prepareDisplayText(displayName, withAnchors, renderAnchorsRule);
      let preparedDetail = RENDER.prepareDisplayText(detail, withAnchors, renderAnchorsRule);
    
      if (filtered === true) {
        preparedDetail = `<b>${preparedDetail}</b>`;
      }
    
      detail = (withDetail === true && detail) ? `<div class='personDetail'>${preparedDetail}</div>` : ``;
      
      let renderedHandle = handle;
    
      // note: if we're focused on e.g. mdon, don't distract with link to twitter
      if (withAnchors && !filtered) {
        renderedHandle = `<a href='${profileUrl}' target='_blank'>${handle}</a>`;
      }
      
      let starCls = RENDER.CLS.STAR_OFF_CLS;
      if (person.InList == 1 && person.ListName === LIST_FAVORITES) {
        starCls = RENDER.CLS.STAR_ON_CLS;
      }
      
      let followInfo = '';
      if (person.FollowingCount && person.FollowingCount > 0 && person.FollowersCount && person.FollowersCount > 0) {
        followInfo = `<span class='small text-secondary ps-2'>(following: ${person.FollowingCount} | followers: ${person.FollowersCount})</span>`;
      }
  
      if (avatarOnly) {
  
        const avatarTip = `Connected as ${handle} (${displayName})`;
        return `<span data-toggle='tooltip' title='${avatarTip}'>${img}</span>`;
      }
      else {
  
        let followOneCls = '';
        let followOneInitialText = '';
        let followOneStyle = 'float:right;';
  
        if (person.ImFollowingOnMdon == true) {
          followOneCls = `text-success ${CLS.MASTODON.FOLLOW_ONE_CONTAINER} ${CLS.MASTODON.FOLLOWING_ALREADY}`;
          // ready to render (no additional information required for the follow-on renderFollowOnMastodonButtons step that's based on a placeholder approach)
          followOneStyle = `${followOneStyle}display:block;`;
          followOneInitialText = 'Following';
        }
        else {
          followOneCls = `${CLS.MASTODON.FOLLOW_ONE_CONTAINER} ${CLS.MASTODON.FOLLOW_ONE_PLACEHOLDER}`;
          followOneStyle = `${followOneStyle}display:none;`;
        }
  
        return `<div class='person row striped pt-1' ${roleInfo}>
        <div class='col-sm-auto'><a href='#' class='canstar' data-testid='${sansAt}'><i class='${starCls}'></i></a></div>
        <div class='col-sm-auto personImg'>${img}</div>
        <div class='col personLabel'>
          <div>
            <span class='personHandle'>${renderedHandle}</span>${followInfo}
            <div class='${followOneCls}' style='${followOneStyle}'><i class='bi-mastodon'></i> <span class='${CLS.MASTODON.FOLLOW_ONE_SPAN}'>${followOneInitialText}</span></div>
          </div>
          <div class='personDisplay'>${preparedDisplayName ?? ''}</div>
          ${detail}
        </div>
      </div>`;
  
      }
    },
  
    renderEmailAnchors: function(text) {
      if (!text) { return text; }
      
      return text.replace(REGEX_EMAIL, function(match) {
        let email = match.trim().replace(' at ', '@').replace('(at)', '@').replace(' dot ', '.').replace('(dot)', '.');
        return `<a href='mailto:${email}' target='_blank'>${match}</a>`;
      });
    }
  },

  MASTODON: {
    renderMastodonAnchor: function(display, handle, domain) {
      const maxLen = 30;
      display = STR.stripHttpWwwPrefix(display);
      if (display.length > maxLen) {
        display = display.substring(0, maxLen) + '...';
      }
      
      let homeServer = SETTINGS.getMdonServer();
      if (!STR.MASTODON.couldBeServer(homeServer)) {
        homeServer = '';
      }
      
      let url;
      if (homeServer && homeServer.length > 0 && homeServer.toLowerCase() != domain.toLowerCase()) {
        // give an url that's clickable directly into a follow (can only follow from one's own home server)
        url = `https://${homeServer}/@${handle}@${domain}`;    
      }
      else {
        url = `https://${domain}/@${handle}`;
      }
      
      return `<a href='${url}' target='_blank' class='${CLS.MASTODON.ACCOUNT_LINK}'>${display}</a>`;
    },
  
    // regex101.com/r/ac4fG5/1
    // @scafaria@toad.social
    renderMastodon1Anchors: function(text) {
      if (!text) { return text; }
      
      return text.replace(REGEX_MDON1, function(match, handle, domain) {
        if (STR.MASTODON.isImposterServer(domain)) {
          // the regex isn't perfect; also needs to rule out imposter servers
          return match;
        }
        else {
          return RENDER.MASTODON.renderMastodonAnchor(match, handle, domain);
        }
      });
    },
  
    // toad.social/@scafaria or https://toad.social/@scafaria
    renderMastodon2Anchors: function(text) {
      if (!text) { return text; }
      
      return text.replace(REGEX_MDON2, function(match, http, www, domain, handle) {
        if (STR.MASTODON.isImposterServer(domain)) {
          // the regex isn't perfect; also needs to rule out imposter servers
          return match;
        }
        else {
          return RENDER.MASTODON.renderMastodonAnchor(match, handle, domain);
        }
      });
    },
  
    // scafaria@toad.social
    // note the missed starting @ -- and instead of trying to keep up with all the server instances
    // we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
    renderMastodon3Anchors: function(text) {
      if (!text) { return text; }
      
      return text.replace(REGEX_MDON3, function(match, handle, domain) {
        if (STR.MASTODON.isImposterServer(domain)) {
          // the regex isn't perfect; also needs to rule out imposter servers
          return match;
        }
        else {
          return RENDER.MASTODON.renderMastodonAnchor(match, handle, domain);
        }
      });
    }
  },

  // simple regex, but requires cleanup afterward for ending punctuation and ignore if it's a mastodon url
  renderUrlAnchors: function(text) {
    if (!text) { return text; }
    
    return text.replace(REGEX_URL, function(url) {
      if (STR.MASTODON.looksLikeAccountUrl(url) === true) { return url; }
      let display = STR.stripHttpWwwPrefix(url);
      url = STR.stripSuffixes(url, ['.',')','!']); // in case it attached punctuation, e.g. a sentence ending with an url
      const maxLen = 30;
      if (display.length > maxLen) {
        display = display.substring(0, maxLen) + '...';
      }
      return `<a href='${url}' target='_blank'>${display}</a>`;
    });
  }
};