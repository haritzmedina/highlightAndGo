const $ = require('jquery')
const DataUtils = require('./DataUtils')

class DOM {
  static searchElementByTarget (target) {
    // Check if current page corresponds to target source
    let currentLocation = location.href.replace(location.hash, '')
    if (target.source.includes(currentLocation)) {
      let selectors = target.selector
      // Use the best selector
      let element = null
      for (let i = 0; i < selectors.length && element === null; i++) {
        let selector = selectors[i]
        if (selector.type === 'FragmentSelector') {
          element = document.querySelector('#' + selector.value)
        }
        /* else if(selector.type==='RangeSelector'){
         console.log(selector.value);
         element = document.evaluate('//body'+selector.value, document, null, XPathResult.ANY_TYPE, null);
         } */
      }
      return element
    } else {
      throw new Error('Current website is not same as target source')
    }
  }

  /**
   *
   * @param callSettings
   * @param querySelector
   * @param callback
   */
  static scrapElement (callSettings, querySelector, callback) {
    $.ajax(callSettings).done((resultString) => {
      let tempWrapper = document.createElement('div')
      tempWrapper.innerHTML = resultString
      callback(null, tempWrapper.querySelectorAll(querySelector))
    }).fail((error) => {
      callback(error)
    })
  }

  /**
   * Retrieve nodes between two nodes in the DOM tree (they are not in order)
   * @param startNode
   * @param endNode
   * @returns {*} A list of nodes
   */
  static getNodesBetween (startNode, endNode, commonParent) {
    // startNode and endNode is the same
    if (startNode === endNode) {
      return []
    }
    // startNode is child of endNode
    if ($.contains(endNode, startNode)) {
      return []
    }
    // endNode is child of startNode
    if ($.contains(startNode, endNode)) {
      return []
    }
    // startNode and endNode are in different subtrees
    let nodesBetween = []
    let startNodeParentIterator = startNode
    while (startNodeParentIterator.parentElement !== commonParent) {
      // Next elements
      nodesBetween = nodesBetween.concat(DOM.getNextSiblings(startNodeParentIterator))
      // Iterator
      startNodeParentIterator = startNodeParentIterator.parentElement
    }
    let startNext = DOM.getNextSiblings(startNodeParentIterator)
    // End to init
    let endNodeParentIterator = endNode
    while (endNodeParentIterator.parentElement !== commonParent) {
      // Previous elements
      nodesBetween = nodesBetween.concat(DOM.getPreviousSiblings(endNodeParentIterator))
      // Iterator
      endNodeParentIterator = endNodeParentIterator.parentElement
    }
    let endPrevious = DOM.getPreviousSiblings(endNodeParentIterator)
    let intersection = DataUtils.intersectionNonEqual(startNext, endPrevious, (a, b) => {
      if (a.nodeType === b.nodeType) {
        if (a.nodeType === 1) {
          return a.outerHTML === b.outerHTML
        } else {
          return a.nodeValue === b.nodeValue
        }
      } else {
        return false
      }
    })
    nodesBetween = nodesBetween.concat(intersection)
    return nodesBetween
  }

  static getNextSiblings (currentNode) {
    let iterator = currentNode
    let siblings = []
    while (iterator.nextSibling !== null) {
      siblings.push(iterator.nextSibling)
      iterator = iterator.nextSibling
    }
    return siblings
  }

  static getPreviousSiblings (currentNode) {
    let iterator = currentNode
    let siblings = []
    while (iterator.previousSibling !== null) {
      siblings.push(iterator.previousSibling)
      iterator = iterator.previousSibling
    }
    return siblings
  }

  static getParentNodeWithId (elem) {
    return $(elem).parents('[id]').get(0).id
  }
}

module.exports = DOM
