const Modes = require('../background/Modes')
const EditManager = require('./EditManager')
const ViewManager = require('./ViewManager')
const AnnotatorManager = require('./AnnotatorManager')
const LanguageUtils = require('../utils/LanguageUtils')

class AnnotationBasedInitializer {
  constructor () {
    this.a = null
  }

  tryToInitializeModeByAnnotations (annotationIDs, callback) {
    if (annotationIDs.length === 0) {
      if (LanguageUtils.isFunction(callback)) {
        callback(new Error('Unable to initialize using the annotations. No annotations detected')) // No annotations send
      }
    } else {
      let promises = []
      annotationIDs.forEach((annotationID) => {
        promises.push(new Promise((resolve) => {
          // Retrieve annotation from hypothesis
          window.contentScript.hypothesisClient.fetchAnnotation(annotationID, (annotation) => {
            resolve(annotation)
          })
        }))
      })
      Promise.all(promises).then((annotations) => {
        // Check if all the annotations initialize the same mode
        let modeIdToInitialize = null
        for (let i = 0; i < annotations.length; i++) {
          let currentAnnotationInitializer = this.retrieveAnnotationInitializer(annotations[i])
          if (currentAnnotationInitializer) {
            if (modeIdToInitialize === null) {
              modeIdToInitialize = currentAnnotationInitializer
            } else if (modeIdToInitialize !== null && modeIdToInitialize !== currentAnnotationInitializer) {
              // Two different initializers, unable to initialize
              callback(new Error('Unable to initialize using the annotations. Two different initializers detected'))
              return
            }
          }
        }
        if (modeIdToInitialize !== null) {
          // Initialize with this initializer and annotations
          this.initializeModeByAnnotations(modeIdToInitialize, annotations, () => {
            console.debug('Mode initialized using annotation')
          })
          callback()
        } else {
          this.initializeModeByAnnotations(Modes.edit.id, annotations, () => {
            console.debug('Hypothesis mode initialized using annotation, not other interpreter were found')
          })
        }
      })
    }
  }

  retrieveAnnotationInitializer (annotation) {
    let modeId = null
    annotation.tags.forEach(tag => {
      let modesKeys = Object.keys(Modes)
      modesKeys.forEach(modesKey => {
        let mode = Modes[modesKey]
        if (mode.initParamTags) {
          mode.initParamTags.forEach(paramTag => {
            if (tag.includes(paramTag)) {
              modeId = mode.id
            }
          })
        }
      })
    })
    return modeId
  }

  initializeModeByAnnotations (modeId, params, callback) {
    if (modeId === Modes.original.id) {
      // Nothing to do
    } else if (modeId === Modes.edit.id) {
      this.updateMode(Modes.edit)
      // Call edit content script
      this.editManager = new EditManager()
      this.editManager.init(callback)
    } else if (modeId === Modes.view.id) {
      this.updateMode(Modes.view)
      // Call view content script
      this.viewManager = new ViewManager()
      this.viewManager.init(callback)
    } else if (modeId === Modes.annotation.id) {
      this.updateMode(Modes.annotation)
      // Call annotation content script
      this.annotatorManager = new AnnotatorManager()
      this.annotatorManager.initializeByAnnotations(params, callback)
    }
  }

  updateMode (mode) {
    chrome.runtime.sendMessage({
      scope: 'extension',
      cmd: 'setMode',
      params: {mode: mode}}, (done) => {
      console.log(done)
      if (done) {
        console.log('Switched to mode %s', mode.id)
        window.close()
      }
    })
  }
}

module.exports = AnnotationBasedInitializer
