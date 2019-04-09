const axios = require('axios')
const _ = require('lodash')
const Buttons = require('./Buttons')
const Config = require('../Config')
const TagManager = require('./TagManager')
const UserFilter = require('./UserFilter')
const Events = require('./Events')
const LanguageUtils = require('../utils/LanguageUtils')

class DataExtractionManager {
  constructor () {
    this.mode = DataExtractionManager.modes.coding
    this.events = {}
    this.userFilter = null
    this.lastAnnotation = null // It stores last navigated annotation in checking mode
  }

  init (callback) {
    console.debug('Initializing data extraction manager')
    // Choose mode depending on annotation based initializer
    if (_.isObject(window.abwa.annotationBasedInitializer.initAnnotation)) {
      this.mode = DataExtractionManager.modes.checking
      window.abwa.sidebar.openSidebar()
    }
    this.classificationScheme = window.abwa.mappingStudyManager.classificationScheme
    this.insertDataExtractionContainer(() => {
      this.dataExtractionCodingContainer = document.querySelector('#codingContainer')
      this.dataExtractionCodingButtonsContainer = document.querySelector('#codingButtonsContainer')
      this.dataExtractionValidationContainer = document.querySelector('#codingValidationContainer')
      this.dataExtractionValidationButtonsContainer = document.querySelector('#codingValidationButtonsContainer')
      // Populate coding buttons container with classification scheme elements
      this.populateDataExtractionCodingSidebar()
      // Populate validation buttons container
      this.populateDataExtractionValidationSidebar()
      // Add user filter for validation mode
      this.userFilter = new UserFilter()
      this.userFilter.init()
      // Init mode toggle
      this.modeToggleElement = document.querySelector('#dataExtractionAnnotatorToggle')
      this.modeToggleElement.checked = this.mode === DataExtractionManager.modes.coding
      this.switchMode()
      // Add event listener for data extraction mode change
      this.addEventListenerModeToggle()
      // Add event listener for codebook updated
      this.addEventListenerCodebookUpdated()
      // Add event listener for current annotations updated
      this.addEventListenerUpdatedCurrentAnnotations()
    })
    if (_.isFunction(callback)) {
      callback()
    }
    console.debug('Initialized data extraction manager')
  }

  addEventListenerModeToggle () {
    this.modeToggleElement.addEventListener('click', () => {
      this.switchMode()
    })
  }

  populateDataExtractionCodingSidebar () {
    let codes = this.classificationScheme.codes
    let parentCodesWithChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length > 0
    })
    let parentCodesWithoutChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length === 0
    })
    // Create container for each parent code which has child elements
    for (let i = 0; i < parentCodesWithChild.length; i++) {
      let parentCode = parentCodesWithChild[i]
      let groupButton = Buttons.createGroupedButtons({
        id: parentCode.id,
        name: parentCode.name,
        className: 'codingElement',
        description: parentCode.description || '',
        color: parentCode.color,
        childGuideElements: parentCode.codes,
        groupHandler: this.codingEventHandler(),
        buttonHandler: this.codingEventHandler(),
        groupRightClickHandler: this.codingRightClickHandler(),
        buttonRightClickHandler: this.codingRightClickHandler()
      })
      this.dataExtractionCodingButtonsContainer.append(groupButton)
    }
    // Create buttons for each parent code which has not child elements
    for (let i = 0; i < parentCodesWithoutChild.length; i++) {
      let parentCode = parentCodesWithoutChild[i]
      let groupButton = Buttons.createButton({
        id: parentCode.id,
        name: parentCode.name,
        className: 'codingElement',
        description: parentCode.description || '',
        color: parentCode.color,
        handler: this.codingEventHandler(),
        buttonRightClickHandler: this.codingRightClickHandler()
      })
      this.dataExtractionCodingButtonsContainer.append(groupButton)
    }
  }

  populateDataExtractionValidationSidebar () {
    // TODO Mark which ones has annotations (number) and which are validated (border)
    let codes = this.classificationScheme.codes
    let parentCodesWithChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length > 0
    })
    let parentCodesWithoutChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length === 0
    })
    // Create container for each parent code which has child elements
    for (let i = 0; i < parentCodesWithChild.length; i++) {
      let parentCode = parentCodesWithChild[i]
      let groupButton = Buttons.createGroupedButtons({
        id: parentCode.id,
        name: parentCode.name,
        label: this.labelHandler(),
        data: this.dataHandler(),
        className: 'codingElement',
        description: parentCode.description || '',
        color: parentCode.color,
        childGuideElements: parentCode.codes,
        groupHandler: this.indexEventHandler(),
        buttonHandler: this.indexEventHandler(),
        groupRightClickHandler: this.codingRightClickHandler(),
        buttonRightClickHandler: this.codingRightClickHandler()
      })
      this.dataExtractionValidationButtonsContainer.append(groupButton)
    }
    // Create buttons for each parent code which has not child elements
    for (let i = 0; i < parentCodesWithoutChild.length; i++) {
      let parentCode = parentCodesWithoutChild[i]
      let groupButton = Buttons.createButton({
        id: parentCode.id,
        name: parentCode.name,
        label: this.labelHandler(),
        data: this.dataHandler(),
        className: 'codingElement',
        description: parentCode.description || '',
        color: parentCode.color,
        handler: this.indexEventHandler(),
        buttonRightClickHandler: this.codingRightClickHandler()
      })
      this.dataExtractionValidationButtonsContainer.append(groupButton)
    }
  }

  indexEventHandler () {
    return (event) => {
      // Get if it is created with a parent code or not
      let codeId
      if (event.target.classList.contains('groupName')) {
        codeId = event.target.parentElement.dataset.codeId
      } else if (event.target.classList.contains('tagButton')) {
        codeId = event.target.dataset.codeId
      }
      if (_.has(window.abwa.codingManager.primaryStudyCoding, codeId)) {
        let annotations = window.abwa.codingManager.primaryStudyCoding[codeId].annotations
        let index = _.indexOf(annotations, this.lastAnnotation)
        if (index === -1 || index === annotations.length - 1) {
          this.lastAnnotation = annotations[0]
        } else {
          this.lastAnnotation = annotations[index + 1]
        }
        window.abwa.contentAnnotator.goToAnnotation(this.lastAnnotation)
      }
    }
  }

  labelHandler () {
    return ({codeId, codeName}) => {
      if (window.abwa.codingManager) {
        if (_.has(window.abwa.codingManager.primaryStudyCoding, codeId)) {
          return '(' + window.abwa.codingManager.primaryStudyCoding[codeId].annotations.length + ') ' + codeName
        }
      }
      return codeName
    }
  }

  dataHandler () {
    return ({codeId}) => {
      if (window.abwa.codingManager) {
        if (_.has(window.abwa.codingManager.primaryStudyCoding, codeId)) {
          if (window.abwa.codingManager.primaryStudyCoding[codeId].validated) {
            return {validated: true}
          }
        }
      }
      return {}
    }
  }

  /**
   *
   * @return {Function}
   */
  codingEventHandler () {
    return (event) => {
      // Get if it is created with a parent code or not
      let codeId
      if (event.target.classList.contains('groupName')) {
        codeId = event.target.parentElement.dataset.codeId
      } else if (event.target.classList.contains('tagButton')) {
        codeId = event.target.dataset.codeId
      }
      // Get code for clicked button
      let code = _.find(this.classificationScheme.codes, (code) => {
        return code.id === codeId
      })
      // Send annotation event coding
      LanguageUtils.dispatchCustomEvent(Events.annotate, {code: code})
    }
  }

  codingRightClickHandler () {
    return (codeId) => {
      let items = {}
      items['goToAnnotation'] = {name: 'Go to next evidence'}
      return {
        callback: (key) => {
          if (key === 'goToAnnotation') {
            if (_.has(window.abwa.codingManager.primaryStudyCoding, codeId)) {
              let annotations = window.abwa.codingManager.primaryStudyCoding[codeId].annotations
              let index = _.indexOf(annotations, this.lastAnnotation)
              if (index === -1 || index === annotations.length - 1) {
                this.lastAnnotation = annotations[0]
              } else {
                this.lastAnnotation = annotations[index + 1]
              }
              window.abwa.contentAnnotator.goToAnnotation(this.lastAnnotation)
            }
          }
        },
        items: items
      }
    }
  }

  switchMode () {
    if (this.modeToggleElement.checked) {
      // Switch to mode creating
      this.mode = DataExtractionManager.modes.coding
      // Change text for label
      document.querySelector('#modeLabel').innerText = 'Coding'
      // Hide/unhide modes containers
      this.dataExtractionCodingContainer.setAttribute('aria-hidden', 'false')
      this.dataExtractionValidationContainer.setAttribute('aria-hidden', 'true')
    } else {
      // Switch to mode creating
      this.mode = DataExtractionManager.modes.checking
      // Change text for label
      document.querySelector('#modeLabel').innerText = 'Checking'
      // Hide/unhide modes containers
      this.dataExtractionCodingContainer.setAttribute('aria-hidden', 'true')
      this.dataExtractionValidationContainer.setAttribute('aria-hidden', 'false')
    }
    LanguageUtils.dispatchCustomEvent(Events.modeChanged, {mode: this.mode})
  }

  insertDataExtractionContainer (callback) {
    let generatorWrapperURL = chrome.extension.getURL('pages/sidebar/dataExtraction.html')
    axios.get(generatorWrapperURL).then((response) => {
      document.querySelector('#dataExtractionContainer').insertAdjacentHTML('afterbegin', response.data)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadUserFilter (config, callback) {
    this.destroyUserFilter()
    // Create augmentation operations for the current group
    window.abwa.userFilter = new UserFilter(config)
    window.abwa.userFilter.init(callback)
  }

  reloadTagsManager (config, callback) {
    // Destroy current tag manager
    this.destroyTagsManager()
    // Create a new tag manager for the current group
    window.abwa.tagManager = new TagManager(Config.slrDataExtraction.namespace, Config.slrDataExtraction.tags) // TODO Depending on the type of annotator
    window.abwa.tagManager.init(callback)
  }

  destroyTagsManager () {
    if (!_.isEmpty(window.abwa.tagManager)) {
      window.abwa.tagManager.destroy()
    }
  }

  destroyUserFilter (callback) {
    // Destroy current augmentation operations
    if (!_.isEmpty(window.abwa.userFilter)) {
      window.abwa.userFilter.destroy()
    }
  }

  destroy () {
    console.log('Data extraction manager destroyed')
    // TODO Destroy events
    // Destroy userfilter
    this.userFilter.destroy()
  }

  addEventListenerCodebookUpdated (callback) {
    this.events.codebookUpdated = {element: document, event: Events.codebookUpdated, handler: this.createCodebookUpdatedEventHandler()}
    this.events.codebookUpdated.element.addEventListener(this.events.codebookUpdated.event, this.events.codebookUpdated.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  addEventListenerUpdatedCurrentAnnotations (callback) {
    this.events.updatedCurrentAnnotations = {element: document, event: Events.updatedCurrentAnnotations, handler: this.updateSidebarButtonsEventHandler()}
    this.events.updatedCurrentAnnotations.element.addEventListener(this.events.updatedCurrentAnnotations.event, this.events.updatedCurrentAnnotations.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  updateSidebarButtonsEventHandler () {
    return (event) => {
      this.updateSidebarButtons()
    }
  }

  createCodebookUpdatedEventHandler () {
    return (event) => {
      this.updateSidebarButtons()
    }
  }

  updateSidebarButtons () {
    this.dataExtractionCodingButtonsContainer.innerText = ''
    this.populateDataExtractionCodingSidebar()
    this.dataExtractionValidationButtonsContainer.innerText = ''
    this.populateDataExtractionValidationSidebar()
  }
}

DataExtractionManager.modes = {
  coding: 'coding',
  checking: 'checking'
}

module.exports = DataExtractionManager
