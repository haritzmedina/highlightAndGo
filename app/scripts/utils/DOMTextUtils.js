const domAnchorTextQuote = require('dom-anchor-text-quote')
const domAnchorTextPosition = require('dom-anchor-text-position')
const xpathRange = require('xpath-range')
const DOM = require('./DOM')
const LanguageUtils = require('./LanguageUtils')
const $ = require('jquery')

class DOMTextUtils {
  static getFragmentSelector (range) {
    if (range.commonAncestorContainer) {
      let parentId = DOM.getParentNodeWithId(range.commonAncestorContainer)
      if (parentId) {
        return {
          'conformsTo': 'https://tools.ietf.org/html/rfc3236',
          'type': 'FragmentSelector',
          'value': parentId
        }
      }
    }
  }

  static getRangeSelector (range) {
    let rangeSelector = xpathRange.fromRange(range)
    LanguageUtils.renameObjectKey(rangeSelector, 'start', 'startContainer')
    LanguageUtils.renameObjectKey(rangeSelector, 'end', 'endContainer')
    rangeSelector['type'] = 'RangeSelector'
    return rangeSelector
  }

  static getTextPositionSelector (range) {
    let textPositionSelector = domAnchorTextPosition.fromRange(document.body, range)
    textPositionSelector['type'] = 'TextPositionSelector'
    return textPositionSelector
  }

  static getTextQuoteSelector (range) {
    let textQuoteSelector = domAnchorTextQuote.fromRange(document.body, range)
    textQuoteSelector['type'] = 'TextQuoteSelector'
    return textQuoteSelector
  }

  /**
   * Highlights the content which are pointed by the selectors in the DOM with corresponding class name, id and data
   * @param selectors
   * @param className
   * @param id
   * @param data
   * @returns {NodeList}
   * @throws TypeError
   */
  static highlightContent (selectors, className, id, data) {
    let range = domAnchorTextQuote.toRange(document.body, selectors[3])
    if (range.startContainer === range.endContainer) {
      let wrapper = document.createElement('mark')
      $(wrapper).addClass(className)
      wrapper.dataset.annotationId = id
      wrapper.innerHTML = range.startContainer.nodeValue.slice(range.startOffset, range.endOffset)
      let newStringifiedContent = range.startContainer.nodeValue.slice(0, range.startOffset) + wrapper.outerHTML + range.startContainer.nodeValue.slice(range.endOffset, range.startContainer.nodeValue.length)
      DOMTextUtils.replaceContent(range.startContainer, newStringifiedContent)
    } else {
      // Start node
      let startWrapper = document.createElement('mark')
      $(startWrapper).addClass(className)
      startWrapper.dataset.annotationId = id
      startWrapper.dataset.startNode = ''
      startWrapper.innerHTML = range.startContainer.nodeValue.slice(range.startOffset, range.startContainer.nodeValue.length)
      let nonHighlightedText = range.startContainer.nodeValue.slice(0, range.startOffset)
      this.replaceContent(range.startContainer, nonHighlightedText + startWrapper.outerHTML)
      // End node
      range = domAnchorTextQuote.toRange(document.body, selectors[3])
      let endWrapper = document.createElement('mark')
      $(endWrapper).addClass(className)
      endWrapper.dataset.annotationId = id
      endWrapper.dataset.endNode = ''
      endWrapper.innerHTML = range.endContainer.nodeValue.slice(0, range.endOffset)
      nonHighlightedText = range.endContainer.nodeValue.slice(range.endOffset, range.endContainer.nodeValue.length)
      this.replaceContent(range.endContainer, endWrapper.outerHTML + nonHighlightedText)
      // Nodes between
      let startNode = range.commonAncestorContainer.querySelector('[data-annotation-id="' + id + '"][data-start-node]')
      let endNode = range.commonAncestorContainer.querySelector('[data-annotation-id="' + id + '"][data-end-node]')
      let nodesBetween = DOM.getNodesBetween(startNode, endNode, range.commonAncestorContainer)
      nodesBetween.forEach(nodeBetween => {
        if (nodeBetween.nodeType === 1) {
          $(nodeBetween).addClass(className)
          nodeBetween.dataset.annotationId = id
        } else if (nodeBetween.nodeType === 8) { // Node type comment
        } else {
          let betweenWrapper = document.createElement('mark')
          $(betweenWrapper).addClass(className)
          betweenWrapper.dataset.annotationId = id
          betweenWrapper.innerHTML = nodeBetween.nodeValue
          nodeBetween.replaceWith(betweenWrapper)
        }
      })
    }
    return document.querySelectorAll('[data-annotation-id=\'' + id + '\']')
  }

  static replaceContent (oldNode, newNode) {
    // TODO Find a better solution which not creates new elements
    let span = document.createElement('span')
    span.className = 'highlightHelper'
    span.innerHTML = newNode
    oldNode.replaceWith(span)
  }

  static unHighlightAllContent (className) {
    // Remove highlighted elements
    let highlightElements = document.querySelectorAll('.' + className)
    highlightElements.forEach((highlightElement) => {
      if (highlightElement.tagName === 'MARK') {
        if (highlightElement.textContent.length === 0) {
          // If element content is empty, just remove the mark
          $(highlightElement).remove()
        } else {
          // If element content is not empty, unwrap maintaining its content
          $(highlightElement.firstChild).unwrap()
        }
      } else {
        // Remove the highlight class
        $(highlightElement).removeClass(className)
      }
    })
    //  Remove highlight helpers maintaining its content
    let highlightHelpers = document.querySelectorAll('.highlightHelper')
    highlightHelpers.forEach(highlightHelper => {
      $(highlightHelper.firstChild).unwrap()
    })
  }
}

module.exports = DOMTextUtils
