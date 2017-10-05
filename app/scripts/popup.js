// Enable chromereload by uncommenting this line:
import 'chromereload/devonly'
import 'bootstrap/dist/js/bootstrap'

const ModesMenu = require('./popup/ModesMenu')

class Popup {
  constructor () {
    this.modesMenu = null
  }

  init () {
    this.modesMenu = new ModesMenu()
    this.modesMenu.init()
  }
}

window.addEventListener('load', (event) => {
  window.popup = new Popup()
  window.popup.init()
})
