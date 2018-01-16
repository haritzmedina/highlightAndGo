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
      let promises = []
      promises.push(new Promise((resolve) => {
        this.getDimensionsAndCategories(token, (dimensions) => {
          resolve(dimensions)
        })
        return true
      }))
      promises.push(new Promise((resolve) => {
        this.getSpreadSheetName(token, (title) => {
          resolve(title)
        })
        return true
      }))
      Promise.all(promises).then((promisesResults) => {
        if (_.isFunction(callback)) {
          callback(null, {
            dimensions: promisesResults[0],
            title: promisesResults[1],
            gSheetMetadata: {spreadsheetId: this.spreadsheetId, sheetId: this.sheetId}
          })
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

  getSpreadSheetName (token, callback) {
    $.ajax({
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId,
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }).done((result) => {
      if (_.isFunction(callback)) {
        callback(result.properties.title)
      }
    }).fail(() => {
      swal('Oops!', // TODO i18n
        'The spreadsheet need a share link!<br/>Please create on top right: "Share -> Get shareable link", and give edit permission.',
        'error') // Show to the user the error
    })
  }

  getDimensionsAndCategories (token, callback) {
    $.ajax({
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId,
      data: {
        includeGridData: true
      },
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }).done((result) => {
      // Find current sheet
      let sheet = _.find(result.sheets, (sheet) => { return sheet.properties.sheetId === this.sheetId })
      // Check if exists object
      if (sheet && sheet.data && sheet.data[0] && sheet.data[0].rowData[0] && sheet.data[0].rowData[0].values) {
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
          // Retrieve dimensions
          let dimensionsArray = _.map(_.slice(sheet.data[0].rowData[0].values, 1, indexOfAuthor), 'formattedValue')
          let dimensions = _.zipObject(dimensionsArray, [])
          // Find categories
          if (sheet.data[0].rowData[1] && sheet.data[0].rowData[1].values) {
            let values = _.slice(sheet.data[0].rowData[1].values, 1, indexOfAuthor)
            for (let i = 0; i < dimensionsArray.length; i++) {
              let dimensionName = dimensionsArray[i]
              if (_.isObject(values[i]) && _.isObject(values[i].dataValidation) && values[i].dataValidation.condition.type === 'ONE_OF_LIST') {
                dimensions[dimensionName] = _.map(values[i].dataValidation.condition.values, 'userEnteredValue')
              } else {
                dimensions[dimensionName] = []
              }
            }
          }
          console.debug(dimensions)
          if (_.isFunction(callback)) {
            callback(dimensions)
          }
        } else {
          swal('Oops!', // TODO i18n
            'The spreadsheet hasn\'t the correct structure, "author" column is missing.',
            'error') // Show to the user the error
        }
      } else {
        swal('Oops!', // TODO i18n
          'The spreadsheet hasn\'t the correct structure, please check it.',
          'error') // Show to the user the error
      }
    }).fail(() => {
      swal('Oops!', // TODO i18n
        'The spreadsheet need a share link!<br/>Please create on top right: "Share -> Get shareable link", and give edit permission.',
        'error') // Show to the user the error
    })
  }
}

module.exports = GoogleSheetParser
