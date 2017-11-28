const ContentAnnotator = require('./ContentAnnotator')
const GroupSelector = require('../GroupSelector')
const TagManager = require('../TagManager')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const $ = require('jquery')
const _ = require('lodash')

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.events.mouseUpOnDocumentHandler = null
    this.currentlyHighlightedElements = []
    this.highlightClassName = 'highlightedAnnotation'
    this.highlightFilteredClassName = 'unHighlightedAnnotation'
  }

  init (callback) {
    this.initSelectionEvents(() => {
      this.initGroupChangeHandler(() => {
        // TODO Load annotations for first time
        this.loadAnnotations(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  initSelectionEvents (callback) {
    this.events.mouseUpOnDocumentHandler = this.mouseUpOnDocumentHandlerConstructor()
    document.addEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initGroupChangeHandler (callback) {
    this.events.hypothesisGroupChangedHandler = this.hypothesisGroupChangedHandlerConstructor()
    document.addEventListener(GroupSelector.eventGroupChange, this.hypothesisGroupChangedHandler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  hypothesisGroupChangedHandlerConstructor () {
    return (event) => {
      console.log('HypothesisGroupChanged')
      console.log(event.detail)
    }
  }

  loadAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.location.href,
      group: window.abwa.groupSelector.currentGroup.id
    }, (annotations) => {
      // Search tagged annotations
      let tagList = window.abwa.tagManager.getTagsList()
      let taggedAnnotations = []
      for (let i = 0; i < annotations.length; i++) {
        // Check if annotation contains a tag of current group
        let tag = TagManager.retrieveTagForAnnotation(annotations[i], tagList)
        if (tag) {
          taggedAnnotations.push(annotations[i])
        }
      }
      console.debug('Annotations to highlight')
      console.debug(taggedAnnotations)
      // Highlight annotations in the DOM
      this.highlightAnnotations(taggedAnnotations)
    })
    if (_.isFunction(callback)) {
      callback()
    }
  }

  highlightAnnotations (annotations) {
    let promises = []
    annotations.forEach(annotation => {
      promises.push(new Promise((resolve) => {
        let classNameToHighlight = this.retrieveHighlightClassName(annotation)
        let tagList = window.abwa.tagManager.getTagsList()
        let tagForAnnotation = TagManager.retrieveTagForAnnotation(annotation, tagList)
        try {
          let highlightedElements = DOMTextUtils.highlightContent(
            annotation.target[0].selector, classNameToHighlight, annotation.id)
          // Highlight in same color as button
          highlightedElements.forEach(highlightedElement => {
            // If need to highlight, set the color corresponding to, in other case, maintain its original color
            $(highlightedElement).css('background-color', tagForAnnotation.color)
            // Set purpose color
            highlightedElement.dataset.color = annotation.color
            highlightedElement.dataset.tags = tagForAnnotation.tags
          })
          // Append currently highlighted elements
          this.currentlyHighlightedElements = $.merge(this.currentlyHighlightedElements, highlightedElements)
        } catch (err) {
          throw err
        } finally {
          resolve()
        }
      }))
    })
  }

  setHighlightedBackgroundColor (elem, color) {
    if (color) {
      $(elem).css('background-color', color)
    } else {
      if (elem.nodeName === 'MARK') {
        $(elem).css('background-color', 'initial')
      } else {
        $(elem).css('background-color', '')
      }
    }
  }

  retrieveHighlightClassName () {
    return this.highlightClassName // TODO Depending on the status of the application
  }

  mouseUpOnDocumentHandlerConstructor () {
    return () => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty')
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          console.debug('Current selection is not child of the annotator sidebar')
          this.closeSidebar()
        }
      }
    }
  }

  closeSidebar () {
    super.closeSidebar()
  }

  openSidebar () {
    super.openSidebar()
  }

  destroy () {
    // Remove event listener
    document.removeEventListener(GroupSelector.eventGroupChange, this.events.hypothesisGroupChangedHandler)
    document.removeEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
    // Remove created annotations
    DOMTextUtils.unHighlightElements(this.currentlyHighlightedElements)
  }
}

module.exports = TextAnnotator
