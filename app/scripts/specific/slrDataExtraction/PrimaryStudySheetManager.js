const GoogleSheetClientManager = require('../../googleSheets/GoogleSheetsClientManager')
const _ = require('lodash')
const swal = require('sweetalert2')
const DOI = require('doi-regex')
const URLUtils = require('../../utils/URLUtils')

class PrimaryStudySheetManager {
  constructor () {
    this.primaryStudy = null
    this.spreadsheetMetadata = {}
    this.sheetData = null
  }

  init (callback) {
    // Login in google sheets
    this.googleSheetClientManager = new GoogleSheetClientManager()
    this.googleSheetClientManager.init()
    this.googleSheetClientManager.logInGoogleSheets((err) => {
      if (err) {
        swal({
          type: 'warning',
          title: 'Oops...',
          text: 'It is recommended to give permissions to google sheets. Part of the functionality of the extension will not work correctly.'
        })
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null)
        }
      }
    })
  }

  retrievePrimaryStudyRow (callback) {
    // Retrieve current spreadsheet id
    this.reloadGSheetData((err) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        let data = this.sheetData.data[0].rowData
        let primaryStudyRow = 0
        // Retrieve primary study row (if it has doi, compare with doi primary studies
        if (window.abwa.contentTypeManager.doi) {
          let doi = window.abwa.contentTypeManager.doi
          for (let i = 1; i < data.length && primaryStudyRow === 0; i++) {
            let link = this.googleSheetClientManager.googleSheetClient.getHyperlinkFromCell(data[i].values[0])
            if (link) {
              // If link is doi.org url
              let doiGroups = DOI.groups(link)
              if (!_.isEmpty(doiGroups) && !_.isEmpty(doiGroups[1])) {
                let rowDoi = DOI.groups(link)[1]
                if (!_.isEmpty(rowDoi) && doi === rowDoi) {
                  primaryStudyRow = i
                }
              }
            }
          }
        }
        // If primary study is not found by doi, try by URL
        if (primaryStudyRow === 0) {
          let currentURL = window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis().replace(/(^\w+:|^)\/\//, '')
          for (let i = 1; i < data.length && primaryStudyRow === 0; i++) {
            if (_.isObject(data[i]) && _.isObject(data[i].values[0])) {
              let link = this.googleSheetClientManager.googleSheetClient.getHyperlinkFromCell(data[i].values[0])
              if (link) {
                if (URLUtils.areSameURI(currentURL, link)) {
                  primaryStudyRow = i
                }
              }
            }
          }
        }
        console.debug('Primary study row %s', primaryStudyRow)
        if (_.isFunction(callback)) {
          if (primaryStudyRow > 0) {
            callback(null, primaryStudyRow)
          } else {
            swal({
              type: 'warning',
              title: 'Oops...',
              text: 'This primary study is not in your hypersheet. Please add it if you want to update your mapping study.'
            })
            callback(new Error('Primary study not found in your hypersheet'))
          }
        }
      }
    })
  }

  reloadGSheetData (callback) {
    let spreadsheetId = window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId
    let sheetId = window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
    this.googleSheetClientManager.googleSheetClient.getSheet({spreadsheetId: spreadsheetId, sheetId: sheetId}, (err, sheet) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.sheetData = sheet
        if (_.isFunction(callback)) {
          callback(null)
        }
      }
    })
  }
}

module.exports = PrimaryStudySheetManager
