const HyperSheetColors = require('./HyperSheetColors')
const _ = require('lodash')
const Config = require('../../Config')

class CommonHypersheetManager {
  static updateClassificationMultivalued (facetAnnotations, facet, callback) {
    let requests = [] // Requests to send to google sheets api
    // List all users who annotate the facet
    let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
    // List all codes used
    let uniqCodeTags = _.uniq(_.map(facetAnnotations, (facetAnnotation) => {
      return _.find(facetAnnotation.tags, (tag) => {
        return tag.includes(CommonHypersheetManager.tags.code)
      })
    }))
    let cells = []
    for (let i = 0; i < uniqCodeTags.length; i++) {
      let uniqCodeTag = uniqCodeTags[i]
      let cell = {
        code: uniqCodeTag.replace(CommonHypersheetManager.tags.code, '')
      }
      // If more than one user has classified this primary study
      if (uniqueUsers.length > 1) {
        // Check if all users have used this code
        if (CommonHypersheetManager.allUsersHaveCode(facetAnnotations, uniqueUsers, uniqCodeTag)) {
          cell.color = HyperSheetColors.yellow // All users used code
        } else {
          cell.color = HyperSheetColors.red // Non all users used code
        }
      } else {
        cell.color = HyperSheetColors.white
      }
      // Get oldest annotation for code
      cell.annotation = _.find(facetAnnotations, (annotation) => {
        return _.find(annotation.tags, (tag) => {
          return tag === uniqCodeTag
        })
      })
      cells.push(cell)
    }
    // Order cells by name
    cells = _.sortBy(cells, 'code')
    // Check if sufficient columns to add all codes to spreadsheet
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, sheetData) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Retrieve start and end columns for facet
        let headersRow = sheetData.data[0].rowData[0].values
        let startIndex = _.findIndex(headersRow, (cell) => { return cell.formattedValue === facet })
        let lastIndex = _.findLastIndex(headersRow, (cell) => { return cell.formattedValue === facet })
        if (startIndex === -1 || lastIndex === -1) {
          callback(new Error('Unable to find column for current facet'))
        } else {
          if (startIndex === lastIndex) {
            callback(new Error('Facet was multivalued, but nowadays only has a column. Please duplicate the column for this facet.'))
          } else {
            let columnsForFacet = lastIndex - startIndex + 1
            if (columnsForFacet >= cells.length) {
              // Sufficient columns for all data
            } else {
              // Need to create new column to insert all the facets
              let appendColumnRequest = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestInsertEmptyColumn({
                sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId,
                startIndex: lastIndex,
                numberOfColumns: cells.length - columnsForFacet
              })
              requests.push(appendColumnRequest)
              // Need to add header to the new columns
              let newColumnsHeaderRequest = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestCopyCell({
                sourceRow: 0,
                sourceColumn: startIndex,
                destinationRow: 0,
                destinationColumn: lastIndex,
                destinationNumberOfColumns: cells.length - columnsForFacet + 1,
                sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
              })
              requests.push(newColumnsHeaderRequest)
            }
            // Create cells for values to be inserted
            CommonHypersheetManager.createGSheetCellsFromCodeCells(cells, (err, gSheetCells) => {
              if (err) {
                if (_.isFunction(callback)) {
                  callback(err)
                }
              } else {
                // Retrieve last column number (if new columns are created, calculate, else lastIndex
                let lastColumnIndex = (cells.length - columnsForFacet + 1) > 0 ? lastIndex + cells.length - columnsForFacet + 1 : lastIndex
                // Create request to insert the values to spreadsheet
                let updateCellsRequest = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestUpdateCells({
                  cells: gSheetCells,
                  range: {
                    sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId,
                    startRowIndex: window.abwa.specific.primaryStudySheetManager.primaryStudyRow,
                    startColumnIndex: startIndex,
                    endRowIndex: window.abwa.specific.primaryStudySheetManager.primaryStudyRow + 1,
                    endColumnIndex: lastColumnIndex
                  }
                })
                requests.push(updateCellsRequest)
                window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.batchUpdate({
                  spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
                  requests: requests
                }, (err, result) => {
                  if (err) {
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
            })
          }
        }
      }
    })
  }

  static updateClassificationInductive (facetAnnotations, facet, callback) {
    if (facetAnnotations.length === 0) { // If no annotations for this facet, clean cell value
      // TODO Clear cell
      CommonHypersheetManager.cleanMonovaluedFacetInGSheet(facet.name, (err, result) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback(null, result)
          }
        }
      })
    } else {
      // Check if more than one user has classified the facet
      let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
      // If more than one yellow, in other case white
      let color = uniqueUsers.length > 1 ? HyperSheetColors.yellow : HyperSheetColors.white
      CommonHypersheetManager.updateInductiveFacetInGSheet(facet, facetAnnotations[0], color, (err, result) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback(null, result)
          }
        }
      })
    }
  }

  /**
   *
   * @param {String} facetName
   * @param annotation
   * @param {Object} backgroundColor
   * @param {Function} callback
   */
  static updateInductiveFacetInGSheet (facetName, annotation, backgroundColor, callback) {
    // Retrieve link for primary study
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get link for cell
        let link = CommonHypersheetManager.getAnnotationUrl(annotation, primaryStudyLink)
        // Retrieve row and cell
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow
        let sheetData = window.abwa.specific.primaryStudySheetManager.sheetData
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facetName
        })
        // Retrieve value for the cell (text annotated)
        let value = CommonHypersheetManager.getAnnotationValue(annotation)
        if (row !== 0 && column !== 0 && _.isString(link)) {
          window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.updateCell({
            row: row,
            column: column,
            value: value,
            link: link,
            backgroundColor: backgroundColor,
            spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
            sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
          }, (err, result) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null, result)
              }
            }
          })
        }
      }
    })
  }

  static updateClassificationMonovalued (facetAnnotations, facetName, callback) {
    if (facetAnnotations.length === 0) { // If no annotations for this facet, clean cell value
      // Clear cell
      CommonHypersheetManager.cleanMonovaluedFacetInGSheet(facetName, (err, result) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback(null, result)
          }
        }
      })
    } else {
      // Retrieve oldest annotation's code
      let codeNameTag = _.find(facetAnnotations[0].tags, (tag) => { return tag.includes(CommonHypersheetManager.tags.code) })
      if (!_.isString(codeNameTag)) {
        if (_.isFunction(callback)) {
          callback(new Error('Error while updating hypersheet. Oldest annotation hasn\'t code tag'))
        }
      } else {
        let codeName = codeNameTag.replace(CommonHypersheetManager.tags.code, '')
        if (facetAnnotations.length > 1) { // Other annotations are with same facet
          // Retrieve all used codes to classify the current facet
          let uniqueCodes = _.uniq(_.map(facetAnnotations, (facetAnnotation) => {
            return _.find(facetAnnotation.tags, (tag) => {
              return tag.includes(CommonHypersheetManager.tags.code)
            })
          }))
          if (uniqueCodes.length > 1) { // More than one is used, red background
            // Set in red background and maintain the oldest one annotation code
            CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.red, (err, result) => {
              if (err) {
                if (_.isFunction(callback)) {
                  callback(err)
                }
              } else {
                if (_.isFunction(callback)) {
                  callback(null, result)
                }
              }
            })
          } else {
            // Retrieve users who use the code in facet
            let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
            if (uniqueUsers.length > 1) { // More than one reviewer has classified using same facet and code
              // Set in yellow background
              CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.yellow, (err, result) => {
                if (err) {
                  if (_.isFunction(callback)) {
                    callback(err)
                  }
                } else {
                  if (_.isFunction(callback)) {
                    callback(null, result)
                  }
                }
              })
            } else {
              // Is the same user with the same code, nothing to update
              if (_.isFunction(callback)) {
                callback(null)
              }
            }
          }
        } else { // No other annotation is found with same facet
          CommonHypersheetManager.updateMonovaluedFacetInGSheet(facetName, codeName, facetAnnotations[0], HyperSheetColors.white, (err, result) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null, result)
              }
            }
          })
        }
      }
    }
  }

  static cleanMonovaluedFacetInGSheet (facetName, callback) {
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, sheetData) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facetName
        })
        if (row !== 0 && column !== 0) {
          let request = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestUpdateCell({
            row: row,
            column: column,
            value: '',
            backgroundColor: HyperSheetColors.white,
            sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
          })
          window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.batchUpdate({
            spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
            requests: [request]
          }, (err, result) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null, result)
              }
            }
          })
        }
      }
    })
  }

  static updateMonovaluedFacetInGSheet (facetName, codeName, currentAnnotation, color, callback) {
    // Retrieve link for primary study
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get link for cell
        let link = CommonHypersheetManager.getAnnotationUrl(currentAnnotation, primaryStudyLink)
        // Retrieve row and cell
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow
        let sheetData = window.abwa.specific.primaryStudySheetManager.sheetData
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facetName
        })
        if (row !== 0 && column !== 0 && _.isString(link)) {
          // Create request to send to google sheet api
          let request = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestUpdateCell({
            row: row,
            column: column,
            value: codeName,
            link: link,
            backgroundColor: color,
            sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
          })
          window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.batchUpdate({
            spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
            requests: [request]
          }, (err, result) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null, result)
              }
            }
          })
        }
      }
    })
  }

  static createGSheetCellsFromCodeCells (codeCells, callback) {
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        let gSheetCells = []
        for (let i = 0; i < codeCells.length; i++) {
          let codeCell = codeCells[i]
          let link = CommonHypersheetManager.getAnnotationUrl(codeCell.annotation, primaryStudyLink)
          let value = codeCell.code
          let formulaValue = '=HYPERLINK("' + link + '", "' + value + '")'
          gSheetCells.push({
            'userEnteredFormat': {
              'backgroundColor': codeCell.color
            },
            'userEnteredValue': {
              'formulaValue': formulaValue
            }
          })
        }
        if (_.isFunction(callback)) {
          callback(null, gSheetCells)
        }
      }
    })
  }

  static getAllAnnotations (callback) {
    window.abwa.contentAnnotator.getAllAnnotations((err, allAnnotations) => {
      if (err) {
        allAnnotations = window.abwa.contentAnnotator.allAnnotations // Retrieve near-latest annotations
      }
      if (_.isArray(allAnnotations)) {
        if (_.isFunction(callback)) {
          callback(null, allAnnotations)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(new Error('No annotations instance found for this document. Fatal error!'))
        }
      }
    })
  }

  /**
   *
   * @param annotations
   * @param users
   * @param code
   * @returns {boolean} True if all users have an annotation with this code
   */
  static allUsersHaveCode (annotations, users, codeTag) {
    for (let i = 0; i < users.length; i++) {
      let user = users[i]
      let annotation = _.find(annotations, (annotation) => {
        return annotation.user === user && _.find(annotation.tags, (tag) => {
          return tag === codeTag
        })
      })
      if (!_.isObject(annotation)) {
        return false
      }
    }
    return true
  }

  static getAnnotationUrl (annotation, primaryStudyURL) {
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

  static getAnnotationValue (annotation) {
    let selector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
    if (_.has(selector, 'exact')) {
      return selector.exact
    } else {
      return null
    }
  }
}

CommonHypersheetManager.tags = {
  isCodeOf: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':',
  facet: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.group + ':',
  code: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.subgroup + ':'
}

module.exports = CommonHypersheetManager
