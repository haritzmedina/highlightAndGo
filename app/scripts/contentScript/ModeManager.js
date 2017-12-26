const $ = require('jquery')
const _ = require('lodash')
const LanguageUtils = require('../utils/LanguageUtils')
const Events = require('./Events')

class ModeManager {
  constructor (mode) {
    if (mode) {
      this.mode = mode
    } else {
      // If initialization based on annotation
      if (window.abwa.annotationBasedInitializer.initAnnotation) {
        this.mode = ModeManager.modes.index
      } else {
        this.mode = ModeManager.modes.highlight
      }
    }
  }

  init (callback) {
    this.loadSidebarToggle(() => {
      this.initEventHandlers(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
  }

  loadSidebarToggle (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/annotatorMode.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      // Set toggle status
      this.setToggleStatus()
      // Set tags text
      this.setPanelText()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setToggleStatus () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    if (this.mode === ModeManager.modes.highlight) {
      annotatorToggle.checked = true
    } else {
      annotatorToggle.checked = false
    }
  }

  setPanelText () {
    // Mode element
    let modeHeaderLabel = document.querySelector('#modeHeader label')
    modeHeaderLabel.innerText = chrome.i18n.getMessage('Mode')
    let modeLabel = document.querySelector('#modeLabel')
    if (this.mode === ModeManager.modes.highlight) {
      modeLabel.innerText = chrome.i18n.getMessage('highlight')
    } else {
      modeLabel.innerText = chrome.i18n.getMessage('index')
    }
  }

  initEventHandlers (callback) {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    annotatorToggle.addEventListener('click', (event) => {
      if (annotatorToggle.checked) {
        this.mode = ModeManager.modes.highlight
      } else {
        this.mode = ModeManager.modes.index
      }
      LanguageUtils.dispatchCustomEvent(Events.modeChanged, {mode: this.mode})
    })
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

ModeManager.modes = {
  'highlight': 'highlight',
  'index': 'index'
}

module.exports = ModeManager
