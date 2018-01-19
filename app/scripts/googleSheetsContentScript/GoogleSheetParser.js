const _ = require('lodash')
const $ = require('jquery')
const swal = require('sweetalert2')
const URLUtils = require('../utils/URLUtils')

class GoogleSheetParser {
  constructor () {
    this.spreadsheetId = null
  }

  parse (callback) {
    this.retrieveSpreadsheetId()
    this.retrieveSheetId()
    this.retrieveCurrentToken((token) => {
      this.getSpreadsheet(token, (err, spreadsheet) => {
        if (err) {
          callback(err)
        } else {
          let title = spreadsheet.properties.title
          let dimensions = this.getDimensionsAndCategories(spreadsheet)
          if (_.isError(dimensions)) {
            callback(dimensions)
          } else {
            if (_.isFunction(callback)) {
              callback(null, {
                dimensions: dimensions,
                title: title,
                gSheetMetadata: {spreadsheetId: this.spreadsheetId, sheetId: this.sheetId}
              })
            }
          }
        }
      })
    })
  }

  retrieveSpreadsheetId () {
    // Get current google sheet id
    this.spreadsheetId = window.location.href.match(/[-\w]{25,}/)[0]
  }

  retrieveSheetId () {
    let hashParams = URLUtils.extractHashParamsFromUrl(window.location.href, '=')
    this.sheetId = parseInt(hashParams.gid)
  }

  retrieveCurrentToken (callback) {
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getToken'}, (token) => {
      if (_.isFunction(callback)) {
        callback(token)
      }
    })
  }

  columnToLetter (column) {
    let temp = ''
    let letter = ''
    while (column > 0) {
      temp = (column - 1) % 26
      letter = String.fromCharCode(temp + 65) + letter
      column = (column - temp - 1) / 26
    }
    return letter
  }

  getSpreadsheet (token, callback) {
    $.ajax({
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId,
      data: {
        includeGridData: true
      },
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }).done((spreadsheet) => {
      callback(null, spreadsheet)
    }).fail(() => {
      swal('Oops!', // TODO i18n
        'You don\'t have permission to access the spreadsheet! Are you using the same Google account for the spreadsheet and for Google Chrome?<br/>If you don\'t know how to solve this problem: Please create on top right: "Share -> Get shareable link", and give edit permission.',
        'error') // Notify error to user
      callback(new Error('Unable to retrieve spreadsheet data. Permission denied.'))
    })
  }

  getDimensionsAndCategories (spreadsheet) {
    // Find current sheet
    let sheet = _.find(spreadsheet.sheets, (sheet) => { return sheet.properties.sheetId === this.sheetId })
    // Check if exists object
    if (sheet && sheet.data && sheet.data[0] && sheet.data[0].rowData && sheet.data[0].rowData[0] && sheet.data[0].rowData[0].values) {
      // Retrieve index of "Author" column
      let indexOfAuthor = _.findIndex(sheet.data[0].rowData[0].values, (cell) => {
        if (cell && cell.formattedValue) {
          return cell.formattedValue.toLowerCase() === 'author'
        } else {
          return false
        }
      })
      // If index of author exists
      if (indexOfAuthor !== -1) {
        // Retrieve dimensions. Retrieve elements between 2 column and author column, maps "formattedValue"
        let dimensionsArray = _.map(_.slice(sheet.data[0].rowData[0].values, 1, indexOfAuthor), 'formattedValue')
        // If dimensions are found
        if (dimensionsArray.length > 0) {
          let dimensions = _.zipObject(dimensionsArray, [])
          // Find categories
          if (sheet.data[0].rowData[1] && sheet.data[0].rowData[1].values) {
            // Get cells for categories
            let values = _.slice(sheet.data[0].rowData[1].values, 1, indexOfAuthor)
            // For each cell
            for (let i = 0; i < dimensionsArray.length; i++) {
              // Retrieve its dimension
              let dimensionName = dimensionsArray[i]
              // If dimension is defined
              if (_.isString(dimensionName)) {
                // If cell has data validation "ONE_OF_LIST"
                if (_.isObject(values[i]) && _.isObject(values[i].dataValidation) && values[i].dataValidation.condition.type === 'ONE_OF_LIST') {
                  dimensions[dimensionName] = _.map(values[i].dataValidation.condition.values, 'userEnteredValue')
                } else { // If cell has not data validation
                  dimensions[dimensionName] = []
                }
              }
            }
          }
          // Remove no defined dimensions
          dimensions = JSON.parse(JSON.stringify(dimensions))
          console.debug(dimensions)
          return dimensions
        } else {
          swal('Oops!', // TODO i18n
            'The spreadsheet hasn\'t the correct structure, you have not defined any facet.',
            'error') // Notify error to user
          return new Error('No facet defined')
        }
      } else {
        swal('Oops!', // TODO i18n
          'The spreadsheet hasn\'t the correct structure, "author" column is missing.',
          'error') // Notify error to user
        return new Error('No author found')
      }
    } else {
      swal('Oops!', // TODO i18n
        'The spreadsheet hasn\'t the correct structure. The ROW #1 must contain the facets names for your review.',
        'error') // Notify error to user
      return new Error('Row 1 facet names')
    }
  }
}

module.exports = GoogleSheetParser
