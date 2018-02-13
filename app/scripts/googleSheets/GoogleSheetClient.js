let $
if (typeof window === 'undefined') {
  $ = require('jquery')(global.window)
} else {
  $ = require('jquery')
}

const _ = require('lodash')

class GoogleSheetClient {
  constructor (token) {
    if (token) {
      this.token = token
    }
    this.baseURI = 'https://sheets.googleapis.com/v4/spreadsheets/'
  }

  getSpreadsheet (spreadsheetId, callback) {
    $.ajax({
      method: 'GET',
      url: this.baseURI + spreadsheetId,
      headers: {
        'Authorization': 'Bearer ' + this.token
      },
      data: {
        includeGridData: true
      }
    }).done((result) => {
      callback(null, result)
    }).fail(() => {
      callback(new Error('Unable to retrieve gsheet'))
    })
  }

  getSheet (sheetData, callback) {
    this.getSpreadsheet(sheetData.spreadsheetId, (err, result) => {
      if (err) {
        callback(err)
      } else {
        // Retrieve sheet by id if defined
        let sheet = _.find(result.sheets, (sheet) => { return sheet.properties.sheetId === parseInt(sheetData.sheetId) })
        if (_.isFunction(callback)) {
          callback(null, sheet)
        }
      }
    })
  }

  getHyperlinkFromCell (cell) {
    // Try to get by hyperlink property
    if (cell.hyperlink) {
      return cell.hyperlink
    } else {
      if (!_.isEmpty(cell.userEnteredValue) && !_.isEmpty(cell.userEnteredValue.formulaValue)) {
        let value = cell.userEnteredValue.formulaValue
        let hyperlinkMatch = value.match(/=hyperlink\("([^"]+)"/i)
        if (!_.isEmpty(hyperlinkMatch) && hyperlinkMatch.length > 1) {
          return hyperlinkMatch[1].replace(/(^\w+:|^)\/\//, '')
        }
      }
    }
  }

  updateCell (data, callback) {
    $.ajax({
      async: true,
      crossDomain: true,
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + data.spreadsheetId + ':batchUpdate',
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        requests: [{'repeatCell': {
          'range': {
            'sheetId': data.sheetId,
            'startRowIndex': data.row,
            'endRowIndex': data.row + 1,
            'startColumnIndex': data.column,
            'endColumnIndex': data.column + 1
          },
          'cell': {
            'userEnteredFormat': {
              'backgroundColor': data.backgroundColor
            },
            'userEnteredValue': {
              'formulaValue': '=HYPERLINK("' + data.link + '", "' + data.value + '")'
            }
          },
          'fields': 'userEnteredFormat(backgroundColor), userEnteredValue(formulaValue)'
        }
        }]
      })
    }).done(() => {
      console.debug('Set color for row %s, column %s ', data.row, data.column)
      if (_.isFunction(callback)) {
        callback(null)
      }
    }).fail((xhr, textStatus) => {
      callback(new Error('Error while updating cell'))
    })
  }
}

module.exports = GoogleSheetClient
