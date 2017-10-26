const Modes = require('./background/Modes')
const EditManager = require('./contentScript/EditManager')
const ViewManager = require('./contentScript/ViewManager')
const AnnotatorManager = require('./contentScript/AnnotatorManager')

const AnnotationBasedInitializer = require('./contentScript/AnnotationBasedInitializer')

const HypothesisClient = require('./hypothesis/HypothesisClient')
const LanguageUtils = require('./utils/LanguageUtils')

class ContentScript {
  constructor () {
    this.editManager = null
    this.viewManager = null
    this.annotatorManager = null

    this.annotationBasedInitializer = null

    this.hypothesisClient = null
  }

  init () {
    this.annotationBasedInitializer = new AnnotationBasedInitializer()
    // Initialize hypothesis client
    this.initializeHypothesisClient(() => {
      // Check if any annotation id is a hash parameter
      let hashParams = window.location.hash.substr(1).split('&')
      hashParams.forEach((hashParam) => {
        let result = hashParam.match(/annotations:((\w+(,|))+)/)
        if (result) {
          let annotationIDs = result[1].split(',').filter(Boolean) // Filter empty strings
          this.annotationBasedInitializer.tryToInitializeModeByAnnotations(annotationIDs, (err) => {
            // If the annotations in hash parameter don't provide an auto-initialization mode, use the stored/default one
            if (err) {
              // Get current mode and call the manager of this mode
              chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentMode'}, (currentMode) => {
                console.debug(currentMode)
                this.initializeMode(currentMode.id)
              })
            }
          })
        } else {
          // Get current mode and call the manager of this mode
          chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentMode'}, (currentMode) => {
            console.debug(currentMode)
            this.initializeMode(currentMode.id)
          })
        }
      })
    })
  }

  initializeHypothesisClient (callback) {
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      this.hypothesisClient = new HypothesisClient(token)
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
    })
  }

  initializeMode (modeId, callback) {
    if (modeId === Modes.original.id) {
      // Nothing to do
    } else if (modeId === Modes.edit.id) {
      // Call edit content script
      this.editManager = new EditManager()
      this.editManager.init(callback)
    } else if (modeId === Modes.view.id) {
      // Call edit content script
      this.viewManager = new ViewManager()
      this.viewManager.init(callback)
    } else if (modeId === Modes.annotation.id) {
      this.annotatorManager = new AnnotatorManager()
      this.annotatorManager.init(callback)
    }
  }
}

window.addEventListener('load', () => {
  window.contentScript = new ContentScript()
  window.contentScript.init()
})
