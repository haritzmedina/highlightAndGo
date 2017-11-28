const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
const Events = require('./Events')

class Tag {
  constructor (config) {
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    this.color = config.options.color || ColorUtils.getHashColor(this.name)
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
    if (this.color) {
      $(tagButton).css('background-color', this.color)
    }
    // Set handler for button
    tagButton.addEventListener('click', (event) => {
      if (event.target.role === 'annotation') {
        LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: this.tags})
      }
    })
    return tagButton
  }
}

class TagGroup {
  constructor (config, tags) {
    this.name = config.name
    this.tags = tags || []
  }

  createPanel () {
    if (this.tags.length > 0) {
      let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
      let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = this.name
      groupNameSpan.title = this.name
      for (let j = 0; j < this.tags.length; j++) {
        tagGroup.append(this.tags[j].createButton())
      }
      return tagGroup
    } else {
      console.debug('No tags for %s group', this.name)
      return null
    }
  }
}

class TagManager {
  constructor (namespace, config) {
    this.namespace = namespace
    this.config = config
    this.tagAnnotations = []
    this.currentTags = []
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

  getTagsList () {
    if (this.currentTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
        return this.currentTags
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        let tags = []
        for (let i = 0; i < this.currentTags.length; i++) {
          tags = tags.concat(this.currentTags[i].tags)
        }
        return tags
      }
    } else {
      return [] // No tags for current group
    }
  }

  retrieveTagByAnnotation (annotation) {
    if (annotation.tags.length > 0) {
      if (this.currentTags.length > 0) {
        if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
          for (let i = 0; i < annotation.tags.length; i++) {
            let tag = _.find(this.currentTags, {name: annotation.tags[i]})
            if (tag) {
              return tag
            }
          }
        } else {
          for (let i = 0; i < annotation.tags.length; i++) {
            for (let j = 0; j < this.currentTags.length; j++) {
              let tag = _.find(this.currentTags[j].tags, {name: annotation.tags[i]})
              if (tag) {
                return tag
              }
            }
          }
        }
      }
    }
  }

  static retrieveTagForAnnotation (annotation, tagList) {
    for (let i = 0; i < tagList.length; i++) {
      let difference = _.differenceWith(
        tagList[i].tags,
        annotation.tags,
        (tag1, tag2) => {
          return tag1.toLowerCase() === tag2.toLowerCase()
        })
      if (difference.length === 0) {
        return tagList[i]
      }
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
        this.currentTags = this.createTagsBasedOnAnnotationsGrouped(annotations, this.config.grouped)
      } else {
        // Create tags based on annotations
        this.currentTags = this.createTagsBasedOnAnnotations(this.tagAnnotations)
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
      let groupTag = this.retrieveTagNameByPrefix(this.tagAnnotations[i].tags, (this.namespace + ':' + this.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag})
      }
    }
    for (let i = 0; i < this.tagAnnotations.length; i++) {
      let tagName = this.retrieveTagNameByPrefix(this.tagAnnotations[i].tags, (this.namespace + ':' + this.config.grouped.subgroup))
      let groupBelongedTo = this.retrieveTagNameByPrefix(this.tagAnnotations[i].tags, (this.namespace + ':' + this.config.grouped.relation))
      if (tagName && groupBelongedTo) {
        if (_.isArray(tagGroupsAnnotations[groupBelongedTo].tags)) {
          tagGroupsAnnotations[groupBelongedTo].tags.push(new Tag({
            name: tagName,
            namespace: this.namespace,
            options: {},
            tags: [
              this.namespace + ':' + this.config.grouped.relation + ':' + groupBelongedTo,
              this.namespace + ':' + this.config.grouped.subgroup + ':' + tagName]
          }))
        }
      }
    }
    // Hash to array
    return _.values(tagGroupsAnnotations)
  }

  destroy () {
    // Remove tags wrapper
    $('#tagsWrapper').remove()
  }

  retrieveTagNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        let tagName = _.replace(annotationTags[i], prefix + ':', '')
        return tagName
      }
    }
    return null
  }

  createTagButtons (callback) {
    // If it is an array is not grouped
    if (this.currentTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
        for (let i = 0; i < this.currentTags.length; i++) {
          // Append each element
          let tagButton = this.currentTags[i].createButton()
          this.tagsContainer.append(tagButton)
        }
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        for (let i = 0; i < this.currentTags.length; i++) {
          let tagGroupElement = this.currentTags[i].createPanel()
          if (tagGroupElement) {
            this.tagsContainer.append(tagGroupElement)
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = TagManager
