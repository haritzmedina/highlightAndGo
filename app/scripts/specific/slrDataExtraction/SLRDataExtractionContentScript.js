const $ = require('jquery')
const _ = require('lodash')
const jsYaml = require('js-yaml')
const Events = require('../../contentScript/Events')
const URLUtils = require('../../utils/URLUtils')
const DOI = require('doi-regex')

class SLRDataExtractionContentScript {
  constructor () {
    this.linkToSLR = null
    this.spreadsheetId = null
  }

  init (callback) {
    // Create link to back to spreadsheet
    this.initBackToSpreadsheetLink()
    // Listen to event when annotation is created
    document.addEventListener(Events.annotationCreated, (event) => {
      // Add to google sheet the current annotation
      let annotation = event.detail.annotation
      this.addClassificationToGSheet(annotation, () => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
    // Listen to event when annotation is deleted
    document.addEventListener(Events.annotationDeleted, (event) => {
      // Remove from google sheet the current annotation
      let deletedAnnotation = event.detail.annotation
      // Update google sheet with the deleted annotation
      this.updateClassificationInGSheetWithDeletedAnnotation(deletedAnnotation, () => {

      })
    })
  }

  initBackToSpreadsheetLink (callback) {
    // Retrieve current spreadsheet id
    this.retrieveSpreadsheetIdForCurrentGroup((err, spreadsheetId) => {
      if (err) {
        console.error(new Error('Unable to retrieve spreadsheet asociated with this group'))
      } else {
        this.askUserToLogInSheets((token) => {
          this.getSpreadsheetData(spreadsheetId, token, null, (result) => {
            let data = result.sheets[0].data[0].rowData
            // Retrieve current primary study row
            let primaryStudyRow = this.retrievePrimaryStudyRow(data)
            // Construct link to spreadsheet
            this.linkToSLR = document.createElement('a')
            this.linkToSLR.href = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=0&range=A' + (primaryStudyRow + 1)
            this.linkToSLR.innerText = 'Back to spreadsheet' // TODO i18n
            this.linkToSLR.target = '_blank'
            $('#groupBody').append(this.linkToSLR)
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      }
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
      this.retrieveSpreadsheetIdForCurrentGroup((err, spreadsheetId) => {
        if (err) {
          alert('The current group is not related with a google spreadsheet')
        } else {
          this.askUserToLogInSheets((token) => {
            this.getSpreadsheetData(spreadsheetId, token, null, (result) => {
              let data = result.sheets[0].data[0].rowData
              // Retrieve primary study row
              let primaryStudyRow = this.retrievePrimaryStudyRow(data)
              // Retrieve dimension column
              let dimensionColumn = this.retrieveDimensionColumn(data, dimension)
              if (primaryStudyRow !== 0 && dimensionColumn !== 0) {
                // If cell is empty, add annotation value to the cell
                if (_.isEmpty(data[primaryStudyRow].values[dimensionColumn].formattedValue)) {
                  console.debug('Setting dimension')
                  // If doi is found in PDF, the annotation URL will be doi.org, in other case the same as annotation uri
                  let annotationURL = this.getAnnotationUrl(classificationAnnotation)
                  this.setCellValueWithLink(
                    category,
                    annotationURL,
                    {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn},
                    token,
                    () => {
                      if (_.isFunction(callback)) {
                        callback()
                      }
                    })
                } else if (data[primaryStudyRow].values[dimensionColumn].formattedValue !== category) {
                  // If cell value is different to the annotated category, so set the cell in red
                  console.debug('Dimension %s differs from already set one %s')
                  this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, {
                    'red': 0.9,
                    'green': 0,
                    'blue': 0
                  }, () => {
                    if (_.isFunction(callback)) {
                      callback()
                    }
                  })
                }
                // If cell is not empty and the current category is different
              } else {
                if (primaryStudyRow === 0) {
                  alert('Something went wrong. Unable to add to spreadsheet, no primary study found in gSheet')
                } else if (dimensionColumn === 0) {
                  alert('Something went wrong. Unable to add to spreadsheet, no dimension found')
                }
              }
            })
          })
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

  updateClassificationInGSheetWithDeletedAnnotation (deletedAnnotation, callback) {
    // Retrieve dimension of annotation
    let dimensionTag = _.find(deletedAnnotation.tags, (tag) => {
      return tag.includes('slr:isCategoryOf:') || tag.includes('slr:dimension:')
    })
    let dimension = null
    if (dimensionTag.includes('slr:isCategoryOf:')) { // Categorized dimension
      this.retrieveSpreadsheetIdForCurrentGroup((err, spreadsheetId) => {
        if (err) {
          console.error(err)
        } else {
          this.askUserToLogInSheets((token) => {
            this.getSpreadsheetData(spreadsheetId, token, null, (result) => {
              let data = result.sheets[0].data[0].rowData
              dimension = dimensionTag.replace('slr:isCategoryOf:', '')
              window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
                url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(), // For current document (pdf/html)
                uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(), // For current document (html)
                group: window.abwa.groupSelector.currentGroup.id, // For current group
                tags: 'slr:isCategoryOf:' + dimension, // With slr:isCategoryOf:<dimension>
                order: 'asc' // Ordered from oldest to newest
              }, (err, annotations) => {
                if (err) {
                  console.error('Unable to load annotations')
                  alert('Unable to load annotations')
                } else {
                  // Search row and column
                  let primaryStudyRow = this.retrievePrimaryStudyRow(data)
                  let dimensionColumn = this.retrieveDimensionColumn(data, dimension)
                  // If no annotation is found, the cell is empty and white
                  // If only annotations of 1 category are found, the category name is set and the oldest one is set, cell in white
                  // If annotations more than 1 category are found, oldest annotation url and category, cell is set in red color
                  if (annotations.length === 0) {
                    // Set in white and empty the cell
                    this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, null, () => {
                      this.setCellEmpty({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                        console.debug('Empty dimension %s in sheet, cause no annotations are found')
                        if (_.isFunction(callback)) {
                          callback()
                        }
                      })
                    })
                  } else {
                    // Check if all annotations have the same categories
                    let categories = _.keys(_.groupBy(annotations, (annotation) => {
                      return _.find(annotation.tags, (tag) => {
                        return tag.includes('slr:category:')
                      })
                    }))
                    if (categories.length === 1) {
                      // Set in white and fill the cell
                      this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, null, () => {
                        let category = categories[0].replace('slr:category:', '')
                        let link = this.getAnnotationUrl(annotations[0])
                        this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                          if (_.isFunction(callback)) {
                            callback()
                          }
                        })
                      })
                    } else {
                      // Cell in red, oldest value
                      this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, {
                        'red': 0.9,
                        'green': 0,
                        'blue': 0
                      }, () => {
                        // Retrieve category of the oldest annotation
                        let category = _.find(annotations[0].tags, (tag) => {
                          return tag.includes('slr:category:')
                        }).replace('slr:category:', '')
                        let link = this.getAnnotationUrl(annotations[0])
                        this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                          if (_.isFunction(callback)) {
                            callback()
                          }
                        })
                      })
                    }
                  }
                }
              })
            })
          })
        }
      })
    } else if (dimensionTag.includes('slr:dimension:')) { // Uncategorized dimension
      // Retrieve google spreadsheet data
      this.retrieveSpreadsheetIdForCurrentGroup((err, spreadsheetId) => {
        if (err) {
          console.error(err)
        } else {
          this.askUserToLogInSheets((token) => {
            this.getSpreadsheetData(spreadsheetId, token, null, (result) => {
              let data = result.sheets[0].data[0].rowData
              dimension = dimensionTag.replace('slr:dimension:', '')
              // Search all annotations ...
              window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
                url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(), // For current document (pdf/html)
                uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(), // For current document (html)
                group: window.abwa.groupSelector.currentGroup.id, // For current group
                tags: 'slr:dimension:' + dimension, // With slr:dimension:<dimension>
                order: 'asc', // Ordered from oldest to newest
                limit: 2 // No need to retrieve more than 2 annotations, see following code to know why
              }, (err, annotations) => {
                if (err) {
                  console.error('Unable to load annotations')
                  alert('Unable to load annotations')
                } else {
                  // Search row and column
                  let primaryStudyRow = this.retrievePrimaryStudyRow(data)
                  let dimensionColumn = this.retrieveDimensionColumn(data, dimension)
                  // If no annotation is found, the cell is empty and white
                  // If only one annotation is found, the cell is set in white with the value of the retrieved annotation
                  // If more than one annotation is found, the cell is set red with the value of the first annotation
                  if (annotations.length === 0) {
                    // Set in white and empty the cell
                    this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, null, () => {
                      this.setCellEmpty({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                        console.debug('Empty dimension %s in sheet, cause no annotations are found')
                        if (_.isFunction(callback)) {
                          callback()
                        }
                      })
                    })
                  } else if (annotations.length === 1) {
                    // Set in white and fill the cell
                    this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, null, () => {
                      let category = _.find(annotations[0].target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' }).exact
                      let link = this.getAnnotationUrl(annotations[0])
                      this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                        if (_.isFunction(callback)) {
                          callback()
                        }
                      })
                    })
                  } else if (annotations.length > 1) {
                    // Set in red and fill the cell with the oldest annotation
                    this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, {
                      'red': 0.9,
                      'green': 0,
                      'blue': 0
                    }, () => {
                      let category = _.find(annotations[0].target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' }).exact
                      let link = this.getAnnotationUrl(annotations[0])
                      this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                        if (_.isFunction(callback)) {
                          callback()
                        }
                      })
                    })
                  }
                }
              })
            })
          })
        }
      })
    } else {
      console.error('Dimension not found')
    }
  }

  retrievePrimaryStudyRow (data) {
    let primaryStudyRow = 0
    // Retrieve primary study row (if it has doi, compare with doi primary studies
    if (window.abwa.contentTypeManager.doi) {
      let doi = window.abwa.contentTypeManager.doi
      for (let i = 1; i < data.length && primaryStudyRow === 0; i++) {
        if (!_.isEmpty(data[i].values[0].userEnteredValue) && !_.isEmpty(data[i].values[0].userEnteredValue.formulaValue)) {
          let value = data[i].values[0].userEnteredValue.formulaValue
          let link = value.match(/=hyperlink\("([^"]+)"/i)[1].replace(/(^\w+:|^)\/\//, '')
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
        if (!_.isEmpty(data[i].values[0].userEnteredValue) && !_.isEmpty(data[i].values[0].userEnteredValue.formulaValue)) {
          let value = data[i].values[0].userEnteredValue.formulaValue
          let link = value.match(/=hyperlink\("([^"]+)"/i)[1].replace(/(^\w+:|^)\/\//, '')
          if (URLUtils.areSameURI(currentURL, link)) {
            primaryStudyRow = i
          }
        }
      }
    }
    console.debug('Primary study row %s', primaryStudyRow)
    return primaryStudyRow
  }

  retrieveDimensionColumn (data, dimensionName) {
    let dimensionColumn = 0
    for (let j = 0; j < data[0].values.length && dimensionColumn === 0; j++) {
      if (data[0].values[j].formattedValue === dimensionName) {
        dimensionColumn = j
      }
    }
    return dimensionColumn
  }

  setCellValueWithLink (value, link, cell, token, callback) {
    let range = this.columnToLetter(cell.dimensionColumn + 1) + (cell.primaryStudyRow + 1)
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
        'values': [['=HYPERLINK("' + link + '","' + value + '")']]
      })
    }).done(() => {
      console.debug('Set category %s, with link %s, in cell %s', value, link, range)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setCellEmpty (cell, token, callback) {
    let range = this.columnToLetter(cell.dimensionColumn + 1) + (cell.primaryStudyRow + 1)
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
        'values': [['']]
      })
    }).done(() => {
      console.debug('Cell %s is empty', range)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setCellInColor (cell, token, color, callback) {
    let cellBackgroundColor = color || {
      'red': 1,
      'green': 1,
      'blue': 1
    }
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
            'startRowIndex': cell.primaryStudyRow,
            'endRowIndex': cell.primaryStudyRow + 1,
            'startColumnIndex': cell.dimensionColumn,
            'endColumnIndex': cell.dimensionColumn + 1
          },
          'cell': {
            'userEnteredFormat': {
              'backgroundColor': cellBackgroundColor
            }
          },
          'fields': 'userEnteredFormat(backgroundColor)'
        }
        }]
      })
    }).done(() => {
      console.debug('Set in red row %s, column %s ', cell.primaryStudyRow, cell.dimensionColumn)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  getSpreadsheetData (spreadsheetId, token, sheetId, callback) {
    $.ajax({
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId,
      headers: {
        'Authorization': 'Bearer ' + token
      },
      data: {
        includeGridData: true
      }
    }).done((result) => {
      // TODO Retrieve sheet by id if defined
      if (_.isFunction(callback)) {
        callback(result)
      }
    })
  }

  retrieveSpreadsheetIdForCurrentGroup (callback) {
    // Retrieve the sheet id
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.url,
      tag: 'slr:spreadsheet'
    }, (err, annotations) => {
      if (err) {
        console.error(err)
      } else {
        if (annotations.length > 0) {
          let annotation = annotations[0]
          let params = jsYaml.load(annotation.text)
          this.spreadsheetId = params.id
          if (_.isFunction(callback)) {
            callback(null, params.id)
          }
        } else {
          // Should alert user
          callback(new Error('Annotation which relates hypothesis group with google spreadsheet is not found.'))
        }
      }
    })
  }

  getAnnotationUrl (annotation) {
    if (window.abwa.contentTypeManager.doi) {
      return 'https://doi.org/' + window.abwa.contentTypeManager.doi + '#hag:' + annotation.id
    } else {
      return annotation.uri + '#hag:' + annotation.id
    }
  }
}

module.exports = SLRDataExtractionContentScript
