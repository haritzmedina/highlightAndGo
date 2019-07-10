const Toolset = require('../../contentScript/Toolset')
const $ = require('jquery')
const _ = require('lodash')
const Alerts = require('../../utils/Alerts')
const LanguageUtils = require('../../utils/LanguageUtils')
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
        Alerts.inputTextAlert({
          title: 'Create a new Systematic Literature Review',
          inputPlaceholder: 'Type here the new of your SLR...',
          preConfirm: (slrName) => {
            if (_.isString(slrName)) {
              if (slrName.length <= 0) {
                const swal = require('sweetalert2')
                swal.showValidationMessage('Name cannot be empty.')
              } else if (slrName.length > 25) {
                const swal = require('sweetalert2')
                swal.showValidationMessage('The SLR name cannot be higher than 25 characters.')
              } else {
                return slrName
              }
            }
          },
          callback: (err, slrName) => {
            if (err) {
              window.alert('Unable to load swal. Please contact developer.')
            } else {
              slrName = LanguageUtils.normalizeString(slrName)
              window.abwa.storageManager.client.createNewGroup({
                name: slrName,
                description: 'A Highlight&Go group to conduct a SLR'
              }, (err, result) => {
                if (err) {
                  Alerts.errorAlert({text: 'Unable to create a new group. Please try again or contact developers if the error continues happening.'})
                } else {
                  // Move group to new created one
                  window.abwa.groupSelector.setCurrentGroup(result.id)
                }
              })
            }
          }
        })
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
