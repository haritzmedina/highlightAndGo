const ContentAnnotator = require('./ContentAnnotator')
const GroupSelector = require('../GroupSelector')
const ContentTypeManager = require('../ContentTypeManager')
const TagManager = require('../TagManager')
const Events = require('../Events')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const _ = require('lodash')

const TRY_RECOVERING_ANNOTATION_INTERVAL_IN_SECONDS = 3

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.events.mouseUpOnDocumentHandler = null
    this.currentUserProfile = null
    this.currentlyHighlightedElements = []
    this.highlightClassName = 'highlightedAnnotation'
    this.highlightFilteredClassName = 'unHighlightedAnnotation'
  }

  init (callback) {
    this.initSelectionEvents(() => {
      this.initAnnotateEvent(() => {
        // Load annotations for first time
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

  initAnnotateEvent (callback) {
    this.events.annotateEvent = this.createAnnotationEventHandler()
    document.addEventListener(Events.annotate, this.events.annotateEvent, false)
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
    this.events.mouseUpOnDocumentHandler = this.mouseUpOnDocumentHandlerConstructor()
    document.addEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
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
      // Append currently highlighted elements
      this.currentlyHighlightedElements = $.merge(this.currentlyHighlightedElements, highlightedElements)
    } catch (err) {
      // If annotation target is not found try it again until found
      // TODO Performance: Check if this should be setTimeout instead of interval (cause is recursive function)
      let interval = setInterval(() => {
        console.log('Trying to recover annotation')
        this.highlightAnnotation(annotation, () => {
          clearInterval(interval)
        })
      }, TRY_RECOVERING_ANNOTATION_INTERVAL_IN_SECONDS * 1000)
    } finally {
      if (_.isFunction(callback)) {
        callback()
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

  goToFirstAnnotationOfTag () {
    // TODO Retrieve first annotation for tag

    this.goToAnnotation()
  }

  goToAnnotation (annotation) {

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

  initAnnotatorByAnnotation (callback) {
    // TODO Check if init annotation exists
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
