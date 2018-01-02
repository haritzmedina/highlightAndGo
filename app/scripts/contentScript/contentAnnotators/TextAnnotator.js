const ContentAnnotator = require('./ContentAnnotator')
const ModeManager = require('../ModeManager')
const ContentTypeManager = require('../ContentTypeManager')
const TagManager = require('../TagManager')
const Events = require('../Events')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const _ = require('lodash')
require('components-jqueryui')

const ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS = 3

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.observerInterval = null
    this.currentAnnotations = null
    this.currentUserProfile = null
    this.currentlyHighlightedElements = []
    this.highlightClassName = 'highlightedAnnotation'
    this.highlightFilteredClassName = 'unHighlightedAnnotation'
  }

  init (callback) {
    this.initEvents(() => {
      this.initAnnotationsObserver(() => {
        this.loadAnnotations(() => {
          this.initAnnotatorByAnnotation(() => {
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  initEvents (callback) {
    this.initSelectionEvents(() => {
      this.initAnnotateEvent(() => {
        this.initModeChangeEvent(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  initModeChangeEvent (callback) {
    this.events.modeChangeEvent = {element: document, event: Events.modeChanged, handler: this.createInitModeChangeEventHandler()}
    this.events.modeChangeEvent.element.addEventListener(this.events.modeChangeEvent.event, this.events.modeChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createInitModeChangeEventHandler () {
    return (event) => {
      // If mode is index, disable selection event
      if (window.abwa.modeManager.mode === ModeManager.modes.index) {
        this.disableSelectionEvent()
      } else {
        this.activateSelectionEvent()
      }
    }
  }

  initAnnotateEvent (callback) {
    this.events.annotateEvent = {element: document, event: Events.annotate, handler: this.createAnnotationEventHandler()}
    this.events.annotateEvent.element.addEventListener(this.events.annotateEvent.event, this.events.annotateEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationEventHandler () {
    return (event) => {
      let selectors = []
      // If selection is empty, return null
      if (document.getSelection().toString().length === 0) {
        alert('Nothing to highlight, current selection is empty') // Show user message
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        alert('The selected content cannot be highlighted, is not part of the document') // Show user message
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
      window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(annotation, (err, annotation) => {
        if (err) {
          alert('Unexpected error, unable to create annotation')
        } else {
          // Add to annotations
          this.currentAnnotations.push(annotation)
          // Send event annotation is created
          LanguageUtils.dispatchCustomEvent(Events.annotationCreated, {annotation: annotation})
          console.debug('Created annotation with ID: ' + annotation.id)
          this.highlightAnnotation(annotation, () => {
            window.getSelection().removeAllRanges()
          })
        }
      })
    }
  }

  constructAnnotation (selectors, tags) {
    let data = {
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
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    // For pdf files it is also send the relationship between pdf fingerprint and web url
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let pdfFingerprint = window.abwa.contentTypeManager.pdfFingerprint
      data.document = {
        documentFingerprint: pdfFingerprint,
        link: [{
          href: 'urn:x-pdf:' + pdfFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
    }
    // If doi is available, add it to the annotation
    if (!_.isEmpty(window.abwa.contentTypeManager.doi)) {
      data.document = data.document || {}
      let doi = window.abwa.contentTypeManager.doi
      data.document.dc = { identifier: [doi] }
      data.document.highwire = { doi: [doi] }
      data.document.link = data.document.link || []
      data.document.link.push({href: 'doi:' + doi})
    }
    // If citation pdf is found
    if (!_.isEmpty(window.abwa.contentTypeManager.citationPdf)) {
      let pdfUrl = window.abwa.contentTypeManager.doi
      data.document.link = data.document.link || []
      data.document.link.push({href: pdfUrl, type: 'application/pdf'})
    }
    return data
  }

  initSelectionEvents (callback) {
    if (_.isEmpty(window.abwa.annotationBasedInitializer.initAnnotation)) {
      this.activateSelectionEvent(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  activateSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler = {element: document, event: 'mouseup', handler: this.mouseUpOnDocumentHandlerConstructor()}
    this.events.mouseUpOnDocumentHandler.element.addEventListener(this.events.mouseUpOnDocumentHandler.event, this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  disableSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler.element.removeEventListener(
      this.events.mouseUpOnDocumentHandler.event,
      this.events.mouseUpOnDocumentHandler.handler)
  }

  initAnnotationsObserver (callback) {
    this.observerInterval = setInterval(() => {
      console.log(this.currentAnnotations)
      for (let i = 0; i < this.currentAnnotations.length; i++) {
        let annotation = this.currentAnnotations[i]
        // Search if annotation exist
        let element = document.querySelector('[data-annotation-id="' + annotation.id + '"')
        // If annotation doesn't exist, try to find it
        if (!_.isElement(element)) {
          this.highlightAnnotation(annotation)
        }
      }
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  loadAnnotations (callback) {
    // Retrieve current user profile
    window.abwa.hypothesisClientManager.hypothesisClient.getUserProfile((userProfile) => {
      this.currentUserProfile = userProfile
      // Retrieve annotations for current url and group
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
        url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
        uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
        group: window.abwa.groupSelector.currentGroup.id
      }, (err, annotations) => {
        if (err) {
          console.error('Unable to load annotations')
        } else {
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
          this.currentAnnotations = taggedAnnotations || []
          console.debug('Annotations to highlight')
          console.debug(taggedAnnotations)
          // Highlight annotations in the DOM
          this.highlightAnnotations(taggedAnnotations)
        }
      })
      if (_.isFunction(callback)) {
        callback()
      }
    })
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
      // Create context menu event for highlighted elements
      this.createContextMenuForAnnotation(annotation)
      // Create click event to move to next annotation
      this.createNextAnnotationHandler(annotation)
      // Append currently highlighted elements
      this.currentlyHighlightedElements = $.merge(this.currentlyHighlightedElements, highlightedElements)
    } finally {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  createNextAnnotationHandler (annotation) {
    let annotationIndex = _.findIndex(
      this.currentAnnotations,
      (currentAnnotation) => { return currentAnnotation.id === annotation.id })
    let nextAnnotationIndex = _.findIndex(
      this.currentAnnotations,
      (currentAnnotation) => { return _.isEqual(currentAnnotation.tags, annotation.tags) },
      annotationIndex + 1)
    // If not next annotation found, retrieve the first one
    if (nextAnnotationIndex === -1) {
      nextAnnotationIndex = _.findIndex(
        this.currentAnnotations,
        (currentAnnotation) => { return _.isEqual(currentAnnotation.tags, annotation.tags) })
    }
    // If annotation is different, create event
    if (nextAnnotationIndex !== annotationIndex) {
      let highlightedElements = document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')
      for (let i = 0; i < highlightedElements.length; i++) {
        let highlightedElement = highlightedElements[i]
        highlightedElement.addEventListener('click', () => {
          console.log('Clicked')
          // If mode is index, move to next annotation
          if (window.abwa.modeManager.mode === ModeManager.modes.index) {
            this.goToAnnotation(this.currentAnnotations[nextAnnotationIndex])
          }
        })
      }
    }
  }

  createContextMenuForAnnotation (annotation) {
    if (this.currentUserProfile.userid === annotation.user) {
      $.contextMenu({
        selector: '[data-annotation-id="' + annotation.id + '"]',
        callback: (key, options) => {
          // Delete annotation
          window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(annotation.id, (result) => {
            if (!result.deleted) {
              // Alert user error happened
              alert('Error deleting hypothesis annotation, please try it again')
            } else {
              // Retrieve highlighted elements for annotation
              let annotationElements = _.remove(this.currentlyHighlightedElements, (element) => {
                return element.dataset.annotationId === annotation.id
              })
              // Unhighlight annotation highlight elements
              DOMTextUtils.unHighlightElements(annotationElements)
              // Dispatch deleted annotation event
              LanguageUtils.dispatchCustomEvent(Events.annotationDeleted, {annotation: annotation})
              console.debug('Deleted annotation ' + annotation.id)
            }
          })
        },
        items: {
          'delete': {name: 'Delete annotation', icon: 'delete'}
        }
      })
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

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), tag.toLowerCase())
    }) !== -1
  }

  goToFirstAnnotationOfTag (params) {
    // TODO Retrieve first annotation for tag
    let annotation = _.find(this.currentAnnotations, (annotation) => {
      return _.isEqual(annotation.tags, params.tags)
    })
    this.goToAnnotation(annotation)
  }

  goToAnnotation (annotation) {
    // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let queryTextSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
      if (queryTextSelector && queryTextSelector.exact) {
        window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
      }
    } else { // Else, try to find the annotation by data-annotation-id element attribute
      let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
      if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
        this.initializationTimeout = setTimeout(() => {
          console.debug('Trying to scroll to init annotation in 2 seconds')
          this.initAnnotatorByAnnotation()
        }, 2000)
      } else {
        $('html').animate({
          scrollTop: ($(firstElementToScroll).offset().top - 200) + 'px'
        }, 300)
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
    // Remove observer
    clearInterval(this.observerInterval)
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Remove created annotations
    DOMTextUtils.unHighlightElements(this.currentlyHighlightedElements)
  }

  initAnnotatorByAnnotation (callback) {
    // Check if init annotation exists
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let initAnnotation = window.abwa.annotationBasedInitializer.initAnnotation
      // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
      if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
        let queryTextSelector = _.find(initAnnotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
        if (queryTextSelector && queryTextSelector.exact) {
          window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        }
      } else { // Else, try to find the annotation by data-annotation-id element attribute
        let firstElementToScroll = document.querySelector('[data-annotation-id="' + initAnnotation.id + '"]')
        if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
          this.initializationTimeout = setTimeout(() => {
            console.debug('Trying to scroll to init annotation in 2 seconds')
            this.initAnnotatorByAnnotation()
          }, 2000)
        } else {
          $('html').animate({
            scrollTop: ($(firstElementToScroll).offset().top - 200) + 'px'
          }, 300)
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = TextAnnotator
