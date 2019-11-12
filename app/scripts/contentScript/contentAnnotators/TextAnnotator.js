const ContentAnnotator = require('./ContentAnnotator')
const ModeManager = require('../ModeManager')
const ContentTypeManager = require('../ContentTypeManager')
const TagManager = require('../TagManager')
const Events = require('../Events')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const PDFTextUtils = require('../../utils/PDFTextUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const HypothesisClientManager = require('../../storage/hypothesis/HypothesisClientManager')
const Alerts = require('../../utils/Alerts')
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
      let filteredUsers = event.detail.filteredUsers
      // Unhighlight all annotations
      this.unHighlightAllAnnotations()
      // Retrieve annotations for filtered users
      this.currentAnnotations = this.retrieveAnnotationsForUsers(filteredUsers)
      LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
      this.redrawAnnotations()
    }
  }

  /**
   * Retrieve from all annotations for the current document, those who user is one of the list in users
   * @param users
   * @returns {Array}
   */
  retrieveAnnotationsForUsers (users) {
    return _.filter(this.allAnnotations, (annotation) => {
      let isFromSelectedUser = _.some(users, (user) => {
        return annotation.user === user // TODO Change by creator
      })
      let isAssessing = annotation.motivation === 'assessing' || annotation.motivation === 'oa:assessing'
      let isCodebook = annotation.motivation === 'slr:codebookDevelopment' || annotation.motivation === 'linking'
      return (isFromSelectedUser || isAssessing) && !isCodebook
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
        Alerts.infoAlert({title: 'No evidence selected to code', text: 'You should consider to highlight evidences in the text to code the primary study.'}) // TODO i18n
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        Alerts.infoAlert({title: 'Unable to code', text: 'The selected text content is not part of the primary study.'}) // TODO i18n
        return
      }
      let range = document.getSelection().getRangeAt(0)
      let selectors = TextAnnotator.getSelectors(range)
      // Construct the annotation to send to hypothesis
      let annotation = TextAnnotator.constructAnnotation({
        selectors,
        codeName: event.detail.code.name,
        body: window.abwa.storageManager.storageMetadata.annotationUrl + event.detail.code.id
      })
      window.abwa.storageManager.client.createNewAnnotation(annotation, (err, annotation) => {
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
    if (_.findIndex(window.abwa.contentTypeManager.documentFormat.selectors, (elem) => { return elem === 'FragmentSelector' }) !== -1) {
      let fragmentSelector = null
      if (window.abwa.contentTypeManager.documentFormat === ContentTypeManager.documentFormat.pdf) {
        fragmentSelector = PDFTextUtils.getFragmentSelector(range)
      } else {
        fragmentSelector = DOMTextUtils.getFragmentSelector(range)
      }
      if (fragmentSelector) {
        selectors.push(fragmentSelector)
      }
    }
    // Create RangeSelector
    if (_.findIndex(window.abwa.contentTypeManager.documentFormat.selectors, (elem) => { return elem === 'RangeSelector' }) !== -1) {
      let rangeSelector = DOMTextUtils.getRangeSelector(range)
      if (rangeSelector) {
        selectors.push(rangeSelector)
      }
    }
    // Create TextPositionSelector
    if (_.findIndex(window.abwa.contentTypeManager.documentFormat.selectors, (elem) => { return elem === 'TextPositionSelector' }) !== -1) {
      let rootElement = window.abwa.contentTypeManager.getDocumentRootElement()
      let textPositionSelector = DOMTextUtils.getTextPositionSelector(range, rootElement)
      if (textPositionSelector) {
        selectors.push(textPositionSelector)
      }
    }
    // Create TextQuoteSelector
    if (_.findIndex(window.abwa.contentTypeManager.documentFormat.selectors, (elem) => { return elem === 'TextQuoteSelector' }) !== -1) {
      let textQuoteSelector = DOMTextUtils.getTextQuoteSelector(range)
      if (textQuoteSelector) {
        selectors.push(textQuoteSelector)
      }
    }
    return selectors
  }

  static constructAnnotation ({
    selectors,
    motivation = 'classifying',
    id = '',
    creator = window.abwa.groupSelector.getCreatorData(),
    body,
    group = window.abwa.groupSelector.currentGroup.id,
    permissions = {read: ['group:' + window.abwa.groupSelector.currentGroup.id]},
    target,
    text = '',
    references = [],
    context = ['http://www.w3.org/ns/anno.jsonld', 'https://schema.datacite.org/meta/kernel-4.3/metadata.xsd'],
    codeName
  }) {
    let tags = ['motivation:' + motivation]
    if (codeName) {
      tags.push('slr:code:' + codeName)
    }
    let data = {
      '@context': context,
      '@id': id,
      '@type': 'Annotation',
      'motivation': motivation,
      creator: creator || '',
      group: group,
      body: body,
      permissions: permissions,
      references: references,
      tags: tags,
      // tags: ['slr:code:' + code.name, 'motivation:classifying'], // TODO Should we add all the parent codes as tags?
      target: target || [{
        selector: selectors
      }],
      text: text
    }
    // As hypothes.is don't follow some attributes of W3C, we must adapt created annotation with its own attributes to set the target source
    if (LanguageUtils.isInstanceOf(window.abwa.storageManager, HypothesisClientManager)) {
      // Add uri attribute
      data.uri = window.abwa.contentTypeManager.getDocumentURIToSaveInStorage()
      // Add document, uris, title, etc.
      let uris = window.abwa.contentTypeManager.getDocumentURIs()
      data.document = {}
      if (uris.urn) {
        data.document.documentFingerprint = uris.urn
      }
      data.document.link = Object.values(uris).map(uri => { return {href: uri} })
      if (uris.doi) {
        data.document.dc = { identifier: [uris.doi] }
        data.document.highwire = { doi: [uris.doi] }
      }
      // If document title is retrieved
      if (_.isString(window.abwa.contentTypeManager.documentTitle)) {
        data.document.title = window.abwa.contentTypeManager.documentTitle
      }
      // Copy to metadata field because hypothes.is doesn't return from its API all the data that it is placed in document
      data.documentMetadata = data.document
    }
    let source = window.abwa.contentTypeManager.getDocumentURIs()
    // Get document title
    source['title'] = window.abwa.contentTypeManager.documentTitle || ''
    // Get UUID for current target
    source['id'] = window.abwa.contentTypeManager.getDocumentId()
    data.target[0].source = source // Add source to the target
    return data
  }

  static constructAssessmentAnnotation ({text, agreement, status = 'approved', validatedAnnotation}) {
    let data = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      motivation: 'assessing',
      group: window.abwa.groupSelector.currentGroup.id,
      body: {
        type: 'TextualBody',
        value: text
      },
      creator: window.abwa.groupSelector.getCreatorData() || '',
      'oa:target': window.abwa.storageManager.storageMetadata.annotationUrl + validatedAnnotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, ''),
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [validatedAnnotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')],
      tags: ['motivation:assessing'],
      target: [],
      text: text,
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInStorage()
    }
    if (agreement) {
      data.agreement = agreement
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
    window.abwa.storageManager.client.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInStorage(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInStorage(),
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
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        if (_.isFunction(callback)) {
          callback(null, this.allAnnotations)
        }
      }
    })
  }

  getAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.storageManager.client.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInStorage(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInStorage(),
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
    // Retrieve current annotations depending on the mode
    if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.dataextraction) {
      if (window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.coding) {
        // Get annotations for mapping mode in data extraction
        return _.filter(this.allAnnotations, (annotation) => {
          return annotation.motivation === 'classifying' && annotation.user === window.abwa.groupSelector.user.userid // TODO Change annotation.user by annotation.creator
        })
      } else if (window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.checking) {
        // Return only annotations for users in filter
        if (window.abwa.dataExtractionManager.userFilter) {
          return this.retrieveAnnotationsForUsers(window.abwa.dataExtractionManager.userFilter.filteredUsers)
        } else {
          return _.filter(this.allAnnotations, (annotation) => {
            return annotation.motivation === 'classifying' && annotation.motivation === 'assessing'
          })
        }
      }
    } else if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.codebook) {
      // Get annotations for codebook mode
      return _.filter(this.allAnnotations, (annotation) => {
        return annotation.motivation === 'slr:codebookDevelopment'
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
    if (annotation.motivation === 'linking' || annotation.motivation === 'oa:linking') {
      // No need to highlight
      if (_.isFunction(callback)) {
        callback()
      }
      return
    } else if (annotation.motivation === 'slr:codebookDevelopment') {
      code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        let annotationId = annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
        return code.id === annotationId
      })
    } else if (annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying') {
      let codeAnnotationURL = annotation.body
      let annotationCodeId = codeAnnotationURL.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
      code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        let codeId = code.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
        return codeId === annotationCodeId
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
          highlightedElement.title = 'Annotation to define the code "' + code.name + '". Defined by: ' + user
          // TODO Find who has validated/approved this code
        } else if (annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying') {
          if (code) {
            highlightedElement.title = 'Author: ' + user + '\n' + 'Code: ' + code.name
          } else {
            highlightedElement.title = ''
          }
          if (annotation.text) {
            highlightedElement.title += '\nComment: ' + annotation.text
          }
          // Find people who validate this
          let validatingAnnotations = _.filter(this.allAnnotations, (allAnnotation) => {
            if (allAnnotation.motivation === 'assessing' && _.has(allAnnotation, 'oa:target')) {
              if (allAnnotation['oa:target'] === annotation.id) {
                return allAnnotation
              }
            }
          })
          validatingAnnotations.forEach((validatingAnnotation) => {
            let userName = validatingAnnotation.user.replace('acct:', '').replace('@hypothes.is', '')
            let agreement = validatingAnnotation.agreement
            if (agreement === 'agree') {
              highlightedElement.title += '\nReviewer ' + userName + ' agrees: '
            } else if (agreement === 'disagree') {
              highlightedElement.title += '\nReviewer ' + userName + ' disagrees: '
            } else {
              highlightedElement.title += '\nReviewer ' + userName + ' validates: '
            }
            highlightedElement.title += validatingAnnotation.text
          })
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
          let code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
            return code.id === annotation.id
          })
          // If codebook manager is in creating mode
          if (window.abwa.codeBookDevelopmentManager.mode === window.abwa.codeBookDevelopmentManager.constructor.modes.creating) {
            if (this.currentUserProfile.userid === annotation.user) {
              items['deleteCodebookCode'] = {name: 'Remove "' + code.name + '" code from codebook'}
            } else {
              // TODO Mark annotation to delete ¿?
            }
          } else {
            items['validateCode'] = {name: 'Validate "' + code.name + '" code from codebook'}
          }
        } else if (window.abwa.modeManager.mode === window.abwa.modeManager.constructor.modes.dataextraction) {
          // Delete annotation is allowed always if the creator is current user
          if (this.currentUserProfile.userid === annotation.user) {
            items['comment'] = {name: 'Comment'}
            items['deleteAnnotation'] = {name: 'Delete annotation'}
          }
          // Validation is only shown if current user is not the same as creator and it is in mode checking
          if (
            this.currentUserProfile.userid !== annotation.user &&
            window.abwa.dataExtractionManager.mode === window.abwa.dataExtractionManager.constructor.modes.checking // Only if other user and checking mode of data extraction
          ) {
            if (_.keys(items).length > 0) {
              items['sep1'] = '---------'
            }
            let code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
              return code.id === annotation.body.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
            })
            if (code) {
              items['validateCoding'] = {name: 'Validate \'' + code.name + '\' code for this primary study.'}
            } else {
              items['validateCoding'] = {name: 'Validate classification'}
            }
          }
        }
        return {
          callback: (key) => {
            if (key === 'deleteCodebookCode') {
              // Get the code for this annotation
              let codeToDelete = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
                return code.id === annotation.id
              })
              if (codeToDelete) {
                // Ask if want to delete
                Alerts.confirmAlert({
                  title: 'Are you sure to delete "' + codeToDelete.name + '" code?',
                  text: 'This is a risky action and it cannot be undone. All the annotations in all the primary studies related to this code won\'t be deleted, but they won\'t be related to this code anymore, and currently it is not possible to re-code them.',
                  alertType: Alerts.alertType.warning,
                  callback: () => {
                    // Remove code from classification scheme
                    let removeCodeResult = window.abwa.codeBookDevelopmentManager.removeCodeFromCodebook(codeToDelete)
                    // Remove annotation from all and current annotations
                    this.removeAnnotationsFromModel(removeCodeResult.annotationIdsToRemove)
                    // Redraw annotations
                    this.redrawAnnotations()
                  }
                })
              }
            } else if (key === 'validateCode') {
              // TODO Validate code from codebook
            } else if (key === 'deleteAnnotation') {
              window.abwa.storageManager.client.deleteAnnotation(annotation.id, (err, result) => {
                if (err) {
                  Alerts.errorAlert({title: 'Unable to delete annotation', text: 'Check if you are logged in Hypothes.is, reload the page and try again.'})
                } else {
                  _.remove(this.allAnnotations, annotation)
                  LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
                  // Update current annotations
                  this.currentAnnotations = this.retrieveCurrentAnnotations()
                  LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {annotations: this.updatedCurrentAnnotations})
                  // Redraw
                  this.redrawAnnotations()
                }
              })
            } else if (key === 'comment') {
              // Retrieve code for current annotation
              let code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => { return code.id === annotation.body.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') })
              let title = code ? 'Comment for code "' + code.name + '"' : 'Commenting'
              Alerts.inputTextAlert({
                title: title,
                inputValue: annotation.text,
                inputPlaceholder: 'Write your comment or memo.',
                input: 'textarea',
                callback: (err, text) => {
                  if (err) {
                    window.alert('Unable to load comment input form')
                  } else {
                    annotation.text = text
                    window.abwa.storageManager.client.updateAnnotation(annotation.id, annotation, (err, updatedAnnotation) => {
                      if (err) {
                        Alerts.errorAlert({title: 'Error updating your comment', text: 'Please check you are logged in hypothes.is.'})
                      } else {
                        LanguageUtils.dispatchCustomEvent(Events.comment, {annotation: annotation})
                        // Redraw current annotations
                        this.currentAnnotations = this.retrieveCurrentAnnotations()
                        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {annotations: this.updatedCurrentAnnotations})
                        this.redrawAnnotations()
                      }
                    })
                  }
                }
              })
            } else if (key === 'validateCoding') {
              // Check if validated annotation already exists
              let currentUserValidateAnnotation = {}
              // Get code validating
              let validatingCode = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
                return code.id === annotation.body.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
              })
              if (_.has(window.abwa.codingManager.primaryStudyCoding, validatingCode.id)) {
                currentUserValidateAnnotation = _.find(window.abwa.codingManager.primaryStudyCoding[validatingCode.id].validatingAnnotations, (validatingAnnotation) => {
                  return validatingAnnotation.user === window.abwa.groupSelector.user.userid
                })
              }
              let inputValue = ''
              if (currentUserValidateAnnotation) {
                inputValue = currentUserValidateAnnotation.text
              }
              Alerts.multipleInputAlert({
                title: 'Validating coding ' + validatingCode.name || '',
                html:
                  '<textarea id="comment" class="swal2-textarea customizeInput" placeholder="Write any comment for validating this code.">' + inputValue + '</textarea>' +
                  '<div><span class="radioButtonImage"><input type="radio" name="agreementRadio" value="agree" id="agreeRadio"/><label for="agreeRadio"><img title="Agree with the decision" id="agreeImage"/></label></span>' +
                  '<span class="radioButtonImage"><input type="radio" name="agreementRadio" value="disagree" id="disagreeRadio"/><label for="disagreeRadio"><img title="Disagree with the decision" id="disagreeImage"/></label></span>' +
                  '</div>',
                inputValue: inputValue,
                confirmButtonColor: 'rgba(100,200,100,1)',
                confirmButtonText: 'Validate',
                input: 'textarea',
                onOpen: () => {
                  if (currentUserValidateAnnotation && currentUserValidateAnnotation.agreement === 'agree') {
                    document.querySelector('#agreeRadio').checked = 'checked'
                  } else if (currentUserValidateAnnotation && currentUserValidateAnnotation.agreement === 'disagree') {
                    document.querySelector('#disagreeRadio').checked = 'checked'
                  }
                },
                preConfirm: () => {
                  let agreementChosenElement = document.querySelector('input[name="agreementRadio"]:checked')
                  let text = document.querySelector('#comment').value
                  return {
                    text: text,
                    agreement: _.isElement(agreementChosenElement) ? agreementChosenElement.value : null
                  }
                },
                callback: (err, form) => {
                  if (err) {
                    window.alert('Unable to load comment input form')
                  } else {
                    if (currentUserValidateAnnotation) {
                      // Update already created annotation for assessing
                      currentUserValidateAnnotation.text = form.text
                      if (form.agreement) {
                        currentUserValidateAnnotation.agreement = form.agreement
                      }
                      window.abwa.storageManager.client.updateAnnotation(currentUserValidateAnnotation.id, currentUserValidateAnnotation, (err, assessmentAnnotationResult) => {
                        if (err) {
                          Alerts.errorAlert({title: 'Unable to validate code', text: 'We were unable to update your validation for this code. Please check internet connection and try again.'}) // TODO i18n + contact developer
                        } else {
                          let index = _.findIndex(this.allAnnotations, (annotation) => {
                            return annotation.id === assessmentAnnotationResult.id
                          })
                          if (index !== -1) {
                            this.allAnnotations[index] = assessmentAnnotationResult
                          }
                          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
                          // Redraw current annotations
                          this.currentAnnotations = this.retrieveCurrentAnnotations()
                          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {annotations: this.updatedCurrentAnnotations})
                          this.redrawAnnotations()
                          // Send event new assessment annotation is created
                          LanguageUtils.dispatchCustomEvent(Events.annotationValidated, {annotation: annotation, assessmentAnnotation: assessmentAnnotationResult})
                        }
                      })
                    } else {
                      // Create a new annotation for assessing
                      let assessmentAnnotation = TextAnnotator.constructAssessmentAnnotation({text: form.text, agreement: form.agreement, validatedAnnotation: annotation})
                      window.abwa.storageManager.client.createNewAnnotation(assessmentAnnotation, (err, assessmentAnnotationResult) => {
                        if (err) {
                          Alerts.errorAlert({title: 'Unable to validate code', text: 'We were unable to validate this code. Please check internet connection and try again.'}) // TODO i18n + contact developer
                        } else {
                          // Update data model
                          this.allAnnotations.push(assessmentAnnotationResult)
                          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
                          // Redraw current annotations
                          this.currentAnnotations = this.retrieveCurrentAnnotations()
                          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {annotations: this.updatedCurrentAnnotations})
                          this.redrawAnnotations()
                          // Send event new assessment annotation is created
                          LanguageUtils.dispatchCustomEvent(Events.annotationValidated, {annotation: annotation, assessmentAnnotation: assessmentAnnotationResult})
                        }
                      })
                    }
                  }
                }
              })
            }
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
    if (window.abwa.contentTypeManager.documentFormat === ContentTypeManager.documentFormat.pdf) {
      let queryTextSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
      if (queryTextSelector && queryTextSelector.exact) {
        // Get page for the annotation
        let fragmentSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'FragmentSelector' })
        if (fragmentSelector && fragmentSelector.page) {
          // Check if annotation was found by 'find' command, otherwise go to page
          if (window.PDFViewerApplication.page !== fragmentSelector.page) {
            window.PDFViewerApplication.page = fragmentSelector.page
            this.redrawAnnotations()
          }
        }
        window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        // Timeout to remove highlight used by PDF.js
        this.removeFindTagsInPDFs()
      }
    } else { // Else, try to find the annotation by data-annotation-id element attribute
      let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
      // If go to annotation is done by init annotation and it is not found, wait for some seconds for ajax content to be loaded and try again to go to annotation
      if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) { // It is done only once, if timeout does not exist previously (otherwise it won't finish never calling goToAnnotation
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
      if (window.abwa.contentTypeManager.documentFormat === ContentTypeManager.documentFormat.pdf) {
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
    if (window.abwa.contentTypeManager.documentFormat === ContentTypeManager.documentFormat.pdf) {
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
