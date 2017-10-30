const Modes = require('../background/Modes')
const AnnotatorMenu = require('./AnnotatorMenu')

class ModesMenu {
  init () {
    // Retrieve current mode
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentMode'}, (mode) => {
      // Remove mode active tag for everybody
      let buttons = document.querySelectorAll('.modeSwitcherButton')
      buttons.forEach(button => {
        button.setAttribute('aria-pressed', 'false')
      })
      console.debug('Current mode:')
      console.debug(mode)
      // Add active element
      let activeButton = document.querySelector('#' + mode.id)
      activeButton.setAttribute('aria-pressed', 'true')
      this.initializeSubMenu(mode)
      this.createEventListeners()
    })
  }

  createEventListeners () {
    // Add on click event listeners
    let buttons = document.querySelectorAll('.modeSwitcherButton[aria-pressed="false"]')
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          scope: 'extension',
          cmd: 'setMode',
          params: {mode: Modes[button.id], reload: true}
        }, (done) => {
          console.log(done)
          if (done) {
            console.log('Switched to mode %s', button.id)
            window.close()
          }
        })
      })
    })
  }

  initializeSubMenu (mode) {
    console.log(mode)
    if (mode.id === Modes.annotation.id) {
      let annotatorMenu = new AnnotatorMenu()
      annotatorMenu.init()
    }
  }
}

module.exports = ModesMenu
