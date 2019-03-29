const $ = require('jquery')
const _ = require('lodash')
const LanguageUtils = require('../utils/LanguageUtils')
const Events = require('./Events')
const DataExtractionManager = require('./DataExtractionManager')
const CodeBookDevelopmentManager = require('./CodeBookDevelopmentManager')

class ModeManager {
  constructor (mode) {
    if (mode) {
      this.mode = mode
    } else {
      this.mode = ModeManager.modes.dataextraction
    }
  }

  init (callback) {
    this.loadHtml(() => {
      // Load the modes
      // Init data extraction mode
      window.abwa.dataExtractionManager = new DataExtractionManager()
      window.abwa.dataExtractionManager.init()
      // Init codebook mode
      window.abwa.codeBookDevelopmentManager = new CodeBookDevelopmentManager()
      window.abwa.codeBookDevelopmentManager.init()
      // Set mode
      if (this.mode === ModeManager.modes.codebook) {
        this.setCodebookMode()
      } else {
        this.setDataExtractionMode()
      }
      this.initEventHandlers(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
  }

  loadHtml (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/annotatorMode.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      // Create events for toggles
      this.initEventHandlers()
      // Set toggle status
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setCodebookMode () {
    // Hide all modes
    this.hideAllModes()
    // Show codebook mode
    document.querySelector('#codeBookDevelopmentModeSwitch').setAttribute('aria-expanded', 'true')
    document.querySelector('#codeBookDevelopmentModeContainer').setAttribute('aria-hidden', 'false')
    this.mode = ModeManager.modes.codebook
    LanguageUtils.dispatchCustomEvent(Events.modeChanged, {mode: this.mode})
  }

  setDataExtractionMode () {
    // Hide all modes
    this.hideAllModes()
    // Show codebook mode
    document.querySelector('#dataExtractionModeSwitch').setAttribute('aria-expanded', 'true')
    document.querySelector('#dataExtractionModeContainer').setAttribute('aria-hidden', 'false')
    this.mode = ModeManager.modes.dataextraction
    LanguageUtils.dispatchCustomEvent(Events.modeChanged, {mode: this.mode})
  }

  hideAllModes () {
    // Hide all parent modes
    document.querySelectorAll('.parentModeTitle').forEach((parentModeTitleElement) => {
      parentModeTitleElement.setAttribute('aria-expanded', 'false')
    })
    // Hide all mode containers
    document.querySelectorAll('.parentModeContainer').forEach((parentModeTitleElement) => {
      parentModeTitleElement.setAttribute('aria-hidden', 'true')
    })
  }

  initEventHandlers (callback) {
    let codeBookDevelopmentModeSwitchElement = document.querySelector('#codeBookDevelopmentModeSwitch')
    codeBookDevelopmentModeSwitchElement.addEventListener('click', (event) => {
      if (event.target.getAttribute('aria-expanded') === 'false') {
        this.setCodebookMode()
      }
    })
    let dataExtractionModeSwitchElement = document.querySelector('#dataExtractionModeSwitch')
    dataExtractionModeSwitchElement.addEventListener('click', (event) => {
      if (event.target.getAttribute('aria-expanded') === 'false') {
        this.setDataExtractionMode()
      }
    })
    if (_.isFunction(callback)) {
      callback()
    }
  }

  destroy () {

  }
}

ModeManager.modes = {
  'codebook': 'codebook',
  'dataextraction': 'dataextraction'
}

module.exports = ModeManager
