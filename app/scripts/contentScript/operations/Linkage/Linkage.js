const DOM = require('../../../utils/DOM')
const DOMTextUtils = require('../../../utils/DOMTextUtils')
const $ = require('jquery')
const _ = require('lodash')

const retryIntervalInSeconds = 2

class Linkage {
  constructor (annotation) {
    this.annotation = annotation
    this.targetCheckingInterval = null
    this.targetNode = null
  }

  load (callback) {
    this.whenTarget((node) => {
      // Wrap the annotated text only, not the entire node
      this.targetNode = DOMTextUtils.highlightContent(this.annotation.target[0].selector, 'linkage', this.annotation.id, {})
      $(this.targetNode).wrap('<a href="' + this.annotation.text + '" target="_blank"></a>')
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  /**
   * Executes a callback when a target is found in the DOM
   * @param callback - The callback that handles the when element is found.
   */
  whenTarget (callback) {
    this.targetCheckingInterval = setInterval(() => {
      console.debug(this)
      let nodeElement = DOM.searchElementByTarget(this.annotation.target[0])
      if (nodeElement) {
        clearInterval(this.targetCheckingInterval)
        console.debug('Target element found')
        callback(nodeElement)
      } else {
        console.debug('Target not found. Trying in %s seconds', retryIntervalInSeconds)
      }
    }, retryIntervalInSeconds * 1000)
  }

  destroy () {
    // Remove interval is element is pending to be found
    if (this.targetCheckingInterval) {
      clearInterval(this.targetCheckingInterval)
    }
    if (this.targetNode) {
      $(this.targetNode).unwrap()
      DOMTextUtils.unHighlightById(this.annotation.id)
    }
  }
}

module.exports = Linkage
