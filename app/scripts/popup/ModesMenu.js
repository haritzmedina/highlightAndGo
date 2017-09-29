const Modes = require('../background/Modes')

class ModesMenu {
  init () {
    // Indicar cual es el actual
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentMode'}, (mode) => {
      // Remove mode active tag for everybody
      let buttons = document.querySelectorAll('.modeSwitcherButton')
      buttons.forEach(button => {
        button.dataset.active = 'false'
      })
      console.log(mode)
      // Add active element
      let activeButton = document.querySelector('#' + mode.id)
      activeButton.dataset.active = 'true'
    })
    // Añadir eventos on click
    let buttons = document.querySelectorAll('.modeSwitcherButton')
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          scope: 'extension',
          cmd: 'setMode',
          params: {mode: Modes[button.id]}}, (done) => {
          if (done) {
            console.log('Switched to mode %s', button.id)
            window.close()
          }
        })
      })
    })
  }
}

module.exports = ModesMenu
