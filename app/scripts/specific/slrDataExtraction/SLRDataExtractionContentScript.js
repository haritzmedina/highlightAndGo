const $ = require('jquery')
const _ = require('lodash')
const jsYaml = require('js-yaml')
const Events = require('../../contentScript/Events')

class SLRDataExtractionContentScript {
  constructor () {
    this.linkToSLR = null
    this.spreadsheetId = null
  }

  init (callback) {
    this.linkToSLR = document.createElement('a')
    this.linkToSLR.href = chrome.extension.getURL('content/slrView/index.html')
    this.linkToSLR.innerText = 'View current status'
    this.linkToSLR.target = '_blank'
    $('#groupBody').append(this.linkToSLR)
    document.addEventListener(Events.annotationCreated, (event) => {
      // Add to google sheet the current annotation
      let annotation = event.detail.annotation
      this.addClassificationToGSheet(annotation, () => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
  }

  addClassificationToGSheet (classificationAnnotation, callback) {
    // Check what type of classification is, restricted by (has this tag) or free (hasn't this tag)
    let category = null
    let dimension = null
    if (this.hasATag(classificationAnnotation, 'slr:isCategoryOf')) {
      // TODO Retrieve the category and dimension belonged to
      category = _.find(classificationAnnotation.tags, (tag) => {
        return tag.includes('slr:category:')
      }).replace('slr:category:', '')
      dimension = _.find(classificationAnnotation.tags, (tag) => {
        return tag.includes('slr:isCategoryOf:')
      }).replace('slr:isCategoryOf:', '')
    } else {
      // TODO Retrieve category from target
      dimension = _.find(classificationAnnotation.tags, (tag) => {
        return tag.includes('slr:dimension:')
      }).replace('slr:dimension:', '')
      category = _.find(classificationAnnotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' }).exact
    }
    console.log('Dimension %s, category %s', dimension, category)
    if (category && dimension) {
      // Retrieve the sheet id
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
        url: window.abwa.groupSelector.currentGroup.url,
        tag: 'slr:spreadsheet'
      }, (annotations) => {
        if (annotations.length > 0) {
          let annotation = annotations[0]
          let params = jsYaml.load(annotation.text)
          this.spreadsheetId = params.id
          this.askUserToLogInSheets((token) => {
            console.log(token)
            $.ajax({
              method: 'GET',
              url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId,
              headers: {
                'Authorization': 'Bearer ' + token
              },
              data: {
                includeGridData: true
              }
            }).done((result) => {
              let data = result.sheets[0].data[0].rowData
              let primaryStudyRow = 0
              // Retrieve primary study row
              for (let i = 1; i < data.length && primaryStudyRow === 0; i++) {
                if (!_.isEmpty(data[i].values[0].userEnteredValue) && !_.isEmpty(data[i].values[0].userEnteredValue.formulaValue)) {
                  let value = data[i].values[0].userEnteredValue.formulaValue
                  let link = value.match(/=hyperlink\("([^"]+)"/i)[1]
                  if (link === window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()) {
                    primaryStudyRow = i
                  }
                }
              }
              console.log('Primary study row %s', primaryStudyRow)
              // Retrieve dimension column
              let dimensionColumn = 0
              for (let j = 0; j < data[0].values.length && dimensionColumn === 0; j++) {
                if (data[0].values[j].formattedValue === dimension) {
                  dimensionColumn = j
                }
              }
              console.log('Dimension column %s', dimensionColumn)
              if (primaryStudyRow !== 0 && dimensionColumn !== 0) {
                // If cell has value, turn cell in red
                if (_.isEmpty(data[primaryStudyRow].values[dimensionColumn].formattedValue)) {
                  console.log('Setting dimension')
                  let range = this.columnToLetter(dimensionColumn + 1) + (primaryStudyRow + 1)
                  let annotationURL = classificationAnnotation.uri + '#annotations:' + classificationAnnotation.id
                  $.ajax({
                    async: true,
                    method: 'PUT',
                    crossDomain: true,
                    url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId + '/values/' + range + '?valueInputOption=USER_ENTERED',
                    headers: {
                      'Authorization': 'Bearer ' + token,
                      'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                      'majorDimension': 'ROWS',
                      'values': [['=HYPERLINK("' + annotationURL + '","' + category + '")']]
                    })
                  })
                } else { // Else, add annotation value to the cell
                  console.log('Dimension already set')
                  $.ajax({
                    async: true,
                    crossDomain: true,
                    method: 'POST',
                    url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetId + ':batchUpdate',
                    headers: {
                      'Authorization': 'Bearer ' + token,
                      'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                      requests: [{'repeatCell': {
                        'range': {
                          'sheetId': 0,
                          'startRowIndex': primaryStudyRow,
                          'endRowIndex': primaryStudyRow + 1,
                          'startColumnIndex': dimensionColumn,
                          'endColumnIndex': dimensionColumn + 1
                        },
                        'cell': {
                          'userEnteredFormat': {
                            'backgroundColor': {
                              'red': 0.9,
                              'green': 0,
                              'blue': 0
                            }
                          }
                        },
                        'fields': 'userEnteredFormat(backgroundColor)'
                      }
                      }]
                    })
                  }).done(() => {
                    if (_.isFunction(callback)) {
                      callback()
                    }
                  })
                }
              } else {
                if (primaryStudyRow === 0) {
                  alert('Something went wrong. Unable to add to spreadsheet, no primary study found in gSheet')
                } else if (dimensionColumn === 0) {
                  alert('Something went wrong. Unable to add to spreadsheet, no dimension found')
                }
              }
            })
          })
          // TODO Update the spreadsheet with the corresponding value and hyperlink
        }
      })
    } else {
      window.alert('Something went wrong')
    }
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

  askUserToLogInSheets (callback) {
    // Promise if user has not given permissions in google sheets
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getTokenSilent'}, (token) => {
      if (token) {
        if (_.isFunction(callback)) {
          callback(token)
        }
      } else {
        if (confirm(chrome.i18n.getMessage('GoogleSheetLoginRequired'))) {
          chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getToken'}, (token) => {
            if (_.isFunction(callback)) {
              callback(token)
            }
          })
        }
      }
    })
  }

  destroy () {
    if (this.linkToSLR) {
      $(this.linkToSLR).remove()
    }
  }

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return annotationTag.includes(tag)
    }) !== -1
  }
}

module.exports = SLRDataExtractionContentScript
