const _ = require('lodash')
const Config = require('../Config')
const TagManager = require('./TagManager')
const UserFilter = require('./UserFilter')

class DataExtractionManager {
  constructor () {
    this.mode = DataExtractionManager.modes.mapping
  }

  init (callback) {
    console.debug('Initializing data extraction manager')
    // Get classification scheme
    /* this.reloadTagsManager(Config.slrDataExtraction, () => {
      this.reloadContentAnnotator(Config.slrDataExtraction, () => {
        this.reloadUserFilter(Config.slrDataExtraction, () => {
          this.reloadSpecificContentManager(Config.slrDataExtraction)
        })
      })
    }) */
    if (_.isFunction(callback)) {
      callback()
    }
    console.debug('Initialized data extraction manager')
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
  mapping: 'mapping',
  checking: 'checking'
}

module.exports = DataExtractionManager
