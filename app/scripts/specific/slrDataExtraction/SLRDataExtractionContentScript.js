const $ = require('jquery')
const _ = require('lodash')
const jsYaml = require('js-yaml')
const Events = require('../../contentScript/Events')
const URLUtils = require('../../utils/URLUtils')
const SheetUtils = require('../../utils/SheetUtils')
const Config = require('../../Config')
const DOI = require('doi-regex')
const swal = require('sweetalert2')

class SLRDataExtractionContentScript {
  constructor () {
    this.linkToSLR = null
    this.spreadsheetId = null
    this.tags = {
      isFacetOf: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':',
      facet: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.group + ':',
      code: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.subgroup + ':'
    }
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
    // Listen to event when annotation is validated
    document.addEventListener(Events.validateAnnotation, (event) => {
      // Remove from google sheet the current annotation
      let validatedAnnotation = event.detail.annotation
      // Update google sheet with the deleted annotation
      this.updateGSheetWithValidatedAnnotation(validatedAnnotation, () => {

      })
      // Update
    })
  }

  initBackToSpreadsheetLink (callback) {
    // Retrieve current spreadsheet id
    this.retrieveSpreadsheetMetadataForCurrentGroup((err, spreadsheetMetadata) => {
      if (err) {
        console.error(new Error('Unable to retrieve spreadsheet asociated with this group'))
      } else {
        this.askUserToLogInSheets((token) => {
          this.getSheet(spreadsheetMetadata, token, (sheet) => {
            let data = sheet.data[0].rowData
            // Retrieve current primary study row
            let primaryStudyRow = this.retrievePrimaryStudyRow(data)
            // Construct link to spreadsheet
            this.linkToSLR = document.createElement('a')
            this.linkToSLR.href = 'https://docs.google.com/spreadsheets/d/' + spreadsheetMetadata.spreadsheetId + '/edit#gid=' +
              spreadsheetMetadata.sheetId + '&range=A' + (primaryStudyRow + 1)
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
    if (this.hasATag(classificationAnnotation, this.tags.isFacetOf)) {
      // TODO Retrieve the category and dimension belonged to
      category = _.find(classificationAnnotation.tags, (tag) => {
        return tag.includes(this.tags.code)
      }).replace(this.tags.code, '')
      dimension = _.find(classificationAnnotation.tags, (tag) => {
        return tag.includes(this.tags.isFacetOf)
      }).replace(this.tags.isFacetOf, '')
    } else {
      // TODO Retrieve category from target
      dimension = _.find(classificationAnnotation.tags, (tag) => {
        return tag.includes(this.tags.facet)
      }).replace(this.tags.facet, '')
      category = _.find(classificationAnnotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' }).exact
    }
    console.log('Dimension %s, category %s', dimension, category)
    if (category && dimension) {
      this.retrieveSpreadsheetMetadataForCurrentGroup((err, spreadsheetMetadata) => {
        if (err) {
          alert('The current group is not related with a google spreadsheet')
        } else {
          this.askUserToLogInSheets((token) => {
            this.getSheet(spreadsheetMetadata, token, (sheet) => {
              let data = sheet.data[0].rowData
              // Retrieve primary study row
              let primaryStudyRow = this.retrievePrimaryStudyRow(data)
              // Retrieve dimension column
              let dimensionColumn = this.retrieveDimensionColumn(data, dimension)
              if (primaryStudyRow !== 0 && dimensionColumn !== 0) {
                // If cell is empty, add annotation value to the cell
                let currentCellValue = null
                if (_.isObject(data[primaryStudyRow].values[dimensionColumn])) {
                  currentCellValue = data[primaryStudyRow].values[dimensionColumn].formattedValue
                }
                if (_.isEmpty(currentCellValue)) {
                  console.debug('Setting dimension')
                  // If doi is found in PDF, the annotation URL will be doi.org, in other case the same as annotation uri
                  let primaryStudyHyperlink = this.getHyperlinkFromCell(data[primaryStudyRow].values[0])
                  let annotationURL = this.getAnnotationUrl(classificationAnnotation, primaryStudyHyperlink)
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
                } else if (currentCellValue !== category) { // If cell is not empty and the current category is different
                  // If cell value is different to the annotated category, so set the cell in red
                  console.debug('Dimension %s differs from already set one %s')
                  this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, SLRDataExtractionContentScript.colors.red, () => {
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
        }
      })
    } else {
      window.alert('Something went wrong')
    }
  }

  askUserToLogInSheets (callback) {
    // Promise if user has not given permissions in google sheets
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getTokenSilent'}, (result) => {
      if (result.token) {
        if (_.isFunction(callback)) {
          callback(result.token)
        }
      } else {
        if (confirm(chrome.i18n.getMessage('GoogleSheetLoginRequired'))) {
          chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getToken'}, (result) => {
            if (_.isFunction(callback)) {
              callback(result.token)
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
      return tag.includes(this.tags.isFacetOf) || tag.includes(this.tags.facet)
    })
    let dimension = null
    if (dimensionTag.includes(this.tags.isFacetOf)) { // Categorized dimension
      this.retrieveSpreadsheetMetadataForCurrentGroup((err, spreadsheetMetadata) => {
        if (err) {
          console.error(err)
        } else {
          this.askUserToLogInSheets((token) => {
            this.getSheet(spreadsheetMetadata, token, (sheet) => {
              let data = sheet.data[0].rowData
              dimension = dimensionTag.replace(this.tags.isFacetOf, '')
              window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
                url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(), // For current document (pdf/html)
                uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(), // For current document (html)
                group: window.abwa.groupSelector.currentGroup.id, // For current group
                tags: this.tags.isFacetOf + dimension, // With slr:isFacetOf:<facet>
                order: 'asc' // Ordered from oldest to newest
              }, (err, annotations) => {
                if (err) {
                  console.error('Unable to load annotations')
                  alert('Unable to load annotations')
                } else {
                  // Search row and column
                  let primaryStudyRow = this.retrievePrimaryStudyRow(data)
                  let dimensionColumn = this.retrieveDimensionColumn(data, dimension)
                  if (primaryStudyRow !== 0 && dimensionColumn !== 0) {
                    // If no annotation is found, the cell is empty and white
                    // If only annotations of 1 category are found, the category name is set and the oldest one is set, cell in white
                    // If annotations more than 1 category are found, oldest annotation url and category, cell is set in red color
                    if (annotations.length === 0) {
                      // Set in white and empty the cell
                      this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, null, () => {
                        this.setCellEmpty({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                          console.debug('Empty dimension %s in sheet, cause no annotations are found', dimension)
                          if (_.isFunction(callback)) {
                            callback()
                          }
                        })
                      })
                    } else {
                      // Check if all annotations have the same categories
                      let categories = _.keys(_.groupBy(annotations, (annotation) => {
                        return _.find(annotation.tags, (tag) => {
                          return tag.includes(this.tags.code)
                        })
                      }))
                      if (categories.length === 1) {
                        // Set in white and fill the cell
                        this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, null, () => {
                          let category = categories[0].replace(this.tags.code, '')
                          let primaryStudyHyperlink = this.getHyperlinkFromCell(data[primaryStudyRow].values[0])
                          let link = this.getAnnotationUrl(annotations[0], primaryStudyHyperlink)
                          this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                            if (_.isFunction(callback)) {
                              callback()
                            }
                          })
                        })
                      } else {
                        // Cell in red, oldest value
                        this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, SLRDataExtractionContentScript.colors.red, () => {
                          // Retrieve category of the oldest annotation
                          let category = _.find(annotations[0].tags, (tag) => {
                            return tag.includes(this.tags.code)
                          }).replace(this.tags.code, '')
                          let primaryStudyHyperlink = this.getHyperlinkFromCell(data[primaryStudyRow].values[0])
                          let link = this.getAnnotationUrl(annotations[0], primaryStudyHyperlink)
                          this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                            if (_.isFunction(callback)) {
                              callback()
                            }
                          })
                        })
                      }
                    }
                  } else {
                    alert('Something went wrong. Unable to add to spreadsheet, no primary study found in gSheet.')
                  }
                }
              })
            })
          })
        }
      })
    } else if (dimensionTag.includes(this.tags.facet)) { // Uncategorized dimension
      // Retrieve google spreadsheet data
      this.retrieveSpreadsheetMetadataForCurrentGroup((err, spreadsheetMetadata) => {
        if (err) {
          console.error(err)
        } else {
          this.askUserToLogInSheets((token) => {
            this.getSheet(spreadsheetMetadata, token, (sheet) => {
              let data = sheet.data[0].rowData
              dimension = dimensionTag.replace(this.tags.facet, '')
              // Search all annotations ...
              window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
                url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(), // For current document (pdf/html)
                uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(), // For current document (html)
                group: window.abwa.groupSelector.currentGroup.id, // For current group
                tags: this.tags.facet + dimension, // With slr:facet:<dimension>
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
                  if (primaryStudyRow !== 0 && dimensionColumn !== 0) {
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
                        let primaryStudyHyperlink = this.getHyperlinkFromCell(data[primaryStudyRow].values[0])
                        let link = this.getAnnotationUrl(annotations[0], primaryStudyHyperlink)
                        this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                          if (_.isFunction(callback)) {
                            callback()
                          }
                        })
                      })
                    } else if (annotations.length > 1) {
                      // Set in red and fill the cell with the oldest annotation
                      this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, SLRDataExtractionContentScript.colors.red, () => {
                        let category = _.find(annotations[0].target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' }).exact
                        let primaryStudyHyperlink = this.getHyperlinkFromCell(data[primaryStudyRow].values[0])
                        let link = this.getAnnotationUrl(annotations[0], primaryStudyHyperlink)
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
        let link = this.getHyperlinkFromCell(data[i].values[0])
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
          let link = this.getHyperlinkFromCell(data[i].values[0])
          if (link) {
            if (URLUtils.areSameURI(currentURL, link)) {
              primaryStudyRow = i
            }
          }
        }
      }
    }
    console.debug('Primary study row %s', primaryStudyRow)
    return primaryStudyRow
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

  retrieveDimensionColumn (data, dimensionName) {
    let dimensionColumn = 0
    for (let j = 0; j < data[0].values.length && dimensionColumn === 0; j++) {
      if (data[0].values[j].formattedValue === dimensionName) {
        dimensionColumn = j
      }
    }
    console.debug('Dimension column %s', dimensionColumn)
    return dimensionColumn
  }

  setCellValueWithLink (value, link, cell, token, callback) {
    this.getSheetName(token, (sheetName) => {
      let range = sheetName + '!' + SheetUtils.columnToLetter(cell.dimensionColumn + 1) + (cell.primaryStudyRow + 1)
      $.ajax({
        async: true,
        method: 'PUT',
        crossDomain: true,
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetMetadata.spreadsheetId + '/values/' + range + '?valueInputOption=USER_ENTERED',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          'majorDimension': 'ROWS',
          'values': [['=HYPERLINK("' + link + '";"' + value + '")']]
        })
      }).done(() => {
        console.debug('Set category %s, with link %s, in cell %s', value, link, range)
        if (_.isFunction(callback)) {
          callback()
        }
      }).fail(() => {
        swal('Oops!', // TODO i18n
          'The spreadsheet need a share link!<br/>Please go to <a href="' + this.linkToSLR.href + '" target="_blank">your spreadsheet</a>, click on top right: "Share -> Get shareable link", and give edit permission.',
          'error') // Show to the user the error
      })
    })
  }

  setCellEmpty (cell, token, callback) {
    this.getSheetName(token, (sheetName) => {
      let range = sheetName + '!' + SheetUtils.columnToLetter(cell.dimensionColumn + 1) + (cell.primaryStudyRow + 1)
      $.ajax({
        async: true,
        method: 'PUT',
        crossDomain: true,
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetMetadata.spreadsheetId + '/values/' + range + '?valueInputOption=USER_ENTERED',
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
      }).fail(() => {
        swal('Oops!', // TODO i18n
          'The spreadsheet need a share link!<br/>Please go to <a href="' + this.linkToSLR.href + '" target="_blank">your spreadsheet</a>, click on top right: "Share -> Get shareable link", and give edit permission.',
          'error') // Show to the user the error
      })
    })
  }

  setCellInColor (cell, token, color, callback) {
    let cellBackgroundColor = color || SLRDataExtractionContentScript.colors.white
    $.ajax({
      async: true,
      crossDomain: true,
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + this.spreadsheetMetadata.spreadsheetId + ':batchUpdate',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        requests: [{'repeatCell': {
          'range': {
            'sheetId': this.spreadsheetMetadata.sheetId,
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
      console.debug('Set color for row %s, column %s ', cell.primaryStudyRow, cell.dimensionColumn)
      if (_.isFunction(callback)) {
        callback()
      }
    }).fail(() => {
      swal('Oops!', // TODO i18n
        'The spreadsheet need a share link!<br/>Please go to <a href="' + this.linkToSLR.href + '" target="_blank">your spreadsheet</a>, click on top right: "Share -> Get shareable link", and give edit permission.',
        'error') // Show to the user the error
    })
  }

  getSheet (spreadsheetMetadata, token, callback) {
    $.ajax({
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetMetadata.spreadsheetId,
      headers: {
        'Authorization': 'Bearer ' + token
      },
      data: {
        includeGridData: true
      }
    }).done((result) => {
      // Retrieve sheet by id if defined
      let sheet = _.find(result.sheets, (sheet) => { return sheet.properties.sheetId === parseInt(spreadsheetMetadata.sheetId) })
      if (_.isFunction(callback)) {
        callback(sheet)
      }
    }).fail(() => {
      swal('Oops!', // TODO i18n
        'The spreadsheet need a share link!<br/>Please go to <a href="' + this.linkToSLR.href + '" target="_blank">your spreadsheet</a>, click on top right: "Share -> Get shareable link", and give edit permission.',
        'error') // Show to the user the error
    })
  }

  getSheetName (token, callback) {
    if (this.spreadsheetMetadata.name) {
      callback(this.spreadsheetMetadata.name)
    } else {
      this.getSheet(this.spreadsheetMetadata, token, (sheet) => {
        this.spreadsheetMetadata.name = sheet.properties.title // Caching for future usage
        callback(this.spreadsheetMetadata.name)
      })
    }
  }

  retrieveSpreadsheetMetadataForCurrentGroup (callback) {
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
          this.spreadsheetMetadata = params
          if (_.isFunction(callback)) {
            callback(null, params)
          }
        } else {
          // Should alert user
          callback(new Error('Annotation which relates hypothesis group with google spreadsheet is not found.'))
        }
      }
    })
  }

  getAnnotationUrl (annotation, primaryStudyURL) {
    if (primaryStudyURL) {
      return primaryStudyURL + '#hag:' + annotation.id
    } else {
      if (window.abwa.contentTypeManager.doi) {
        return 'https://doi.org/' + window.abwa.contentTypeManager.doi + '#hag:' + annotation.id
      } else {
        return annotation.uri + '#hag:' + annotation.id
      }
    }
  }

  updateGSheetWithValidatedAnnotation (annotation, callback) {
    // Retrieve dimension of annotation
    let dimensionTag = _.find(annotation.tags, (tag) => {
      return tag.includes(this.tags.isFacetOf) || tag.includes(this.tags.facet)
    })
    // Search dimension and category of the validated annotation
    let dimension = null
    let category = null
    if (dimensionTag.includes(this.tags.isFacetOf)) { // Categorized dimension
      dimension = dimensionTag.replace(this.tags.isFacetOf, '')
      category = _.find(annotation.tags, (tag) => {
        return tag.includes(this.tags.code)
      }).replace(this.tags.code, '')
    } else if (dimensionTag.includes(this.tags.facet)) {
      dimension = dimensionTag.replace(this.tags.facet, '')
      category = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' }).exact
    } else {
      callback(new Error('This annotation is not belonged to a dimension.'))
    }
    // Set cell in spreadsheet in green and value+link to this annotation
    this.retrieveSpreadsheetMetadataForCurrentGroup((err, spreadsheetMetadata) => {
      if (err) {
        console.error(err)
      } else {
        this.askUserToLogInSheets((token) => {
          this.getSheet(spreadsheetMetadata, token, (sheet) => {
            let data = sheet.data[0].rowData
            let primaryStudyRow = this.retrievePrimaryStudyRow(data)
            let dimensionColumn = this.retrieveDimensionColumn(data, dimension)
            if (primaryStudyRow !== 0 && dimensionColumn !== 0) {
              // Define function to override cell
              let overrideCell = () => {
                this.setCellInColor({primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn},
                  token,
                  SLRDataExtractionContentScript.colors.green, () => {
                    let primaryStudyHyperlink = this.getHyperlinkFromCell(data[primaryStudyRow].values[0])
                    let link = this.getAnnotationUrl(annotation, primaryStudyHyperlink)
                    this.setCellValueWithLink(category, link, {primaryStudyRow: primaryStudyRow, dimensionColumn: dimensionColumn}, token, () => {
                      // Alert user with validation done
                      // Check if it is a good idea to create prompt saying that it is correctly validated
                      swal({ // TODO i18n
                        position: 'top-end',
                        type: 'success',
                        title: 'Correctly validated',
                        showConfirmButton: false,
                        timer: 1500
                      })
                      if (_.isFunction(callback)) {
                        callback()
                      }
                    })
                  })
              }
              // If cell has value or is not empty
              if (_.isObject(data[primaryStudyRow]) && _.isObject(data[primaryStudyRow].values[dimensionColumn])) {
                let cell = data[primaryStudyRow].values[dimensionColumn]
                // If current cell is empty or has the same value, override it
                if (_.isEmpty(cell.formattedValue) || // If cell is empty
                  _.isEmpty(cell.userEnteredFormat) || // If cell has not background color
                  (cell.userEnteredFormat.backgroundColor !== SLRDataExtractionContentScript.colors.green && // Background color is not green
                    cell.userEnteredFormat.backgroundColor !== SLRDataExtractionContentScript.colors.red && // Background color is not red
                    cell.formattedValue === category)
                ) {
                  overrideCell()
                } else {
                  let createOverridePrompt = (conflict) => {
                    let text = 'Facet is already validated with value: ' + cell.formattedValue + '<br/>Do you want to override it?'
                    let title = 'Facet is already validated'
                    if (conflict) {
                      text = 'Facet has a conflict.<br/>Do you want to validate with this category?'
                      title = 'Facet has a conflict'
                    }
                    // Create prompt
                    swal({ // TODO i18n
                      title: title,
                      html: text,
                      showCancelButton: true,
                      confirmButtonColor: '#3085d6',
                      cancelButtonColor: '#d33',
                      type: 'warning'
                    }).then((result) => {
                      if (result.value) {
                        overrideCell()
                      }
                    })
                  }
                  // If is already validated
                  if (_.isEqual(cell.userEnteredFormat.backgroundColor, SLRDataExtractionContentScript.colors.green)) {
                    // Ask if wants to override
                    createOverridePrompt()
                  } else if (_.isEqual(cell.userEnteredFormat.backgroundColor, SLRDataExtractionContentScript.colors.red)) {
                    // Ask if wants to override (conflict exists)
                    createOverridePrompt(true)
                  } else {
                    // Unknown error, maybe cell is empty, or whatever, don't do nothing
                    if (_.isFunction(callback)) {
                      callback(new Error('Unknown error'))
                    }
                  }
                }
              } else {
                // If cell is not found. Override it with values (It shouldn't happen, only if gSheet is edited manually)
                overrideCell()
              }
            } else {
              if (_.isFunction(callback)) {
                if (primaryStudyRow === 0) {
                  swal('Primary study not found', // TODO i18n
                    'Unable to validate this category. We couldn\'t find the primary study in the Google Sheet. Is it there?',
                    'error')
                } else {
                  if (dimensionColumn === 0) {
                    swal('Facet not found', // TODO i18n
                      'Unable to find the facet to validate this primary study. Is the facet in the spreadsheet?',
                      'error')
                  }
                }
              }
            }
          })
        })
      }
    })
  }
}

SLRDataExtractionContentScript.colors = {
  red: {
    'red': 0.8980392
  },
  white: {
    'red': 1,
    'green': 1,
    'blue': 1
  },
  green: {
    'red': 0.29803923, // Representation of color in gsheet for 0.3
    'green': 0.8,
    'blue': 0.29803923 // Representation of color in gsheet for 0.3
  }
}

module.exports = SLRDataExtractionContentScript
