// Enable chromereload by uncommenting this line:
import 'chromereload/devonly'

chrome.runtime.onInstalled.addListener((details) => {
  console.log('previousVersion', details.previousVersion)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.pageAction.show(tabId)
})

chrome.tabs.onCreated.addListener((tab) => {
  // Retrieve saved clicked doi element
})

// const HypothesisManager = require('./background/HypothesisManager')
const HypothesisManager = require('./background/HypothesisManager')
const Neo4JManager = require('./background/Neo4JManager')
const StorageManager = require('./background/StorageManager')
const GoogleSheetsManager = require('./background/GoogleSheetsManager')
const DoiManager = require('./background/DoiManager')
const Popup = require('./popup/Popup')

const _ = require('lodash')

class Background {
  constructor () {
    this.hypothesisManager = null
    this.tabs = {}
  }

  init () {
    // Initialize hypothesis manager
    this.hypothesisManager = new HypothesisManager()
    this.hypothesisManager.init()

    // Initialize Neo4J manager
    this.neo4JManager = new Neo4JManager()
    this.neo4JManager.init()

    // Initialize storage manager
    this.storageManager = new StorageManager()
    this.storageManager.init()

    // Initialize google sheets manager
    this.googleSheetsManager = new GoogleSheetsManager()
    this.googleSheetsManager.init()

    // Initialize doi manager
    this.doiManager = new DoiManager()
    this.doiManager.init()

    // Initialize page_action event handler
    chrome.pageAction.onClicked.addListener((tab) => {
      // Do we have access to file to annotate?
      let checkResourceAccess = new Promise((resolve) => {
        if (tab.url.startsWith('file://')) {
          chrome.extension.isAllowedFileSchemeAccess((isAllowedAccess) => {
            if (isAllowedAccess === false) {
              chrome.tabs.create({url: chrome.runtime.getURL('pages/filePermission.html')})
            } else {
              resolve()
            }
          })
        } else {
          resolve()
        }
      })
      checkResourceAccess.then(() => { // Has access permission
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
    })

    // On tab is reloaded
    chrome.tabs.onUpdated.addListener((tabId) => {
      if (this.tabs[tabId]) {
        if (this.tabs[tabId].activated) {
          this.tabs[tabId].activate()
        }
      } else {
        this.tabs[tabId] = new Popup()
      }
    })

    // Initialize message manager
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'extension') {
        if (request.cmd === 'whoiam') {
          sendResponse(sender)
        } else if (request.cmd === 'deactivatePopup') {
          if (!_.isEmpty(this.tabs) && !_.isEmpty(this.tabs[sender.tab.id])) {
            this.tabs[sender.tab.id].deactivate()
          }
          sendResponse(true)
        } else if (request.cmd === 'activatePopup') {
          console.log(this.tabs)
          if (!_.isEmpty(this.tabs) && !_.isEmpty(this.tabs[sender.tab.id])) {
            this.tabs[sender.tab.id].activate()
          }
          sendResponse(true)
        } else if (request.cmd === 'amIActivated') {
          if (this.tabs[sender.tab.id].activated) {
            sendResponse({activated: true})
          } else {
            sendResponse({activated: false})
          }
        }
      }
    })
  }
}

window.background = new Background()
window.background.init()
