const domAnchorTextQuote = require('dom-anchor-text-quote')
const domAnchorTextPosition = require('dom-anchor-text-position')
const xpathRange = require('xpath-range')
const DOM = require('./DOM')
const LanguageUtils = require('./LanguageUtils')
const $ = require('jquery')
const _ = require('lodash')

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
    let range = this.retrieveRange(selectors)
    let nodes = DOM.getLeafNodesInRange(range)
    if (nodes.length > 0) {
      let startNode = nodes.shift()
      if (nodes.length > 0) { // start and end nodes are not the same
        let endNode = nodes.pop()
        let nodesBetween = nodes
        // Start node
        let startWrapper = document.createElement('mark')
        $(startWrapper).addClass(className)
        startWrapper.dataset.annotationId = id
        startWrapper.dataset.startNode = ''
        startWrapper.dataset.highlightClassName = className
        startWrapper.innerText = startNode.nodeValue.slice(range.startOffset, startNode.nodeValue.length)
        let nonHighlightedText = startNode.nodeValue.slice(0, range.startOffset)
        this.replaceContent(startNode, nonHighlightedText + startWrapper.outerHTML)
        // End node
        let endWrapper = document.createElement('mark')
        $(endWrapper).addClass(className)
        endWrapper.dataset.annotationId = id
        endWrapper.dataset.endNode = ''
        endWrapper.dataset.highlightClassName = className
        endWrapper.innerText = endNode.nodeValue.slice(0, range.endOffset)
        nonHighlightedText = endNode.nodeValue.slice(range.endOffset, endNode.nodeValue.length)
        this.replaceContent(endNode, endWrapper.outerHTML + nonHighlightedText)
        // Nodes between
        nodesBetween.forEach(nodeBetween => {
          let leafNodes = this.retrieveLeafNodes(nodeBetween)
          for (let i = 0; i < leafNodes.length; i++) {
            if (leafNodes[i].textContent.length > 0 && (leafNodes[i].parentNode !== endNode && leafNodes[i].parentNode !== startNode)) {
              let wrapper = document.createElement('mark')
              $(wrapper).addClass(className)
              wrapper.dataset.annotationId = id
              wrapper.dataset.endNode = ''
              wrapper.dataset.highlightClassName = className
              $(leafNodes[i]).wrap(wrapper)
            }
          }
        })
      } else {
        let wrapper = document.createElement('mark')
        $(wrapper).addClass(className)
        wrapper.dataset.highlightClassName = className
        wrapper.dataset.annotationId = id
        wrapper.innerHTML = startNode.nodeValue.slice(range.startOffset, range.endOffset)
        let newStringifiedContent = startNode.nodeValue.slice(0, range.startOffset) + wrapper.outerHTML + startNode.nodeValue.slice(range.endOffset, startNode.nodeValue.length)
        DOMTextUtils.replaceContent(startNode, newStringifiedContent)
      }
    }
    return document.querySelectorAll('[data-annotation-id=\'' + id + '\']')
  }

  static retrieveRange (selectors) {
    let fragmentSelector = _.find(selectors, (selector) => { return selector.type === 'FragmentSelector' })
    let textQuoteSelector = _.find(selectors, (selector) => { return selector.type === 'TextQuoteSelector' })
    let textPositionSelector = _.find(selectors, (selector) => { return selector.type === 'TextPositionSelector' })
    let range = null
    if (fragmentSelector) { // It is an element of DOM
      let fragmentElement = document.querySelector('#' + fragmentSelector.value)
      range = DOMTextUtils.tryRetrieveRangeTextSelector(fragmentElement, textQuoteSelector)
    } else if (textQuoteSelector && textPositionSelector) { // It is a text of PDF
      range = DOMTextUtils.tryRetrieveRangeTextSelector(document.body, textQuoteSelector)
    }
    return range
  }

  static tryRetrieveRangeTextSelector (fragmentElement, textQuoteSelector) {
    if (fragmentElement === document) {
      return null
    }
    let range = null
    try {
      range = domAnchorTextQuote.toRange(fragmentElement.parentNode, textQuoteSelector)
    } catch (e) {
      range = DOMTextUtils.tryRetrieveRangeTextSelector(fragmentElement.parentNode, textQuoteSelector)
    }
    return range
  }

  static replaceContent (oldNode, newNode) {
    // Find a better solution which not creates new elements
    let span = document.createElement('span')
    span.innerHTML = newNode
    oldNode.replaceWith(span)
    $(span.childNodes).unwrap()
  }

  static retrieveFirstTextNode (element) {
    if (element.nodeType === Node.TEXT_NODE) {
      return element
    } else {
      if (element.firstChild) {
        return DOMTextUtils.retrieveFirstTextNode(element.firstChild)
      }
    }
  }

  static retrieveLeafNodes (element) {
    let childNodes = []
    if (element.childNodes.length > 0) {
      for (let i = 0; i < element.childNodes.length; i++) {
        let childNode = element.childNodes[i]
        childNodes = childNodes.concat(this.retrieveLeafNodes(childNode))
      }
    } else {
      childNodes = [element]
    }
    return childNodes
  }

  static unHighlightAllContent (className) {
    // Remove highlighted elements
    let highlightElements = document.querySelectorAll('.' + className)
    DOMTextUtils.unHighlightElements(highlightElements)
  }

  static unHighlightElements (highlightElements) {
    if (_.isArray(highlightElements)) {
      highlightElements.forEach((highlightElement) => {
        // If element content is not empty, unwrap maintaining its content
        $(highlightElement.firstChild).unwrap()
      })
    }
  }

  static unHighlightById (id) {
    let highlightElements = document.querySelectorAll('[data-annotation-id=\'' + id + '\']')
    DOMTextUtils.unHighlightElements(highlightElements)
  }
}

module.exports = DOMTextUtils
