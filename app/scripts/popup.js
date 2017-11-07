// Enable chromereload by uncommenting this line:
import 'chromereload/devonly'
import 'bootstrap/dist/js/bootstrap'

class Popup {
  init () {
    this.activateGlobalState()
  }

  activateGlobalState () {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'openGlobalManager'}, (response) => {
        chrome.pageAction.setIcon({tabId: tabs[0].id, path: 'images/icon-38-bw.png'})
        window.close()
      })
    })
  }
}

window.addEventListener('load', (event) => {
  window.popup = new Popup()
  window.popup.init()
})
