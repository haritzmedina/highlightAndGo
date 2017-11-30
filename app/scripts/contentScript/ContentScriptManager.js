const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
const Sidebar = require('./Sidebar')
const TagManager = require('./TagManager')
const GroupSelector = require('./GroupSelector')
const ConfigDecisionHelper = require('./ConfigDecisionHelper')
const AugmentationManager = require('./AugmentationManager')
const HypothesisClientManager = require('./HypothesisClientManager')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')

const SLRDataExtractionContentScript = require('../specific/slrDataExtraction/SLRDataExtractionContentScript')

class ContentScriptManager {
  constructor () {
    this.events = {}
  }

  init () {
    this.loadContentTypeManager(() => {
      window.abwa.hypothesisClientManager = new HypothesisClientManager()
      window.abwa.hypothesisClientManager.init(() => {
        window.abwa.sidebar = new Sidebar()
        window.abwa.sidebar.init(() => {
          window.abwa.groupSelector = new GroupSelector()
          window.abwa.groupSelector.init(() => {
            // Reload for first time the content by group
            this.reloadContentByGroup()
            // Initialize listener for group change to reload the content
            this.initListenerForGroupChange()
          })
        })
      })
    })
  }

  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent, false)
  }

  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }

  reloadContentByGroup (callback) {
    ConfigDecisionHelper.decideWhichConfigApplyToTheGroup(window.abwa.groupSelector.currentGroup, (config) => {
      // If not configuration is found
      if (_.isEmpty(config)) {
        // TODO Inform user no defined configuration found
        console.debug('No supported configuration found for this group')
        this.destroyAugmentationOperations()
        this.destroyTagsManager()
        this.destroyContentAnnotator()
        this.destroySpecificContentManager()
      } else {
        console.debug('Loaded supported configuration %s', config.namespace)
        // Tags manager should go before content annotator, depending on the tags manager, the content annotator can change
        this.reloadTagsManager(config, () => {
          this.reloadContentAnnotator(config, () => {
            this.reloadSpecificContentManager(config)
          })
        })
        this.reloadAugmentationOperations(config)
      }
    })
  }

  reloadContentAnnotator (config, callback) {
    // Destroy current content annotator
    this.destroyContentAnnotator()
    // Create a new content annotator for the current group
    if (config.contentAnnotator === 'text') {
      window.abwa.contentAnnotator = new TextAnnotator()
    } else {
      window.abwa.contentAnnotator = new TextAnnotator() // TODO Depending on the type of annotator
    }
    window.abwa.contentAnnotator.init(callback)
  }

  reloadTagsManager (config, callback) {
    // Destroy current tag manager
    this.destroyTagsManager()
    // Create a new tag manager for the current group
    window.abwa.tagManager = new TagManager(config.namespace, config.tags) // TODO Depending on the type of annotator
    window.abwa.tagManager.init(callback)
  }

  reloadAugmentationOperations (config, callback) {
    // Destroy current augmentation operations
    this.destroyAugmentationOperations()
    // Create augmentation operations for the current group
    window.abwa.augmentationManager = new AugmentationManager(config)
    window.abwa.augmentationManager.init()
  }

  destroyContentAnnotator () {
    // Destroy current content annotator
    if (!_.isEmpty(window.abwa.contentAnnotator)) {
      window.abwa.contentAnnotator.destroy()
    }
  }

  destroyTagsManager () {
    if (!_.isEmpty(window.abwa.tagManager)) {
      window.abwa.tagManager.destroy()
    }
  }

  destroyAugmentationOperations () {
    // Destroy current augmentation operations
    if (!_.isEmpty(window.abwa.augmentationManager)) {
      window.abwa.augmentationManager.destroy()
    }
  }

  destroy () {
    this.destroyAugmentationOperations()
    this.destroyTagsManager()
    this.destroyContentAnnotator()
    window.abwa.groupSelector.destroy(() => {
      window.abwa.sidebar.destroy(() => {
        window.abwa.hypothesisClientManager.destroy()
      })
    })
    document.removeEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent)
  }

  reloadSpecificContentManager (config, callback) {
    // Destroy current specific content manager
    this.destroySpecificContentManager()
    if (config.namespace === 'slr') {
      window.abwa.specificContentManager = new SLRDataExtractionContentScript(config)
      window.abwa.specificContentManager.init()
    }
  }

  destroySpecificContentManager () {
    if (window.abwa.specificContentManager) {
      window.abwa.specificContentManager.destroy()
    }
  }

  loadContentTypeManager (callback) {
    window.abwa.contentTypeManager = new ContentTypeManager()
    window.abwa.contentTypeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }
}

module.exports = ContentScriptManager
