// Enable chromereload by uncommenting this line:
import 'chromereload/devonly'

chrome.runtime.onInstalled.addListener((details) => {
  console.log('previousVersion', details.previousVersion)
})

chrome.tabs.onUpdated.addListener((tabId) => {
  chrome.pageAction.show(tabId)
})

const HypothesisManager = require('./background/HypothesisManager')
const Popup = require('./popup/Popup')

class Background {
  constructor () {
    this.hypothesisManager = null
    this.tabs = {}
  }

  init () {
    // Initialize hypothesis manager
    this.hypothesisManager = new HypothesisManager()
    this.hypothesisManager.init()

    // Initialize page_action event handler
    chrome.pageAction.onClicked.addListener((tab) => {
      if (this.tabs[tab.id]) {
        if (this.tabs[tab.id].activated) {
          this.tabs[tab.id].deactivate()
        } else {
          this.tabs[tab.id].activate()
        }
      } else {
        this.tabs[tab.id] = new Popup()
        this.tabs[tab.id].activate()
      }
    })
    // On tab is reloaded
    chrome.tabs.onUpdated.addListener((tabId) => {
      if (this.tabs[tabId]) {
        if (this.tabs[tabId].activated) {
          this.tabs[tabId].activate()
        }
      }
    })

    // Initialize message manager
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'extension') {
        if (request.cmd === 'whoiam') {
          sendResponse(sender)
        }
      }
    })
  }
}

window.background = new Background()
window.background.init()
