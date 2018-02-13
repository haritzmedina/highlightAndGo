const $ = require('jquery')
const _ = require('lodash')

class Sidebar {
  init (callback) {
    this.initSidebarStructure(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initSidebarStructure (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/sidebar.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('body').append($.parseHTML(html))
      // Initialize sidebar labels
      this.initSidebarLabels()
      // Initialize sidebar toggle button
      this.initSidebarButton()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initSidebarLabels () {}

  initSidebarButton () {
    let sidebarButton = document.querySelector('#abwaSidebarButton')
    sidebarButton.addEventListener('click', () => {
      this.toggleSidebar()
    })
  }

  toggleSidebar () {
    let sidebarButton = document.querySelector('#abwaSidebarButton')
    sidebarButton.dataset.toggled = sidebarButton.dataset.toggled !== 'true'
    document.documentElement.dataset.sidebarShown = sidebarButton.dataset.toggled
    document.querySelector('#abwaSidebarContainer').dataset.shown = sidebarButton.dataset.toggled
  }

  openSidebar () {
    let sidebarButton = document.querySelector('#abwaSidebarButton')
    sidebarButton.dataset.toggled = 'true'
    document.documentElement.dataset.sidebarShown = sidebarButton.dataset.toggled
    document.querySelector('#abwaSidebarContainer').dataset.shown = sidebarButton.dataset.toggled
  }

  closeSidebar () {
    let sidebarButton = document.querySelector('#abwaSidebarButton')
    sidebarButton.dataset.toggled = 'false'
    document.documentElement.dataset.sidebarShown = sidebarButton.dataset.toggled
    document.querySelector('#abwaSidebarContainer').dataset.shown = sidebarButton.dataset.toggled
  }

  destroy (callback) {
    $('#abwaSidebarWrapper').remove()
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = Sidebar
