const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
const ModeManager = require('./ModeManager')
const Sidebar = require('./Sidebar')
const GroupSelector = require('./GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const DataExtractionManager = require('./DataExtractionManager')
const CodeBookDevelopmentManager = require('./CodeBookDevelopmentManager')
const Events = require('./Events')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')

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
                window.abwa.modeManager = new ModeManager()
                window.abwa.modeManager.init(() => {
                  // Reload for first time the content by group
                  this.reloadContentByGroup()
                  // Initialize listener for group change to reload the content
                  this.initListenerForGroupChange()
                  // Initialize listener for mode change
                  this.initListenerForModeChange()
                  this.status = ContentScriptManager.status.initialized
                  console.log('Initialized content script manager')
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

  initListenerForModeChange () {
    this.events.modeChangeEvent = this.modeChangedEventHandlerCreator()
    document.addEventListener(Events.modeChanged, this.events.modeChangeEvent, false)
  }

  reloadModeChange () {
    this.destroyCodeBookDevelopmentManager()
    this.reloadDataExtractionManager()
  }

  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }

  reloadContentByGroup (callback) {
    this.reloadModeChange()
  }

  reloadCodeBookDevelopmentManager () {
    this.destroyDataExtractionManager()
    this.destroyCodeBookDevelopmentManager()
    window.abwa.codeBookDevelopmentManager = new CodeBookDevelopmentManager()
    window.abwa.codeBookDevelopmentManager.init()
  }

  destroyCodeBookDevelopmentManager () {
    if (_.isObject(window.abwa.codeBookDevelopmentManager)) {
      window.abwa.codeBookDevelopmentManager.destroy()
    }
  }

  modeChangedEventHandlerCreator () {
    return (event) => {
      if (window.abwa.modeManager.mode === ModeManager.modes.dataextraction) {
        this.reloadDataExtractionManager()
      } else if (window.abwa.modeManager.mode === ModeManager.modes.codebook) {
        this.reloadCodeBookDevelopmentManager()
      }
    }
  }

  reloadDataExtractionManager () {
    this.destroyDataExtractionManager()
    this.destroyCodeBookDevelopmentManager()
    window.abwa.dataExtractionManager = new DataExtractionManager()
    window.abwa.dataExtractionManager.init()
  }

  destroyDataExtractionManager () {
    if (_.isObject(window.abwa.dataExtractionManager)) {
      window.abwa.dataExtractionManager.destroy()
    }
  }

  destroy (callback) {
    console.log('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyCodeBookDevelopmentManager()
      this.destroyDataExtractionManager()
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
