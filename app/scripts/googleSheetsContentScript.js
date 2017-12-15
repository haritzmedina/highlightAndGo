const GoogleSheetParser = require('./googleSheetsContentScript/GoogleSheetParser')
const HypothesisGroupInitializer = require('./googleSheetsContentScript/HypothesisGroupInitializer')

window.addEventListener('load', () => {
  chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'initContentScript') {
      window.pshole = {}
      window.pshole.googleSheetParser = new GoogleSheetParser()
      window.pshole.googleSheetParser.parse((err, parsedSheetData) => {
        if (err) {
          console.error(err)
        } else {
          window.pshole.HypothesisGroupInitializer = new HypothesisGroupInitializer()
          window.pshole.HypothesisGroupInitializer.init(parsedSheetData)
        }
      })
    }
  })
})
