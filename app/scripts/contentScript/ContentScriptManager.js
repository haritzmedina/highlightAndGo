const _ = require('lodash')

const Sidebar = require('./Sidebar')
const TagManager = require('./TagManager')
const GroupSelector = require('./GroupSelector')
const ConfigDecisionHelper = require('./ConfigDecisionHelper')
const AugmentationManager = require('./AugmentationManager')
const HypothesisClientManager = require('./HypothesisClientManager')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')

class ContentScriptManager {
  init () {
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
  }

  initListenerForGroupChange () {
    document.addEventListener(GroupSelector.eventGroupChange, (event) => {
      this.reloadContentByGroup()
    })
  }

  reloadContentByGroup () {
    ConfigDecisionHelper.decideWhichConfigApplyToTheGroup(window.abwa.groupSelector.currentGroup, (config) => {
      // If not configuration is found
      if (_.isEmpty(config)) {
        // TODO Inform user no defined configuration
        console.debug('No supported configuration found for this group')
        this.destroyAugmentationOperations()
        this.destroyTagsManager()
        this.destroyContentAnnotator()
      } else {
        console.debug('Loaded supported configuration %s', config.namespace)
        // Tags manager should go before content annotator, depending on the tags manager, the content annotator can change
        this.reloadTagsManager(config, () => {
          this.reloadContentAnnotator(config)
        })
        this.reloadAugmentationOperations(config)
      }
    })
  }

  reloadContentAnnotator (config) {
    // Destroy current content annotator
    this.destroyContentAnnotator()
    // Create a new content annotator for the current group
    if (config.contentAnnotator === 'text') {
      window.abwa.contentAnnotator = new TextAnnotator()
    } else {
      window.abwa.contentAnnotator = new TextAnnotator() // TODO Depending on the type of annotator
    }
    window.abwa.contentAnnotator.init()
  }

  reloadTagsManager (config) {
    // Destroy current tag manager
    this.destroyTagsManager()
    // Create a new tag manager for the current group
    window.abwa.tagManager = new TagManager(config.namespace, config.tags) // TODO Depending on the type of annotator
    window.abwa.tagManager.init()
  }

  reloadAugmentationOperations (config) {
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
}

module.exports = ContentScriptManager
