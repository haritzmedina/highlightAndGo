const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const LanguageUtils = require('../utils/LanguageUtils')

class Tag {
  constructor (config) {
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    this.options = config.options
  }

  createButton () {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    let tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    tagButton.innerText = this.name
    tagButton.title = this.name
    for (let key in this.options) {
      tagButton.dataset[key] = this.options[key]
    }
    tagButton.dataset.tags = this.tags
    tagButton.role = 'annotation'
    // Set handler for button
    tagButton.addEventListener('click', (event) => {
      if (event.target.role === 'annotation') {
        LanguageUtils.dispatchCustomEvent('annotate', {tags: this.tags})
      }
    })
    return tagButton
  }
}

class TagGroup {
  constructor (config, tags) {
    this.name = config.name
    this.tags = tags
  }

  createPanel () {
    let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
    let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
    let groupNameSpan = tagGroup.querySelector('.groupName')
    groupNameSpan.innerText = this.name
    for (let j = 0; j < this.tags.length; j++) {
      tagGroup.append(this.tags[j].createButton())
    }
    return tagGroup
  }
}

class TagManager {
  constructor (namespace, config) {
    this.namespace = namespace
    this.config = config
    this.tagAnnotations = []
    this.tags = []
  }

  init (callback) {
    this.initTagsStructure(() => {
      this.initReloadHandlers(() => {
        this.initTags(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  initTagsStructure (callback) {
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = document.querySelector('#tags')
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initReloadHandlers (callback) {
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initTags (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({url: window.abwa.groupSelector.currentGroup.url}, (annotations) => {
      // Retrieve tags of the namespace
      this.tagAnnotations = _.filter(annotations, (annotation) => {
        return this.hasANamespace(annotation, this.namespace)
      })
      // Retrieve tag annotations
      // If annotations are grouped
      if (!_.isEmpty(this.config.grouped)) {
        this.tags = this.createTagsBasedOnAnnotationsGrouped(annotations, this.config.grouped)
      } else {
        // Create tags based on annotations
        this.tags = this.createTagsBasedOnAnnotations(this.tagAnnotations)
      }
      this.createTagButtons()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  hasANamespace (annotation, namespace) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), (namespace + ':').toLowerCase())
    }) !== -1
  }

  createTagsBasedOnAnnotations () {
    let tags = []
    for (let i = 0; i < this.tagAnnotations.length; i++) {
      let tagAnnotation = this.tagAnnotations[i]
      let tagName = tagAnnotation.tags[0].substr(this.namespace.length + 1) // <namespace>:
      tags.push(new Tag({name: tagName, namespace: this.namespace, options: jsYaml.load(tagAnnotation.text)}))
    }
    return tags
  }

  createTagsBasedOnAnnotationsGrouped () {
    let tagGroupsAnnotations = {}
    for (let i = 0; i < this.tagAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.tagAnnotations[i], (this.namespace + this.config.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = {annotation: this.tagAnnotations[i], tags: []}
      }
    }
    for(let i = 0; i < this.tagAnnotations.length; i++) {
      let tagName = this.retrieveTagNameByPrefix(this.tagAnnotations[i], (this.namespace + this.config.subgroup))
      let groupBelongedTo = this.retrieveTagNameByPrefix(this.tagAnnotations[i], (this.namespace + this.config.relation))
      if (tagName && groupBelongedTo) {
        tagGroupsAnnotations[groupBelongedTo].tags = tagName
      }
    }
    debugger
    // TODO
    return [new TagGroup({name: 'dim1'}, [
      new Tag({name: 'cat1.1', namespace: this.namespace, options: {}}),
      new Tag({name: 'cat1.2', namespace: this.namespace, options: {}}),
      new Tag({name: 'cat1.3', namespace: this.namespace, options: {}})
    ]), new TagGroup({name: 'dim2'}, [
      new Tag({name: 'cat2.1', namespace: this.namespace, options: {}}),
      new Tag({name: 'cat2.2', namespace: this.namespace, options: {}})
    ])]
  }

  destroy () {
    // Remove tags wrapper
    $('#tagsWrapper').remove()
  }

  retrieveTagNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        annotationTags[i].replace()
        return tagName
      }
    }
    return null
  }

  createTagButtons (callback) {
    // If it is an array is not grouped
    if (this.tags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.tags[0], Tag)) {
        for (let i = 0; i < this.tags.length; i++) {
          // Append each element
          let tagButton = this.tags[i].createButton()
          this.tagsContainer.append(tagButton)
        }
      } else if (LanguageUtils.isInstanceOf(this.tags[0], TagGroup)) {
        for (let i = 0; i < this.tags.length; i++) {
          let tagGroupElement = this.tags[i].createPanel()
          this.tagsContainer.append(tagGroupElement)
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = TagManager
