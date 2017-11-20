class Popup {
  constructor () {
    this.activated = false
  }

  deactivate () {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.update(tabs[0].id, {url: tabs[0].url})
      chrome.pageAction.setIcon({tabId: tabs[0].id, path: 'images/icon-38-bw.png'})
      this.activated = false
    })
  }

  activate () {
    this.activated = true
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'initContentScript'}, (response) => {
        chrome.pageAction.setIcon({tabId: tabs[0].id, path: 'images/icon-38.png'})
      })
    })
  }
}

module.exports = Popup
