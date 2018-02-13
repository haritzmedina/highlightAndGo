const $ = require('jquery')
const _ = require('lodash')

class BackToSpreadsheetLink {
  constructor () {
    this.linkToSLR = null
    this.warningImage = null
  }

  init (callback) {
    window.abwa.specific.primaryStudySheetManager.retrievePrimaryStudyRow((err, primaryStudyRow) => {
      let rowInSheet = null
      if (err || primaryStudyRow === 0) {
        rowInSheet = 1
        // Create advert icon
        let warningImageUrl = chrome.extension.getURL('/images/warning.png')
        this.warningImage = document.createElement('img')
        this.warningImage.className = 'warningSidebar'
        this.warningImage.src = warningImageUrl
        this.warningImage.title = 'Current primary study is not found in your hypersheet!' // TODO i18n
      } else {
        rowInSheet = primaryStudyRow + 1
      }
      let spreadsheetId = window.abwa.specific.primaryStudySheetManager.mappingStudy
      let sheetId = window.abwa.specific.primaryStudySheetManager.mappingStudy
      // Construct link to spreadsheet
      this.linkToSLR = document.createElement('a')
      this.linkToSLR.href = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=' + sheetId + '&range=A' + rowInSheet
      this.linkToSLR.innerText = 'Back to spreadsheet' // TODO i18n
      this.linkToSLR.target = '_blank'
      $('#groupBody').append(this.linkToSLR)
      // Append warning img
      if (this.warningImage) {
        $('#groupBody').append(this.warningImage)
      }
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroy () {

  }
}

module.exports = BackToSpreadsheetLink
