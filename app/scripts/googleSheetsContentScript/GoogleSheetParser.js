const _ = require('lodash')
const $ = require('jquery')

class GoogleSheetParser {
  constructor () {
    this.spreadsheetId = null
  }

  parse (callback) {
    this.retrieveSpreadsheetId()
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
          callback(null, {dimensions: promisesResults[0], title: promisesResults[1]})
        }
      })
    })
  }

  retrieveSpreadsheetId () {
    // Get current google sheet id
    this.spreadsheetId = window.location.href.match(/[-\w]{25,}/)[0]
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
    })
  }

  getDimensionsAndCategories (token, callback) {
    $.ajax({
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId + '/values/B1:1',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }).done((result) => {
      let columnNames = result.values[0]
      let indexOfAuthor = _.findIndex(columnNames, (elem) => { return elem.toLowerCase() === 'author' })
      let dimensionsArray = _.takeWhile(columnNames, (elem) => { return elem.toLowerCase() !== 'author' })
      let dimensions = _.zipObject(dimensionsArray, [])
      $.ajax({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/1MfznSKgUMP_B19l_8lFKu1I9-UNP0cpfby9MHuwzbAg',
        data: {
          includeGridData: true,
          ranges: 'B2:' + this.columnToLetter(indexOfAuthor + 1) + '2'
        },
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }).done((result) => {
        let values = result.sheets[0].data[0].rowData[0].values
        for (let i = 0; i < values.length; i++) {
          let dimensionName = dimensionsArray[i]
          if (_.isObject(values[i].dataValidation) && values[i].dataValidation.condition.type === 'ONE_OF_LIST') {
            let categories = _.map(values[i].dataValidation.condition.values, 'userEnteredValue')
            dimensions[dimensionName] = categories
          } else {
            dimensions[dimensionName] = null
          }
        }
        if (_.isFunction(callback)) {
          callback(dimensions)
        }
      })
    })
  }
}

module.exports = GoogleSheetParser
