// Enable chromereload by uncommenting this line:
import 'chromereload/devonly'

chrome.runtime.onInstalled.addListener((details) => {
  console.log('previousVersion', details.previousVersion)
})

chrome.tabs.onUpdated.addListener((tabId) => {
  chrome.pageAction.show(tabId)
})

<<<<<<< HEAD
console.log(`'Allo 'Allo! Event Page for Page Action`)

console.log('Hey')
=======
const HypothesisManager = require('./background/HypothesisManager')
const ModesManager = require('./background/ModesManager')
const SelectedAnnotatorManager = require('./background/SelectedAnnotatorManager')

class Background {
  constructor () {
    this.hypothesisManager = null
    this.modesManager = null
  }

  init () {
    // Initialize hypothesis manager
    this.hypothesisManager = new HypothesisManager()
    this.hypothesisManager.init()

    // Initialize modes manager
    this.modesManager = new ModesManager()
    this.modesManager.init()

    // Initialize annotator manager
    this.selectedAnnotatorManager = new SelectedAnnotatorManager()
    this.selectedAnnotatorManager.init()
  }
}

window.background = new Background()
window.background.init()
>>>>>>> develop
