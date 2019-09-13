const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
const ModeManager = require('./ModeManager')
const Sidebar = require('./Sidebar')
const Events = require('./Events')
const GroupSelector = require('./GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const MappingStudyManager = require('./MappingStudyManager')
const CodingManager = require('./CodingManager')
const HypothesisClientManager = require('../storage/hypothesis/HypothesisClientManager')
const Neo4JClientManager = require('../storage/neo4j/Neo4JClientManager')
const LocalStorageManager = require('../storage/local/LocalStorageManager')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')
const Alerts = require('../utils/Alerts')

const HighlightAndGoToolset = require('../specific/slrDataExtraction/HighlightAndGoToolset')

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    console.debug('Initializing content script manager')
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      window.abwa.sidebar = new Sidebar()
      window.abwa.sidebar.init(() => {
        this.loadStorage((err) => {
          if (err) {
            Alerts.errorAlert({text: 'Unable to load annotation storage. Error: ' + err.message})
          } else {
            window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
            window.abwa.annotationBasedInitializer.init(() => {
              window.abwa.groupSelector = new GroupSelector()
              window.abwa.groupSelector.init((err) => {
                if (err) {
                  this.reloadToolset()
                } else {
                  // Reload for first time the content by group
                  this.reloadContentByGroup(() => {
                    // Initialize listener for group change to reload the content
                    this.initListenerForGroupChange()
                    // Set status as initialized
                    this.status = ContentScriptManager.status.initialized
                    console.debug('Initialized content script manager')
                  })
                }
              })
            })
          }
        })
      })
    })
  }

  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(Events.groupChanged, this.events.groupChangedEvent, false)
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
    return () => {
      this.reloadContentByGroup()
    }
  }

  reloadContentByGroup (callback) {
    this.reloadMappingStudyManager(() => {
      this.reloadModeManager(() => {
        this.reloadContentAnnotator(() => {
          this.reloadCodingManager(() => {
            this.reloadToolset(() => {
              if (_.isFunction(callback)) {
                callback()
              }
            })
          })
        })
      })
    })
  }

  reloadModeManager (callback) {
    this.destroyModeManager()
    window.abwa.modeManager = new ModeManager(ModeManager.modes.dataextraction)
    window.abwa.modeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadToolset (callback) {
    this.destroyToolset()
    window.abwa.toolset = new HighlightAndGoToolset()
    window.abwa.toolset.init()
    if (_.isFunction(callback)) {
      callback()
    }
  }

  destroyToolset () {
    if (window.abwa.toolset) {
      window.abwa.toolset.destroy()
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
    console.debug('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyContentAnnotator(() => {
        this.destroyModeManager(() => {
          window.abwa.groupSelector.destroy(() => {
            window.abwa.sidebar.destroy(() => {
              window.abwa.storageManager.destroy(() => {
                this.status = ContentScriptManager.status.notInitialized
                console.debug('Destroyed content script manager')
                if (_.isFunction(callback)) {
                  callback()
                }
              })
            })
          })
        })
      })
      document.removeEventListener(Events.groupChanged, this.events.groupChangedEvent)
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

  loadStorage (callback) {
    chrome.runtime.sendMessage({scope: 'storage', cmd: 'getSelectedStorage'}, ({storage}) => {
      if (storage === 'hypothesis') {
        // Hypothesis
        window.abwa.storageManager = new HypothesisClientManager()
      } else if (storage === 'localStorage') {
        // Local storage
        window.abwa.storageManager = new LocalStorageManager()
      } else if (storage === 'neo4j') {
        window.abwa.storageManager = new Neo4JClientManager()
      } else {
        // By default it is selected Hypothes.is
        window.abwa.storageManager = new HypothesisClientManager()
      }
      window.abwa.storageManager.init((err) => {
        if (err) {
          Alerts.errorAlert({text: 'Unable to initialize storage manager. Error: ' + err.message + '. ' +
              'Please reload webpage and try again.'})
        } else {
          window.abwa.storageManager.isLoggedIn((err, isLoggedIn) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (isLoggedIn) {
                if (_.isFunction(callback)) {
                  callback()
                }
              } else {
                window.abwa.storageManager.logIn((err) => {
                  if (err) {
                    callback(err)
                  } else {
                    if (_.isFunction(callback)) {
                      callback()
                    }
                  }
                })
              }
            }
          })
        }
      })
    })
  }
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

module.exports = ContentScriptManager
