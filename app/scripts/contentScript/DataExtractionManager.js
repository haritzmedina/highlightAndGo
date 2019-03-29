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
  }

  init (callback) {
    console.debug('Initializing data extraction manager')
    this.classificationScheme = window.abwa.mappingStudyManager.classificationScheme
    this.insertDataExtractionContainer(() => {
      this.dataExtractionCodingContainer = document.querySelector('#codingContainer')
      this.dataExtractionCodingButtonsContainer = document.querySelector('#codingButtonsContainer')
      this.dataExtractionValidationContainer = document.querySelector('#codingValidationContainer')
      // Populate coding buttons container with classification scheme elements
      this.populateDataExtractionCodingSidebar()
      // Init mode toggle
      this.modeToggleElement = document.querySelector('#dataExtractionAnnotatorToggle')
      this.modeToggleElement.checked = this.mode === DataExtractionManager.modes.coding
      this.switchMode()
      // Add event listener for codebook mode change
      this.addEventListenerModeToggle()
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
      LanguageUtils.dispatchCustomEvent(Events.annotate, {code: code})
      // TODO coding
    }
  }

  codingRightClickHandler () {
    return (codeId) => {
      let items = {}
      items['something'] = {name: 'Not implemented options...'}
      return {
        callback: (key) => {
          if (key === 'something') {

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

  reloadSpecificContentManager (config, callback) {
    // Destroy current specific content manager
    this.destroySpecificContentManager()
    if (config.namespace === 'slr') {
      const SLRDataExtractionContentScript = require('../specific/slrDataExtraction/SLRDataExtractionContentScript')
      window.abwa.specificContentManager = new SLRDataExtractionContentScript(config)
      window.abwa.specificContentManager.init()
    }
  }

  destroySpecificContentManager () {
    if (window.abwa.specificContentManager) {
      window.abwa.specificContentManager.destroy()
    }
  }

  destroy () {
    console.log('Data extraction manager destroyed')
    this.destroyContentAnnotator()
  }
}

DataExtractionManager.modes = {
  coding: 'coding',
  checking: 'checking'
}

module.exports = DataExtractionManager
