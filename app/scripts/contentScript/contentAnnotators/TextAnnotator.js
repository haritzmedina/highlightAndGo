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
const REMOVE_OVERLAYS_INTERVAL_IN_SECONDS = 3
const ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS = 60

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.config = config
    this.observerInterval = null
    this.reloadInterval = null
    this.removeOverlaysInterval = null
    this.currentAnnotations = null
    this.allAnnotations = null
    this.currentUserProfile = null
    this.highlightClassName = 'highlightedAnnotation'
  }

  init (callback) {
    console.debug('Initializing text annotator')
    this.initEvents(() => {
      // Retrieve current user profile
      this.currentUserProfile = window.abwa.groupSelector.user
      this.loadAnnotations(() => {
        this.initAnnotatorByAnnotation(() => {
          // Check if something is selected after loading annotations and display sidebar
          if (document.getSelection().toString().length !== 0) {
            if ($(document.getSelection().anchorNode).parents('#abwaSidebarWrapper').toArray().length === 0) {
              this.openSidebar()
            }
          }
          this.initAnnotationsObserver(() => {
            console.debug('Initialized text annotator')
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
          this.initUserFilterChangeEvent(() => {
            this.initReloadAnnotationsEvent(() => {
              this.initDocumentURLChangeEvent(() => {
                // Reload annotations periodically
                if (_.isFunction(callback)) {
                  callback()
                }
              })
            })
          })
        })
      })
    })
    this.initRemoveOverlaysInPDFs()
  }

  initDocumentURLChangeEvent (callback) {
    this.events.documentURLChangeEvent = {element: document, event: Events.updatedDocumentURL, handler: this.createDocumentURLChangeEventHandler()}
    this.events.documentURLChangeEvent.element.addEventListener(this.events.documentURLChangeEvent.event, this.events.documentURLChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createDocumentURLChangeEventHandler (callback) {
    return () => {
      this.loadAnnotations(() => {
        console.debug('annotations updated')
      })
    }
  }

  initUserFilterChangeEvent (callback) {
    this.events.userFilterChangeEvent = {element: document, event: Events.userFilterChange, handler: this.createUserFilterChangeEventHandler()}
    this.events.userFilterChangeEvent.element.addEventListener(this.events.userFilterChangeEvent.event, this.events.userFilterChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initReloadAnnotationsEvent (callback) {
    this.reloadInterval = setInterval(() => {
      this.updateAllAnnotations(() => {
        console.debug('annotations updated')
      })
    }, ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS * 1000)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createUserFilterChangeEventHandler () {
    return (event) => {
      // This is only allowed in mode index
      if (window.abwa.modeManager.mode === ModeManager.modes.index) {
        let filteredUsers = event.detail.filteredUsers
        // Unhighlight all annotations
        this.unHighlightAllAnnotations()
        // Retrieve annotations for filtered users
        this.currentAnnotations = this.retrieveAnnotationsForUsers(filteredUsers)
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        this.highlightAnnotations(this.currentAnnotations)
      }
    }
  }

  /**
   * Retrieve from all annotations for the current document, those who user is one of the list in users
   * @param users
   * @returns {Array}
   */
  retrieveAnnotationsForUsers (users) {
    return _.filter(this.allAnnotations, (annotation) => {
      return _.find(users, (user) => {
        return annotation.user === 'acct:' + user + '@hypothes.is'
      })
    })
  }

  initModeChangeEvent (callback) {
    this.events.modeChangeEvent = {element: document, event: Events.modeChanged, handler: (event) => { this.modeChangeEventHandler(event) }}
    this.events.modeChangeEvent.element.addEventListener(this.events.modeChangeEvent.event, this.events.modeChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  modeChangeEventHandler (event) {
    // If mode is codebook or checking, disable selection event
    if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.codebook) {
      this.disableSelectionEvent()
    } else if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.dataextraction) {
      // Check current mode for data extraction
      if (window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.mapping) {
        // Activate selection event and sidebar functionality
        this.activateSelectionEvent()
      } else if (window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.checking) {
        this.disableSelectionEvent()
      }
    }
    this.currentAnnotations = this.retrieveCurrentAnnotations()
    this.redrawAnnotations()
    LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
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
      // If selection is empty, return null
      if (document.getSelection().toString().length === 0) {
        window.alert('Nothing to highlight, current selection is empty') // TODO change by swal
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        window.alert('The selected content cannot be highlighted, is not part of the document') // TODO change by swal
        return
      }
      let range = document.getSelection().getRangeAt(0)
      let selectors = TextAnnotator.getSelectors(range)
      // Construct the annotation to send to hypothesis
      let annotation = TextAnnotator.constructAnnotation(selectors, event.detail.tags)
      window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(annotation, (err, annotation) => {
        if (err) {
          window.alert('Unexpected error, unable to create annotation')
        } else {
          // Add to annotations
          this.currentAnnotations.push(annotation)
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          this.allAnnotations.push(annotation)
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
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

  static getSelectors (range) {
    let selectors = []
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
    return selectors
  }

  static constructAnnotation (selectors, tags) {
    let data = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      'motivation': 'oa:classifying',
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
    // Disable to ensure that the event does not exist
    this.disableSelectionEvent(() => {
      this.events.mouseUpOnDocumentHandler = {element: document, event: 'mouseup', handler: this.mouseUpOnDocumentHandlerConstructor()}
      this.events.mouseUpOnDocumentHandler.element.addEventListener(this.events.mouseUpOnDocumentHandler.event, this.events.mouseUpOnDocumentHandler.handler)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  disableSelectionEvent (callback) {
    if (this.events.mouseUpOnDocumentHandler) {
      this.events.mouseUpOnDocumentHandler.element.removeEventListener(
        this.events.mouseUpOnDocumentHandler.event,
        this.events.mouseUpOnDocumentHandler.handler)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  /**
   * Initializes annotations observer, to ensure dynamic web pages maintain highlights on the screen
   * @param callback Callback when initialization finishes
   */
  initAnnotationsObserver (callback) {
    this.observerInterval = setInterval(() => {
      if (this.currentAnnotations) {
        for (let i = 0; i < this.currentAnnotations.length; i++) {
          let annotation = this.currentAnnotations[i]
          // Search if annotation exist
          let element = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
          // If annotation doesn't exist, try to find it
          if (!_.isElement(element)) {
            Promise.resolve().then(() => { this.highlightAnnotation(annotation) })
          }
        }
      }
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // TODO Improve the way to highlight to avoid this interval (when search in PDFs it is highlighted empty element instead of element)
    this.cleanInterval = setInterval(() => {
      let highlightedElements = document.querySelectorAll('.highlightedAnnotation')
      highlightedElements.forEach((element) => {
        if (element.innerText === '') {
          $(element).remove()
        }
      })
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  loadAnnotations (callback) {
    this.updateAllAnnotations((err) => {
      if (err) {
        // TODO Show user no able to load all annotations
        console.error('Unable to load annotations')
      } else {
        // Current annotations will be
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        // Highlight annotations in the DOM
        this.redrawAnnotations()
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  updateAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // TODO Check if received annotations are annotated with codes in the classification scheme or motivation codebook
        // Search tagged annotations
        /* let tagList = window.abwa.tagManager.getTagsList()
        let taggedAnnotations = []
        for (let i = 0; i < annotations.length; i++) {
          // Check if annotation contains a tag of current group
          let tag = TagManager.retrieveTagForAnnotation(annotations[i], tagList)
          if (tag) {
            taggedAnnotations.push(annotations[i])
          }
        }
        this.allAnnotations = taggedAnnotations || []
        */
        this.allAnnotations = annotations
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        if (_.isFunction(callback)) {
          callback(null, this.allAnnotations)
        }
      }
    })
  }

  getAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
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
        if (_.isFunction(callback)) {
          callback(null, taggedAnnotations)
        }
      }
    })
  }

  retrieveCurrentAnnotations () {
    // TODO Retrieve current annotations depending on the mode
    if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.dataextraction) {
      if (window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.mapping) {
        // Get annotations for mapping mode in data extraction
        return _.filter(this.allAnnotations, (annotation) => {
          // TODO use this: return annotation.motivation === 'classifying'
          return _.find(annotation.tags, (tag) => {
            return tag === 'motivation:classifying'
          }) && annotation.user === this.currentUserProfile.userid // TODO Change annotation.user by annotation.creator
        })
      } else if (window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.checking) {
        // Get annotations for checking mode in data extraction
        return _.filter(this.allAnnotations, (annotation) => {
          // TODO use this: return annotation.motivation === 'classifying'
          return _.find(annotation.tags, (tag) => {
            return tag === 'motivation:classifying'
          })
        })
      }
    } else if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.codebook) {
      // Get annotations for codebook mode
      return _.filter(this.allAnnotations, (annotation) => {
        return _.find(annotation.tags, (tag) => {
          return tag === 'motivation:slr:codebookDevelopment'
        })
        // TODO use this: return annotation.motivation === 'slr:codebookDevelopment'
      })
    } else {
      return this.allAnnotations
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
    // Get code for annotation
    let code
    if (annotation.motivation === 'linking') {
      // No need to highlight
      if (_.isFunction(callback)) {
        callback()
      }
      return
    } else if (annotation.motivation === 'slr:codebookDevelopment') {
      code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.id === annotation.id
      })
    } else if (annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying') {
      let codeAnnotationURL = annotation.body
      let annotationCodeId = codeAnnotationURL.replace('https://hypothes.is/api/annotations/', '')
      code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.id === annotationCodeId
      })
    } else if (annotation.motivation === 'assessing' || annotation.motivation === 'oa:assessing') {
      // No need to highlight
      if (_.isFunction(callback)) {
        callback()
      }
      return
    } else {
      // Unexpected type of annotation, it will not shown
      if (_.isFunction(callback)) {
        callback(new Error('Unexpected type of annotation'))
      }
      return
    }
    // TODO Change the way the code is get (from body id of code)
    let err
    try {
      // TODO Remove this case for google drive
      let highlightedElements = DOMTextUtils.highlightContent(
        annotation.target[0].selector, classNameToHighlight, annotation.id)
      // Highlight in same color as button
      highlightedElements.forEach(highlightedElement => {
        // If need to highlight, set the color corresponding to, in other case, maintain its original color
        if (code) {
          $(highlightedElement).css('background-color', code.color)
          // Set purpose color
          highlightedElement.dataset.color = code.color
        } else {
          $(highlightedElement).css('background-color', 'rgba(150,150,150,0.6)')
        }
        let user = annotation.user.replace('acct:', '').replace('@hypothes.is', '')
        // Set highlighted element title
        if (annotation.motivation === 'slr:codebookDevelopment') {
          highlightedElement.title = 'Annotation to define the code' + code.name + '. Definition set by: ' + user
        } else if (annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying') {
          if (code) {
            highlightedElement.title = 'Author: ' + user + '\n' + 'Code: ' + code.name
          } else {
            highlightedElement.title = ''
          }
        }
      })
      // Create context menu event for highlighted elements
      this.createContextMenuForAnnotation(annotation)
      // Create click event to move to next annotation
      this.createNextAnnotationHandler(annotation)
    } catch (e) {
      err = new Error('Element not found')
    } finally {
      if (_.isFunction(callback)) {
        callback(err)
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
          // If mode is index, move to next annotation
          if (window.abwa.modeManager.mode === ModeManager.modes.index) {
            this.goToAnnotation(this.currentAnnotations[nextAnnotationIndex])
          }
        })
      }
    }
  }

  createContextMenuForAnnotation (annotation) {
    $.contextMenu({
      selector: '[data-annotation-id="' + annotation.id + '"]',
      build: () => {
        // Create items for context menu
        let items = {}
        // Depending on the mode
        if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.codebook) {
          // If codebook manager is in creating mode
          if (window.abwa.codeBookDevelopmentManager.mode === window.abwa.codeBookDevelopmentManager.constructor.modes.creating) {
            if (this.currentUserProfile.userid === annotation.user) {
              items['deleteCodebookCode'] = {name: 'Remove this code from codebook'}
            } else {
              // TODO Mark annotation to delete ¿?
            }
          } else {
            items['validateCode'] = {name: 'Validate this code from codebook'}
          }
        } else {
          // Ask to data extraction for current mode
          items['deleteAnnotation'] = {name: 'Delete annotation'}
          if (this.currentUserProfile.userid !== annotation.user) { // TODO Only in validation mode of data extraction
            items['sep1'] = '---------'
            items['validateAnnotation'] = {name: 'Validate classification'}
          }
        }
        return {
          callback: (key) => {
            if (key === 'deleteCodebookCode') {
              // Get the code for this annotation
              let codeToDelete = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
                return code.id === annotation.id
              })
              // Remove code from classification scheme
              let removeCodeResult = window.abwa.codeBookDevelopmentManager.removeCodeFromCodebook(codeToDelete)
              // Remove annotation from all and current annotations
              this.removeAnnotationsFromModel(removeCodeResult.annotationIdsToRemove)
              // Redraw annotations
              this.redrawAnnotations()
            }
            /* if (key === 'validate') {
              // Validate annotation category
              LanguageUtils.dispatchCustomEvent(Events.annotationValidated, {annotation: annotation})
            } else if (key === 'delete') {
              // Delete annotation
              window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(annotation.id, (err, result) => {
                if (err) {
                  // Unable to delete this annotation
                  console.error('Error while trying to delete annotation %s', annotation.id)
                } else {
                  if (!result.deleted) {
                    // Alert user error happened
                    // TODO swal
                    window.alert('Error deleting hypothesis annotation, please try it again')
                  } else {
                    // Remove annotation from data model
                    _.remove(this.currentAnnotations, (currentAnnotation) => {
                      return currentAnnotation.id === annotation.id
                    })
                    LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
                    _.remove(this.allAnnotations, (currentAnnotation) => {
                      return currentAnnotation.id === annotation.id
                    })
                    LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
                    // Dispatch deleted annotation event
                    LanguageUtils.dispatchCustomEvent(Events.annotationDeleted, {annotation: annotation})
                    // Unhighlight annotation highlight elements
                    DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
                    console.debug('Deleted annotation ' + annotation.id)
                  }
                }
              })
            } */
          },
          items: items
        }
      }
    })
  }

  retrieveHighlightClassName () {
    return this.highlightClassName // TODO Depending on the status of the application
  }

  mouseUpOnDocumentHandlerConstructor () {
    return (event) => {
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
        // Timeout to remove highlight used by PDF.js
        setTimeout(() => {
          let pdfjsHighlights = document.querySelectorAll('.highlight')
          for (let i = 0; pdfjsHighlights.length; i++) {
            pdfjsHighlights[i].classList.remove('highlight')
          }
        }, 1000)
        // Redraw annotations
        this.redrawAnnotations()
      }
    } else { // Else, try to find the annotation by data-annotation-id element attribute
      let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
      if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
        this.initializationTimeout = setTimeout(() => {
          console.debug('Trying to scroll to init annotation in 2 seconds')
          this.initAnnotatorByAnnotation()
        }, 2000)
      } else {
        firstElementToScroll.scrollIntoView({behavior: 'smooth', block: 'center'})
      }
    }
  }

  closeSidebar () {
    super.closeSidebar()
  }

  openSidebar () {
    super.openSidebar()
  }

  destroy (callback) {
    // Remove observer interval
    clearInterval(this.observerInterval)
    // Clean interval
    clearInterval(this.cleanInterval)
    // Remove reload interval
    clearInterval(this.reloadInterval)
    // Remove overlays interval
    if (this.removeOverlaysInterval) {
      clearInterval(this.removeOverlaysInterval)
    }
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
    if (_.isFunction(callback)) {
      callback()
    }
  }

  unHighlightAllAnnotations () {
    // Remove created annotations
    let highlightedElements = [...document.querySelectorAll('.highlightedAnnotation')]
    DOMTextUtils.unHighlightElements(highlightedElements)
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
          this.removeFindTagsInPDFs()
        }
      } else { // Else, try to find the annotation by data-annotation-id element attribute
        let firstElementToScroll = document.querySelector('[data-annotation-id="' + initAnnotation.id + '"]')
        if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
          this.initializationTimeout = setTimeout(() => {
            console.debug('Trying to scroll to init annotation in 2 seconds')
            this.initAnnotatorByAnnotation()
          }, 2000)
        } else {
          if (_.isElement(firstElementToScroll)) {
            $('html').animate({
              scrollTop: ($(firstElementToScroll).offset().top - 200) + 'px'
            }, 300)
          } else {
            // Unable to go to the annotation
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initRemoveOverlaysInPDFs () {
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      this.removeOverlaysInterval = setInterval(() => {
        // Remove third party made annotations created overlays periodically
        document.querySelectorAll('section[data-annotation-id]').forEach((elem) => { $(elem).remove() })
      }, REMOVE_OVERLAYS_INTERVAL_IN_SECONDS * 1000)
    }
  }

  removeFindTagsInPDFs () {
    setTimeout(() => {
      // Remove class for middle selected elements in find function of PDF.js
      document.querySelectorAll('.highlight.selected.middle').forEach(elem => {
        $(elem).removeClass('highlight selected middle')
      })
      // Remove wrap for begin and end selected elements in find function of PDF.js
      document.querySelectorAll('.highlight.selected').forEach(elem => {
        if (elem.children.length === 1) {
          $(elem.children[0]).unwrap()
        } else {
          $(document.createTextNode(elem.innerText)).insertAfter(elem)
          $(elem).remove()
        }
      })
    }, 1000)
  }

  redrawAnnotations () {
    // Unhighlight current annotations
    this.unHighlightAllAnnotations()
    // Highlight current annotations
    this.highlightAnnotations(this.currentAnnotations)
  }

  removeAnnotationFromModel (annotation) {
    _.remove(this.currentAnnotations, (currentAnnotation) => {
      return currentAnnotation.id === annotation.id
    })
    LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
    _.remove(this.allAnnotations, (currentAnnotation) => {
      return currentAnnotation.id === annotation.id
    })
    LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
  }

  removeAnnotationsFromModel (annotationIds) {
    _.remove(this.currentAnnotations, (currentAnnotation) => {
      return _.find(annotationIds, (annotationId) => {
        return annotationId === currentAnnotation.id
      })
    })
    LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
    _.remove(this.allAnnotations, (currentAnnotation) => {
      return _.find(annotationIds, (annotationId) => {
        return annotationId === currentAnnotation.id
      })
    })
    LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
  }
}

module.exports = TextAnnotator
