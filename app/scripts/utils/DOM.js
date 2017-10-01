const $ = require('jquery')

class DOM {
  static searchElement (target) {
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
   * Retrieve nodes between two nodes in the DOM tree
   * @param startNode
   * @param endNode
   * @returns {*} A list of nodes
   */
  static getNodesBetween (startNode, endNode) {
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
    return $(startNode).nextUntil(endNode).toArray()
  }
}

module.exports = DOM
