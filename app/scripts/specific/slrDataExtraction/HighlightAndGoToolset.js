const Toolset = require('../../contentScript/Toolset')
const $ = require('jquery')
const Alerts = require('../../utils/Alerts')
const SLRGoogleSheetManager = require('./SLRGoogleSheetManager')

class HighlightAndGoToolset extends Toolset {
  init () {
    super.init(() => {
      // Change toolset header name
      this.toolsetHeader.innerText = 'Tools'

      // Set screenshot image
      let googleSheetsImageUrl = chrome.extension.getURL('/images/googleSheet.svg')
      let toolsetButtonTemplate = document.querySelector('#toolsetButtonTemplate')
      this.googleSheetsImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.googleSheetsImage.src = googleSheetsImageUrl
      this.googleSheetsImage.title = 'Create a view for the SLR in google sheet' // TODO i18n
      this.toolsetBody.appendChild(this.googleSheetsImage)
      this.googleSheetsImage.addEventListener('click', () => {
        // TODO Functionality to create spreadsheets
        this.slrGoogleSheetManager = new SLRGoogleSheetManager()
        this.slrGoogleSheetManager.init(() => {
          this.slrGoogleSheetManager.createSpreadsheet((err, spreadsheetUrl) => {
            if (err) {
              Alerts.errorAlert({title: 'Error creating spreadsheet'})
            } else {
              Alerts.infoAlert({text: '<a href="' + spreadsheetUrl + '" target="_blank">spreadsheetUrl</a>'})
            }
          })
        })
      })
      // TODO Back to hypothes.is icon ?

      // Show toolset always
      this.show()
    })
  }

  show () {
    super.show()
  }

  hide () {
    super.hide()
  }
}

module.exports = HighlightAndGoToolset
