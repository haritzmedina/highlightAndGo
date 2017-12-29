const Linkage = require('./operations/Linkage/Linkage')
const Popup = require('./operations/Popup/Popup')
const _ = require('lodash')

class AugmentationManager {
  constructor () {
    this.augmentedElements = []
  }

  init (callback) {
    this.retrieveAnnotations(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroy () {
    // For each augmentated element
    for (let i = 0; i < this.augmentedElements.length; i++) {
      this.augmentedElements[i].destroy()
    }
  }

  retrieveAnnotations (callback) {
    // Load hypothesis annotations for current page
    this.loadHypothesisAnnotations((err, annotations) => {
      if (err) {
        console.error('Unable to load annotations')
      } else {
        console.debug(annotations)
        // Apply operations for annotations
        annotations.forEach(annotation => {
          this.applyOperation(annotation)
        })
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  loadHypothesisAnnotations (callback) {
    if (window.abwa.hypothesisClientManager) {
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({uri: window.location.href, group: window.abwa.groupSelector.currentGroup.id}, callback)
    }
  }

  applyOperation (annotation) {
    // TODO Retrieve from annotation the operation to be done (in tags)
    // TODO Retrieve the functionality required to apply the operation
    // TODO Apply the operation for the targeted content
    // If current annotation has a supported augmentation, apply it and add to augmented elements
    let augmentedElement = null
    if (this.includesTag(annotation.tags, 'popup')) {
      augmentedElement = new Popup(annotation)
      augmentedElement.load()
      this.augmentedElements.push(augmentedElement)
    } else if (this.includesTag(annotation.tags, 'linkage')) {
      augmentedElement = new Linkage(annotation)
      augmentedElement.load()
      this.augmentedElements.push(augmentedElement)
    }
  }

  includesTag (array, tag) {
    for (let i = 0; i < array.length; i++) {
      if (array[i].toLowerCase() === tag.toLowerCase()) {
        return true
      }
    }
    return false
  }
}

module.exports = AugmentationManager
