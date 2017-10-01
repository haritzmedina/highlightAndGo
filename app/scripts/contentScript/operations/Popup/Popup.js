const DOM = require('../../../utils/DOM')
const $ = require('jquery')
require('qtip2')

const retryIntervalInSeconds = 2

class Popup {
  constructor (annotation) {
    this.annotation = annotation
  }

  load () {
    this.whenTarget((node) => {
      // Wrap the annotated text only, not the entire node
      let wrappedNodes = this.wrapAnnotatedText(node)
      console.log(wrappedNodes)
      $(wrappedNodes).qtip({ // Grab some elements to apply the tooltip to
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
  }

  /**
   * Executes a callback when a target is found in the DOM
   * @param callback - The callback that handles the when element is found.
   */
  whenTarget (callback) {
    let interval = setInterval(() => {
      console.debug(this)
      let nodeElement = DOM.searchElement(this.annotation.target[0])
      if (nodeElement) {
        clearInterval(interval)
        console.debug('Target element found')
        callback(nodeElement)
      } else {
        console.debug('Target not found. Trying in %s seconds', retryIntervalInSeconds)
      }
    }, retryIntervalInSeconds * 1000)
  }

  wrapAnnotatedText (node) {
    let annotatedText = this.annotation.target[0].selector[3]['exact'] // TODO Fix and search the correct selector
    // Range selector
    let rangeSelector = this.annotation.target[0].selector[1]
    let startNode = document.evaluate('/' + this.annotation.target[0].selector[1]['startContainer'], document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    let endNode = document.evaluate('/' + this.annotation.target[0].selector[1]['endContainer'], document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    let nodesBetween = this.getNodesBetween(startNode, endNode)
    let nodesToHighlight = []
    // Highlight all the nodes between
    nodesBetween.forEach((node) => {
      node.className += 'popupHighlight'
      nodesToHighlight.push(node)
    })
    // TODO If no nodes between, take the init point and last point of both nodes
    // Highlight start node from offset position
    let startWrapper = document.createElement('mark')
    startWrapper.className = 'popupHighlight'
    let remarkElementsStart = startNode.innerHTML.substring(rangeSelector.startOffset)
    startWrapper.innerHTML = remarkElementsStart
    startNode.innerHTML = startNode.innerHTML.replace(remarkElementsStart, startWrapper.outerHTML)
    nodesToHighlight.push(startNode.querySelector('.popupHighlight'))
    // Highlight end node to offset position
    let endWrapper = document.createElement('mark')
    endWrapper.className = 'popupHighlight'
    let remarkElementsEnd = endNode.innerHTML.substring(0, endNode.innerHTML.length + endNode.innerText.length - rangeSelector.endOffset)
    endWrapper.innerHTML = remarkElementsEnd
    endNode.innerHTML = endNode.innerHTML.replace(remarkElementsEnd, endWrapper.outerHTML)
    nodesToHighlight.push(endNode.querySelector('.popupHighlight'))
    return nodesToHighlight
  }
}

module.exports = Popup
