const Toolset = require('../../contentScript/Toolset')
const $ = require('jquery')
const Alerts = require('../../utils/Alerts')
const SLRGoogleSheetManager = require('./SLRGoogleSheetManager')

class HighlightAndGoToolset extends Toolset {
  init () {
    super.init(() => {
      // Change toolset header name
      this.toolsetHeader.innerText = 'Tools'

      // Retrieve toolset template
      let toolsetButtonTemplate = document.querySelector('#toolsetButtonTemplate')

      // Set create new group button
      let newSLRImageUrl = chrome.extension.getURL('/images/newSLR.svg')
      this.newSLRImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.newSLRImage.src = newSLRImageUrl
      this.newSLRImage.title = 'Create a new Systematic Literature Review' // TODO i18n
      this.toolsetBody.appendChild(this.newSLRImage)
      this.newSLRImage.addEventListener('click', () => {
        // TODO i18n
        Alerts.infoAlert({
          title: 'Functionality not available yet',
          text: 'You can create a new SLR just creating a new Hypothes.is group <a href="https://hypothes.is/groups/new">here</a>.'})
        // TODO
      })

      // Set create spreadsheet button
      let googleSheetsImageUrl = chrome.extension.getURL('/images/googleSheet.svg')
      this.googleSheetsImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.googleSheetsImage.src = googleSheetsImageUrl
      this.googleSheetsImage.title = 'Create a view for the SLR in google sheet' // TODO i18n
      this.toolsetBody.appendChild(this.googleSheetsImage)
      this.googleSheetsImage.addEventListener('click', () => {
        // Functionality to create spreadsheets
        this.slrGoogleSheetManager = new SLRGoogleSheetManager()
        this.slrGoogleSheetManager.init(() => {
          this.slrGoogleSheetManager.createSpreadsheet((err, spreadsheetMetadata) => {
            if (err) {
              Alerts.errorAlert({title: 'Error creating spreadsheet'})
            } else {
              let spreadsheetId = spreadsheetMetadata.spreadsheetId
              let sheetId = spreadsheetMetadata.sheetId
              let spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId
              if (sheetId) {
                spreadsheetUrl += '/edit#gid=' + sheetId
              }
              Alerts.infoAlert({
                title: 'Spreadsheet correctly created',
                text: 'This is your spreadsheet URL: <a href="' + spreadsheetUrl + '" target="_blank">' + spreadsheetUrl + '</a>'
              })
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
