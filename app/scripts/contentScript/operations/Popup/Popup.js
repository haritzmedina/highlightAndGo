const DOM = require('../../../utils/DOM')
const DOMTextUtils = require('../../../utils/DOMTextUtils')
const $ = require('jquery')
require('qtip2')

const retryIntervalInSeconds = 2

class Popup {
  constructor (annotation) {
    this.annotation = annotation
  }

  load (callback) {
    this.whenTarget((node) => {
      // Wrap the annotated text only, not the entire node
      let wrappedNodes = DOMTextUtils.highlightContent(this.annotation.target[0].selector, 'popupHighlight', this.annotation.id, {})
      wrappedNodes.forEach(wrappedNode => {
        $(wrappedNode).qtip({ // Grab some elements to apply the tooltip to
          content: {
            text: this.annotation.text, // TODO Markdown
            button: 'Close'
          },
          show: {
            event: 'click'
          },
          hide: {
            event: 'unfocus'
          },
          position: {
            my: 'bottom center',
            at: 'top center'
          },
          style: {
            classes: 'qtip-light qtip-rounded'
          }
        })
      })
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

module.exports = Popup
