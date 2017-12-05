const ContentAnnotator = require('./ContentAnnotator')
const GroupSelector = require('../GroupSelector')
const TagManager = require('../TagManager')
const Events = require('../Events')
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
      this.initAnnotateEvent(() => {
        // TODO Load annotations for first time
        this.loadAnnotations(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  initAnnotateEvent (callback) {
    this.events.annotateEvent = this.createAnnotateEventHandler()
    document.addEventListener(Events.annotate, this.events.annotateEvent, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotateEventHandler () {
    return (event) => {
      let selectors = []
      // If selection is empty, return null
      if (document.getSelection().toString().length === 0) {
        console.debug('Current selection is empty') // TODO Show user message
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        console.debug('Current selection is child of the annotator sidebar') // TODO Show user message
        return
      }
      let range = document.getSelection().getRangeAt(0)
      // Create FragmentSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'FragmentSelector' }) !== -1) {
        let fragmentSelector = DOMTextUtils.getFragmentSelector(range)
        if (fragmentSelector) {
          selectors.push(fragmentSelector)
        }
      }
      // Create RangeSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'RangeSelector' }) !== -1) {
        let rangeSelector = DOMTextUtils.getRangeSelector(range)
        if (rangeSelector) {
          selectors.push(rangeSelector)
        }
      }
      // Create TextPositionSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextPositionSelector' }) !== -1) {
        let rootElement = window.abwa.contentTypeManager.getDocumentRootElement()
        let textPositionSelector = DOMTextUtils.getTextPositionSelector(range, rootElement)
        if (textPositionSelector) {
          selectors.push(textPositionSelector)
        }
      }
      // Create TextQuoteSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextQuoteSelector' }) !== -1) {
        let textQuoteSelector = DOMTextUtils.getTextQuoteSelector(range)
        if (textQuoteSelector) {
          selectors.push(textQuoteSelector)
        }
      }
      // Construct the annotation to send to hypothesis
      let annotation = this.constructAnnotation(selectors, event.detail.tags)
      window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(annotation, (annotation) => {
        console.debug('Created annotation with ID: ' + annotation.id)
        this.highlightAnnotation(annotation, () => {
          window.getSelection().removeAllRanges()
        })
      })
    }
  }

  constructAnnotation (selectors, tags) {
    return {
      group: window.abwa.groupSelector.currentGroup.id,
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [],
      tags: tags,
      target: [{
        selector: selectors
      }],
      text: '',
      uri: window.abwa.contentTypeManager.originalDocumentURI
    }
  }

  initSelectionEvents (callback) {
    this.events.mouseUpOnDocumentHandler = this.mouseUpOnDocumentHandlerConstructor()
    document.addEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  loadAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.originalDocumentURI,
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

  highlightAnnotations (annotations, callback) {
    let promises = []
    annotations.forEach(annotation => {
      promises.push(new Promise((resolve) => {
        this.highlightAnnotation(annotation, resolve)
      }))
    })
    Promise.all(promises).then(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  highlightAnnotation (annotation, callback) {
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
        highlightedElement.dataset.color = tagForAnnotation.color
        highlightedElement.dataset.tags = tagForAnnotation.tags
      })
      // Append currently highlighted elements
      this.currentlyHighlightedElements = $.merge(this.currentlyHighlightedElements, highlightedElements)
    } catch (err) {
      throw err
    } finally {
      if (_.isFunction(callback)) {
        callback()
      }
    }
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
    document.removeEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
    document.removeEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent)
    // Remove created annotations
    DOMTextUtils.unHighlightElements(this.currentlyHighlightedElements)
  }
}

module.exports = TextAnnotator
