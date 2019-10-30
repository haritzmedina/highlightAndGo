const axios = require('axios')
const _ = require('lodash')
const $ = require('jquery')

class Toolset {
  constructor () {
    this.page = chrome.extension.getURL('pages/sidebar/toolset.html')
  }

  init (callback) {
    axios.get(this.page).then((response) => {
      // Insert toolset container
      this.sidebarContainer = document.querySelector('#abwaSidebarContainer')
      // Insert after group selector
      this.groupSelector = this.sidebarContainer.querySelector('#groupSelectorContainer')
      this.groupSelector.insertAdjacentHTML('beforebegin', response.data)
      // Get toolset container
      this.toolsetContainer = this.sidebarContainer.querySelector('#toolset')
      this.toolsetHeader = this.toolsetContainer.querySelector('#toolsetHeader')
      this.toolsetBody = this.sidebarContainer.querySelector('#toolsetBody')
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  /**
   * Show toolset in sidebar
   */
  show () {
    // Toolset aria-hidden is false
    this.toolsetContainer.setAttribute('aria-hidden', 'false')
  }

  /**
   * Hide toolset in sidebar
   */
  hide () {
    // Toolset aria-hidden is true
    this.toolsetContainer.setAttribute('aria-hidden', 'true')
  }

  destroy () {
    // TODO Remove sidebar container
    $('#toolset').remove() // TODO Don't use jquery
  }
}

module.exports = Toolset
