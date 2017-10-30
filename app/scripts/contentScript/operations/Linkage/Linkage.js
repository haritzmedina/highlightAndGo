const DOM = require('../../../utils/DOM')
const DOMTextUtils = require('../../../utils/DOMTextUtils')
const $ = require('jquery')

const retryIntervalInSeconds = 2

class Linkage {
  constructor (annotation) {
    this.annotation = annotation
  }

  load (callback) {
    this.whenTarget((node) => {
      // Wrap the annotated text only, not the entire node
      let wrappedNodes = DOMTextUtils.highlightContent(this.annotation.target[0].selector, 'linkage', this.annotation.id, {})
      $(wrappedNodes).wrap('<a href="' + this.annotation.text + '" target="_blank"></a>')
    })
  }

  /**
   * Executes a callback when a target is found in the DOM
   * @param callback - The callback that handles the when element is found.
   */
  whenTarget (callback) {
    let interval = setInterval(() => {
      console.debug(this)
      let nodeElement = DOM.searchElementByTarget(this.annotation.target[0])
      if (nodeElement) {
        clearInterval(interval)
        console.debug('Target element found')
        callback(nodeElement)
      } else {
        console.debug('Target not found. Trying in %s seconds', retryIntervalInSeconds)
      }
    }, retryIntervalInSeconds * 1000)
  }
}

module.exports = Linkage
