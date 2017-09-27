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
}

module.exports = DOM
