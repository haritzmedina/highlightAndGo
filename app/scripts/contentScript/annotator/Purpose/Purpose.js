const HypothesisClient = require('../../../hypothesis/HypothesisClient')
const $ = require('jquery')
require('bootstrap')

class Purpose {
  constructor () {
    this.hypothesisClient = null
  }

  init () {
    console.debug('Initializing purpose annotator')
    // Create sidebar
    this.initSidebar()
    document.addEventListener('selectionchange', (e) => {
      console.log(e)
    })
  }

  initSidebar () {
    this.initSidebarButton()
    let sidebarURL = chrome.extension.getURL('pages/annotator/Purpose/sidebar.html')
    $.get(sidebarURL, (html) => {
      $('body').append($.parseHTML(html))
      chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
        if (token) {
          // TODO Retrieve groups if user is logged in
          // TODO If logged in, load groups of hypothesis the user is enrolled in
          // TODO Retrieve annotations for url https://*/* and tag prefix purpose:
          // TODO Periodically retrieve annotations and reload layout
        }
      })
    })
  }

  initSidebarButton () {
    let sidebarButton = document.createElement('button')
    sidebarButton.id = 'sidebarButton'
    let iconBar = document.createElement('span')
    iconBar.className = 'sidebarButtonIconBar'
    sidebarButton.appendChild(iconBar.cloneNode(true))
    sidebarButton.appendChild(iconBar.cloneNode(true))
    sidebarButton.appendChild(iconBar.cloneNode(true))
    sidebarButton.dataset.toggled = false
    sidebarButton.addEventListener('click', () => {
      this.toggleSidebar()
    })
    document.body.appendChild(sidebarButton)
  }

  reloadSidebar () {

  }

  toggleSidebar () {
    let sidebarButton = document.querySelector('#sidebarButton')
    sidebarButton.dataset.toggled = sidebarButton.dataset.toggled !== 'true'
    document.documentElement.dataset.sidebarShown = sidebarButton.dataset.toggled
    document.querySelector('#annotatorSidebarContainer').dataset.shown = sidebarButton.dataset.toggled
  }
}

module.exports = Purpose
