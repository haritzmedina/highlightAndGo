const DOM = require('../../../utils/DOM')
const $ = require('jquery')
require('qtip2')
const domAnchorTextQuote = require('dom-anchor-text-quote')

const retryIntervalInSeconds = 2

class Popup {
  constructor (annotation) {
    this.annotation = annotation
  }

  load (callback) {
    this.whenTarget((node) => {
      // Wrap the annotated text only, not the entire node
      let wrappedNodes = this.wrapAnnotatedText(node)
      console.log(wrappedNodes)
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
    let range = domAnchorTextQuote.toRange(document.body, this.annotation.target[0].selector[3])
    if (range.startContainer === range.endContainer) {
      let wrapper = document.createElement('mark')
      wrapper.className = 'popupHighlight '
      wrapper.dataset.hypothesisId = this.annotation.id
      wrapper.innerHTML = range.startContainer.nodeValue.slice(range.startOffset, range.endOffset)
      let newStringifiedContent = range.startContainer.nodeValue.slice(0, range.startOffset) + wrapper.outerHTML + range.startContainer.nodeValue.slice(range.endOffset, range.startContainer.nodeValue.length)
      this.replaceContent(range.startContainer, newStringifiedContent)
      /* range.commonAncestorContainer.parentElement.innerHTML =
        range.commonAncestorContainer.parentElement.innerHTML.replace(range.startContainer.nodeValue, range.startContainer.nodeValue.slice(0, range.startOffset) + wrapper.outerHTML + range.startContainer.nodeValue.slice(range.endOffset, range.startContainer.nodeValue.length)) */
    } else {
      // Start node
      let startWrapper = document.createElement('mark')
      startWrapper.className = 'popupHighlight'
      startWrapper.dataset.hypothesisId = this.annotation.id
      startWrapper.dataset.startNode = ''
      startWrapper.innerHTML = range.startContainer.nodeValue.slice(range.startOffset, range.startContainer.nodeValue.length)
      let nonHighlightedText = range.startContainer.nodeValue.slice(0, range.startOffset)
      this.replaceContent(range.startContainer, nonHighlightedText + startWrapper.outerHTML)
      // End node
      range = domAnchorTextQuote.toRange(document.body, this.annotation.target[0].selector[3])
      let endWrapper = document.createElement('mark')
      endWrapper.className = 'popupHighlight'
      endWrapper.dataset.hypothesisId = this.annotation.id
      endWrapper.dataset.endNode = ''
      endWrapper.innerHTML = range.endContainer.nodeValue.slice(0, range.endOffset)
      nonHighlightedText = range.endContainer.nodeValue.slice(range.endOffset, range.endContainer.nodeValue.length)
      this.replaceContent(range.endContainer, endWrapper.outerHTML + nonHighlightedText)
      // Nodes between
      let startNode = range.commonAncestorContainer.querySelector('[data-hypothesis-id="' + this.annotation.id + '"][data-start-node]')
      let endNode = range.commonAncestorContainer.querySelector('[data-hypothesis-id="' + this.annotation.id + '"][data-end-node]')
      let nodesBetween = DOM.getNodesBetween(startNode, endNode, range.commonAncestorContainer)
      nodesBetween.forEach(nodeBetween => {
        if (nodeBetween.nodeType === 1) {
          nodeBetween.className += ' popupHighlight'
          nodeBetween.dataset.hypothesisId = this.annotation.id
        } else {
          let betweenWrapper = document.createElement('mark')
          betweenWrapper.className = 'popupHighlight'
          betweenWrapper.dataset.hypothesisId = this.annotation.id
          betweenWrapper.innerHTML = nodeBetween.nodeValue
          nodeBetween.replaceWith(betweenWrapper)
        }
      })
    }
    return document.querySelectorAll('[data-hypothesis-id=\'' + this.annotation.id + '\']')
  }

  replaceContent (oldNode, newNode) {
    let span = document.createElement('span')
    span.innerHTML = newNode
    oldNode.replaceWith(span)
  }
}

module.exports = Popup
