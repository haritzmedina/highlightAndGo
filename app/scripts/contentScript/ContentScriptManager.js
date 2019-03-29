const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
const ModeManager = require('./ModeManager')
const Sidebar = require('./Sidebar')
const GroupSelector = require('./GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const MappingStudyManager = require('./MappingStudyManager')
const CodingManager = require('./CodingManager')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    console.log('Initializing content script manager')
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      window.abwa.hypothesisClientManager = new HypothesisClientManager()
      window.abwa.hypothesisClientManager.init((err) => {
        if (err) {
          window.abwa.sidebar = new Sidebar()
          window.abwa.sidebar.init(() => {
            window.abwa.groupSelector = new GroupSelector()
            window.abwa.groupSelector.init(() => {

            })
          })
        } else {
          window.abwa.sidebar = new Sidebar()
          window.abwa.sidebar.init(() => {
            window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
            window.abwa.annotationBasedInitializer.init(() => {
              window.abwa.groupSelector = new GroupSelector()
              window.abwa.groupSelector.init(() => {
                // Reload for first time the content by group
                this.reloadContentByGroup(() => {
                  // Initialize listener for group change to reload the content
                  this.initListenerForGroupChange()
                  // Set status as initialized
                  this.status = ContentScriptManager.status.initialized
                  console.debug('Initialized content script manager')
                })
              })
            })
          })
        }
      })
    })
  }

  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent, false)
  }

  reloadMappingStudyManager (callback) {
    this.destroyMappingStudyManager()
    window.abwa.mappingStudyManager = new MappingStudyManager()
    window.abwa.mappingStudyManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyMappingStudyManager () {
    if (window.abwa.mappingStudyManager) {
      window.abwa.mappingStudyManager.destroy()
      window.abwa.mappingStudyManager = null
    }
  }

  reloadCodingManager (callback) {
    this.destroyCodingManager()
    window.abwa.codingManager = new CodingManager()
    window.abwa.codingManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyCodingManager () {
    if (window.abwa.codingManager) {
      window.abwa.codingManager.destroy()
      window.abwa.codingManager = null
    }
  }

  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }

  reloadContentByGroup (callback) {
    this.reloadMappingStudyManager(() => {
      this.reloadModeManager(() => {
        this.reloadContentAnnotator(() => {
          this.reloadCodingManager(() => {
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
    // TODO Reload specific content
  }

  reloadModeManager (callback) {
    this.destroyModeManager()
    window.abwa.modeManager = new ModeManager(ModeManager.modes.dataextraction) // TODO Set by default the data extraction mode
    window.abwa.modeManager.init()
    if (_.isFunction(callback)) {
      callback()
    }
  }

  destroyModeManager (callback) {
    if (window.abwa.modeManager) {
      window.abwa.modeManager.destroy(callback)
    }
  }

  destroyContentAnnotator (callback) {
    // Destroy current content annotator
    if (!_.isEmpty(window.abwa.contentAnnotator)) {
      window.abwa.contentAnnotator.destroy(callback)
    }
  }

  reloadContentAnnotator (callback) {
    // Destroy current content annotator
    this.destroyContentAnnotator()
    // Create a new content annotator for the current group
    window.abwa.contentAnnotator = new TextAnnotator()
    window.abwa.contentAnnotator.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroy (callback) {
    console.log('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyContentAnnotator(() => {
        this.destroyModeManager(() => {
          window.abwa.groupSelector.destroy(() => {
            window.abwa.sidebar.destroy(() => {
              window.abwa.hypothesisClientManager.destroy(() => {
                this.status = ContentScriptManager.status.notInitialized
                if (_.isFunction(callback)) {
                  callback()
                }
              })
            })
          })
        })
      })
      document.removeEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent)
    })
  }

  loadContentTypeManager (callback) {
    window.abwa.contentTypeManager = new ContentTypeManager()
    window.abwa.contentTypeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyContentTypeManager (callback) {
    if (window.abwa.contentTypeManager) {
      window.abwa.contentTypeManager.destroy(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

module.exports = ContentScriptManager
