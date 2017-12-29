const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ModeManager = require('./ModeManager')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
const Events = require('./Events')

class Tag {
  constructor (config) {
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    if (config.options && config.options.color) {
      if (!ColorUtils.hasAlpha(config.options.color)) {
        this.color = ColorUtils.setAlphaToColor(config.options.color, 0.5) // Set a 0.5 alpha to all colors without alpha
      } else {
        this.color = config.options.color
      }
    } else {
      this.color = ColorUtils.getHashColor(this.name)
    }
    this.options = config.options
  }

  createButton () {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    this.tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    this.tagButton.innerText = this.name
    this.tagButton.title = this.name
    for (let key in this.options) {
      this.tagButton.dataset[key] = this.options[key]
    }
    this.tagButton.dataset.tags = this.tags
    this.tagButton.setAttribute('role', 'annotation')
    if (this.color) {
      $(this.tagButton).css('background-color', this.color)
    }
    // Set handler for button
    this.tagButton.addEventListener('click', (event) => {
      if (event.target.getAttribute('role') === 'annotation') {
        LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: this.tags})
      } else if (event.target.getAttribute('role') === 'annotation') {
        window.abwa.contentAnnotator.goToFirstAnnotationOfTag({tags: this.tags})
      }
    })
    return this.tagButton
  }

  changeRol (newRole) {
    this.tagButton.setAttribute('role', newRole)
  }

  createIndexButton () {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    this.tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    this.tagButton.innerText = this.name
    this.tagButton.title = this.name
    for (let key in this.options) {
      this.tagButton.dataset[key] = this.options[key]
    }
    this.tagButton.dataset.tags = this.tags
    this.tagButton.setAttribute('role', 'annotation')
    if (this.color) {
      $(this.tagButton).css('background-color', this.color)
    }
    // Set handler for button
    this.tagButton.addEventListener('click', (event) => {
      if (event.target.getAttribute('role') === 'annotation') {
        LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: this.tags})
      } else if (event.target.getAttribute('role') === 'annotation') {
        window.abwa.contentAnnotator.goToFirstAnnotationOfTag({tags: this.tags})
      }
    })
    return this.tagButton
  }
}

class TagGroup {
  constructor (config, tags) {
    this.config = config
    this.tags = tags || []
  }

  createPanel () {
    if (this.tags.length > 0) {
      let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
      let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
      let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = this.config.name
      groupNameSpan.title = this.config.name
      for (let j = 0; j < this.tags.length; j++) {
        tagButtonContainer.append(this.tags[j].createButton())
      }
      return tagGroup
    }
  }

  createIndexPanel () {
    if (this.tags.length > 0) {
      let tagGroupTemplate = document.querySelector('#indexTagGroupTemplate')
      let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
      let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = this.config.name
      groupNameSpan.title = this.config.name
      for (let j = 0; j < this.tags.length; j++) {
        tagButtonContainer.append(this.tags[j].createIndexButton())
      }
      return tagGroup
    }
  }
}

class TagManager {
  constructor (namespace, config) {
    this.namespace = namespace
    this.config = config
    this.tagAnnotations = []
    this.currentTags = []
    this.currentIndexTags = []
    this.events = {}
  }

  init (callback) {
    this.initTagsStructure(() => {
      this.initEventHandlers(() => {
        this.initAllTags(() => {
          this.initIndexTags(() => {
            if (window.abwa.modeManager.mode === ModeManager.modes.highlight) {
              this.showAllTags()
            } else {
              this.showIndexTags()
            }
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  initTagsStructure (callback) {
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {annotate: document.querySelector('#tagsAnnotate'), index: document.querySelector('#tagsIndex')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
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

  initAllTags (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({url: window.abwa.groupSelector.currentGroup.url, order: 'desc'}, (annotations) => {
      // Retrieve tags of the namespace
      this.tagAnnotations = _.filter(annotations, (annotation) => {
        return this.hasANamespace(annotation, this.namespace)
      })
      // Remove slr:spreadsheet annotation ONLY for SLR case
      this.tagAnnotations = _.filter(this.tagAnnotations, (annotation) => {
        return !this.hasATag(annotation, 'slr:spreadsheet')
      })
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

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), tag.toLowerCase())
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
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.namespace, group: this.config.grouped.group})
      }
    }
    let groups = _.keys(tagGroupsAnnotations)
    let colors = {}
    for (let i = 0; i < groups.length; i++) {
      colors[groups[i]] = ColorUtils.getDifferentColor(_.values(colors), groups[i])
    }
    for (let i = 0; i < this.tagAnnotations.length; i++) {
      let tagAnnotation = this.tagAnnotations[i]
      let tagName = this.retrieveTagNameByPrefix(this.tagAnnotations[i].tags, (this.namespace + ':' + this.config.grouped.subgroup))
      let groupBelongedTo = this.retrieveTagNameByPrefix(this.tagAnnotations[i].tags, (this.namespace + ':' + this.config.grouped.relation))
      if (tagName && groupBelongedTo) {
        if (_.isArray(tagGroupsAnnotations[groupBelongedTo].tags)) {
          // Load options from annotation text body
          let options = jsYaml.load(tagAnnotation.text)
          // If color is not defined, define one per group
          if (_.isEmpty(options)) {
            options = {}
          }
          if (_.isEmpty(options.color)) {
            options.color = ColorUtils.setAlphaToColor(colors[groupBelongedTo], (0.2 + tagGroupsAnnotations[groupBelongedTo].tags.length * 0.1))
          }
          tagGroupsAnnotations[groupBelongedTo].tags.push(new Tag({
            name: tagName,
            namespace: this.namespace,
            options: options,
            tags: [
              this.namespace + ':' + this.config.grouped.relation + ':' + groupBelongedTo,
              this.namespace + ':' + this.config.grouped.subgroup + ':' + tagName]
          }))
        }
      }
    }
    // For groups without sub elements
    let emptyGroups = _.filter(tagGroupsAnnotations, (group) => { return group.tags.length === 0 })
    for (let j = 0; j < emptyGroups.length; j++) {
      tagGroupsAnnotations[emptyGroups[j].config.name].tags.push(new Tag({
        name: emptyGroups[j].config.name,
        namespace: emptyGroups[j].namespace,
        options: {},
        tags: [emptyGroups[j].config.namespace + ':' + emptyGroups[j].config.group + ':' + emptyGroups[j].config.name]
      }))
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
          this.tagsContainer.annotate.append(tagButton)
        }
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        for (let i = 0; i < this.currentTags.length; i++) {
          let tagGroupElement = this.currentTags[i].createPanel()
          if (tagGroupElement) {
            this.tagsContainer.annotate.append(tagGroupElement)
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initEventHandlers (callback) {
    document.addEventListener(Events.modeChanged, (event) => { this.modeChangeHandler(event) }, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  modeChangeHandler (event) {
    // Remove all tags
    this.removeTags()
    if (event.detail.mode === ModeManager.modes.highlight) {
      // Show all the tags
      this.createTagButtons()
    } else if (event.detail.mode === ModeManager.modes.index) {
      this.initIndexTags()
    }
  }

  initIndexTags (callback) {
    // TODO Retrieve all the dimensions
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({url: window.abwa.groupSelector.currentGroup.url, order: 'desc'}, (annotations) => {
      // If annotations are grouped
      if (!_.isEmpty(this.config.grouped)) {
        // Retrieve tags of the namespace
        let groupAnnotations = _.filter(annotations, (annotation) => {
          return this.hasANamespace(annotation, this.namespace)
        })
        // Remove slr:spreadsheet annotation ONLY for SLR case
        groupAnnotations = _.filter(groupAnnotations, (annotation) => {
          return !this.hasATag(annotation, 'slr:spreadsheet')
        })
        // Get only tags of groups
        groupAnnotations = _.filter(groupAnnotations, (annotation) => {
          return this.hasATag(annotation, this.namespace + ':' + this.config.grouped.group)
        })
        let groupTags = {}
        for (let i = 0; i < groupAnnotations.length; i++) {
          let groupTag = this.retrieveTagNameByPrefix(groupAnnotations[i].tags, (this.namespace + ':' + this.config.grouped.group))
          if (groupTag) {
            groupTags[groupTag] = new TagGroup({name: groupTag, namespace: this.namespace, group: this.config.grouped.group})
          }
        }
        // Retrieve current annotations
        window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
          url: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
          uri: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
          group: window.abwa.groupSelector.currentGroup.id
        }, (documentAnnotations) => {
          // Retrieve tags of the namespace
          documentAnnotations = _.filter(documentAnnotations, (annotation) => {
            return this.hasANamespace(annotation, this.namespace)
          })
          // Get only tags of subgroups or groups
          groupAnnotations = _.filter(groupAnnotations, (annotation) => {
            return this.hasATag(annotation, this.namespace + ':' + this.config.grouped.group) ||
              this.hasATag(annotation, this.namespace + ':' + this.config.grouped.subgroup)
          })
          // Group active subgroups by groups
          for (let i = 0; i < documentAnnotations.length; i++) {
            let annotationGroupData = this.getGroupAndSubgroup(documentAnnotations[i])
            // If not already subgroup, define it
            if (!_.find(groupTags[annotationGroupData.group].tags, (tag) => { return tag === annotationGroupData.subgroup })) {
              // Create tag and add to its group
              // If has subgroup
              if (annotationGroupData.subgroup) {
                let tagName = annotationGroupData.subgroup
                let color = _.find(window.abwa.tagManager.getTagsList(), (tag) => { return tag.name === tagName }).color
                groupTags[annotationGroupData.group].tags.push(new Tag({
                  name: tagName,
                  namespace: this.namespace,
                  options: {color: color},
                  tags: [
                    this.namespace + ':' + this.config.grouped.relation + ':' + annotationGroupData.group,
                    this.namespace + ':' + this.config.grouped.subgroup + ':' + annotationGroupData.subgroup
                  ]
                }))
              } else { // If doesn't have subgroup (free category)
                let tagName = annotationGroupData.group
                let color = _.find(window.abwa.tagManager.getTagsList(), (tag) => { return tag.name === tagName }).color
                groupTags[annotationGroupData.group].tags.push(new Tag({
                  name: tagName,
                  namespace: this.namespace,
                  options: {color: color},
                  tags: [
                    this.namespace + ':' + this.config.grouped.group + ':' + tagName
                  ]
                }))
              }
            }
          }
          this.currentIndexTags = _.values(groupTags)
          // Generate tag groups and buttons
          this.createIndexTagsButtons()
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  createIndexTagsButtons (callback) {
    // If it is an array is not grouped
    if (this.currentIndexTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentIndexTags[0], Tag)) {
        for (let i = 0; i < this.currentIndexTags.length; i++) {
          // Append each element
          let tagButton = this.currentIndexTags[i].createButton()
          this.tagsContainer.index.append(tagButton)
        }
      } else if (LanguageUtils.isInstanceOf(this.currentIndexTags[0], TagGroup)) {
        for (let i = 0; i < this.currentIndexTags.length; i++) {
          let tagGroupElement = this.currentIndexTags[i].createIndexPanel()
          if (tagGroupElement) {
            this.tagsContainer.index.append(tagGroupElement)
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  removeTags () {
    let tagPanel = document.querySelector('#tags')
    tagPanel.innerHTML = ''
  }

  getGroupAndSubgroup (annotation) {
    let tags = annotation.tags
    let group = null
    let subGroup = null
    let groupOf = _.find(tags, (tag) => { return _.startsWith(tag, this.namespace + ':' + this.config.grouped.relation + ':') })
    if (groupOf) {
      subGroup = _.find(tags, (tag) => { return _.startsWith(tag, this.namespace + ':' + this.config.grouped.subgroup + ':') })
        .replace(this.namespace + ':' + this.config.grouped.subgroup + ':', '')
      group = groupOf.replace(this.namespace + ':' + this.config.grouped.relation + ':', '')
    } else {
      let groupTag = _.find(tags, (tag) => { return _.startsWith(tag, this.namespace + ':' + this.config.grouped.group + ':') })
      if (groupTag) {
        group = groupTag.replace(this.namespace + ':' + this.config.grouped.group + ':', '')
      }
    }
    return {group: group, subgroup: subGroup}
  }

  showAllTags () {
    $(this.tagsContainer.index).attr('aria-hidden', 'true')
    $(this.tagsContainer.annotate).attr('aria-hidden', 'false')
  }

  showIndexTags () {
    $(this.tagsContainer.index).attr('aria-hidden', 'false')
    $(this.tagsContainer.annotate).attr('aria-hidden', 'true')
  }
}

module.exports = TagManager
