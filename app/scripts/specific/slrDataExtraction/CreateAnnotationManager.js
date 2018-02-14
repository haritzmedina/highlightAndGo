const Events = require('../../contentScript/Events')
const Config = require('../../Config')
const HyperSheetColors = require('./HyperSheetColors')
// const swal = require('sweetalert2')
const _ = require('lodash')

class CreateAnnotationManager {
  constructor () {
    this.events = {}
    this.tags = {
      isCodeOf: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':',
      facet: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.group + ':',
      code: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.subgroup + ':'
    }
  }

  init (callback) {
    // Create event for annotation create
    this.events.annotationCreate = {element: document, event: Events.annotationCreated, handler: this.createAnnotationCreateEventHandler()}
    this.events.annotationCreate.element.addEventListener(this.events.annotationCreate.event, this.events.annotationCreate.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationCreateEventHandler () {
    return (event) => {
      // Add to google sheet the current annotation
      this.addClassificationToHypersheet(event.detail.annotation, (err) => {
        if (err) {
          // TODO Show user error
          console.error(err)
        } else {
          // Nothing to do
          console.debug('Correctly updated google sheet with created annotation')
        }
      })
    }
  }

  addClassificationToHypersheet (annotation, callback) {
    window.abwa.specific.primaryStudySheetManager.getGSheetData((err, gSheetData) => {
      if (err) {
        callback(new Error('Unable to retrieve data from google sheets'))
      } else {
        // Retrieve annotation facet (non-inductive)
        let facetTag = _.find(annotation.tags, (tag) => {
          return tag.includes(this.tags.isCodeOf)
        })
        if (facetTag) { // Non-inductive annotation
          let facetName = facetTag.replace(this.tags.isCodeOf, '')
          // Retrieve current facet
          let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
          if (!_.isEmpty(facet)) {
            let codeTag = _.find(annotation.tags, (tag) => {
              return tag.includes(this.tags.code)
            })
            if (_.isString(codeTag)) {
              let codeName = codeTag.replace(this.tags.code, '')
              // Retrieve current code
              let code = _.find(facet.codes, (code) => { return code.name === codeName })
              if (!_.isEmpty(code)) {
                // Multivalues and monovalues are treated in different ways
                if (facet.multivalued) {
                  this.addClassificationToHypersheetMultivalued(code, annotation, (err) => {
                    if (err) {
                      callback(err)
                    } else {
                      callback(null)
                    }
                  })
                } else {
                  this.addClassificationToHypersheetMonovalued(code, annotation, (err) => {
                    if (err) {
                      callback(err)
                    } else {
                      callback(null)
                    }
                  })
                }
              } else {
                callback(new Error('No code found for current annotation'))
              }
            } else {
              callback(new Error('No code tag found in annotation'))
            }
          } else {
            callback(new Error('No facet found for current annotation'))
          }
        } else {
          // Retrieve annotation facet (inductive)
          facetTag = _.find(annotation.tags, (tag) => {
            return tag.includes(this.tags.facet)
          })
          if (_.isString(facetTag)) {
            let facetName = facetTag.replace(this.tags.facet, '')
            let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
            if (facet) {
              this.addClassificationToHypersheetInductive(facet, annotation, (err) => {
                if (err) {
                  callback(err)
                } else {
                  callback(null)
                }
              })
            } else {
              callback(new Error('No facet found for current annotation'))
            }
          } else {
            callback(new Error('Annotation is not for mapping study'))
          }
        }
      }
    })
  }

  addClassificationToHypersheetMultivalued (code, currentAnnotation, callback) {
    this.getAllAnnotations((err, allAnnotations) => {
      let requests = [] // Requests to send to google sheets api
      if (err) {
        // Error while updating hypersheet, TODO notify user
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Retrieve annotations with same facet
        let facetAnnotations = _.filter(_.filter(allAnnotations, (annotation) => {
          return _.find(annotation.tags, (tag) => {
            return _.includes(tag, code.facet)
          })
        }), (iterAnnotation) => { // Filter current annotation if is retrieved in allAnnotations
          return !_.isEqual(iterAnnotation, currentAnnotation)
        })
        facetAnnotations.push(currentAnnotation) // Add current annotation
        // List all users who annotate the facet
        let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
        // List all codes used
        let uniqCodeTags = _.uniq(_.map(facetAnnotations, (facetAnnotation) => {
          return _.find(facetAnnotation.tags, (tag) => {
            return tag.includes('slr:code')
          })
        }))
        let cells = []
        for (let i = 0; i < uniqCodeTags.length; i++) {
          let uniqCodeTag = uniqCodeTags[i]
          let cell = {
            code: uniqCodeTag.replace(this.tags.code, '')
          }
          // If more than one user has classified this primary study
          if (uniqueUsers.length > 1) {
            // Check if all users have used this code
            if (this.allUsersHaveCode(facetAnnotations, uniqueUsers, uniqCodeTag)) {
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
            let startIndex = _.findIndex(headersRow, (cell) => { return cell.formattedValue === code.facet })
            let lastIndex = _.findLastIndex(headersRow, (cell) => { return cell.formattedValue === code.facet })
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
                this.createGSheetCellsFromCodeCells(cells, (err, gSheetCells) => {
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
                        endColumnIndex: lastColumnIndex + 1
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
                        callback(null)
                      }
                    })
                  }
                })
              }
            }
          }
        })
      }
    })
  }

  createGSheetCellsFromCodeCells (codeCells, callback) {
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        let gSheetCells = []
        for (let i = 0; i < codeCells.length; i++) {
          let codeCell = codeCells[i]
          let link = this.getAnnotationUrl(codeCell.annotation, primaryStudyLink)
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

  /**
   *
   * @param annotations
   * @param users
   * @param code
   * @returns {boolean} True if all users have an annotation with this code
   */
  allUsersHaveCode (annotations, users, codeTag) {
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

  addClassificationToHypersheetInductive (facet, currentAnnotation, callback) {
    this.getAllAnnotations((err, allAnnotations) => {
      if (err) {
        // Error while updating hypersheet
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Retrieve annotations with same facet
        let facetAnnotations = _.filter(_.filter(allAnnotations, (annotation) => {
          return _.find(annotation.tags, (tag) => {
            return _.includes(tag, facet.name)
          })
        }), (iterAnnotation) => { // Filter current annotation if is retrieved in allAnnotations
          return !_.isEqual(iterAnnotation, currentAnnotation)
        })
        if (facetAnnotations.length > 0) { // Other annotations are with same facet
          // Add to the analysis the current annotation
          facetAnnotations.push(currentAnnotation)
          // Check if more than one user has classified the facet
          let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
          if (uniqueUsers.length > 1) { // More than one reviewer has classified using same facet and code
            // Set in yellow background, and maintain the oldest annotation text
            this.updateInductiveFacetInGSheet(facet, facetAnnotations[0], HyperSheetColors.yellow, (err, result) => {
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
          } else {
            // Nothing to do, cause there is already text in cell
            // TODO Maybe in the future we must support multicolumn inductive codes ¿?
          }
        } else {
          this.updateInductiveFacetInGSheet(facet, currentAnnotation, HyperSheetColors.white, (err, result) => {
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
      }
    })
  }

  /**
   *
   * @param {Facet} facet
   * @param annotation
   * @param {Object} backgroundColor
   * @param {Function} callback
   */
  updateInductiveFacetInGSheet (facet, annotation, backgroundColor, callback) {
    // Retrieve link for primary study
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get link for cell
        let link = this.getAnnotationUrl(annotation, primaryStudyLink)
        // Retrieve row and cell
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow
        let sheetData = window.abwa.specific.primaryStudySheetManager.sheetData
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facet.name
        })
        // Retrieve value for the cell (text annotated)
        let value = this.getAnnotationValue(annotation)
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
                callback(null)
              }
            }
          })
        }
      }
    })
  }

  addClassificationToHypersheetMonovalued (code, currentAnnotation, callback) {
    this.getAllAnnotations((err, allAnnotations) => {
      if (err) {
        // Error while updating hypersheet
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Retrieve annotations with same facet
        let facetAnnotations = _.filter(_.filter(allAnnotations, (annotation) => {
          return _.find(annotation.tags, (tag) => {
            return _.includes(tag, code.facet)
          })
        }), (iterAnnotation) => { // Filter current annotation if is retrieved in allAnnotations
          return !_.isEqual(iterAnnotation, currentAnnotation)
        })
        if (facetAnnotations.length > 0) { // Other annotations are with same facet
          // Add to the analysis the current annotation
          facetAnnotations.push(currentAnnotation)
          // Retrieve all used codes to classify the current facet
          let uniqueCodes = _.uniq(_.map(facetAnnotations, (facetAnnotation) => {
            return _.find(facetAnnotation.tags, (tag) => {
              return tag.includes(this.tags.code)
            })
          }))
          if (uniqueCodes.length > 1) { // More than one is used, red background
            // Set in red background and maintain the oldest one annotation code
            this.updateMonovaluedFacetInGSheet(code.facet, code.name, facetAnnotations[0], HyperSheetColors.red, (err, result) => {
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
          } else {
            // Retrieve users who use the code in facet
            let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
            if (uniqueUsers.length > 1) { // More than one reviewer has classified using same facet and code
              // Set in yellow background
              this.updateMonovaluedFacetInGSheet(code.facet, code.name, facetAnnotations[0], HyperSheetColors.yellow, (err, result) => {
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
            } else {
              // Is the same user with the same code, nothing to update
              if (_.isFunction(callback)) {
                callback(null)
              }
            }
          }
        } else { // No other annotation is found with same facet
          this.updateMonovaluedFacetInGSheet(code.facet, code.name, currentAnnotation, HyperSheetColors.white, (err, result) => {
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
      }
    })
  }

  updateMonovaluedFacetInGSheet (facetName, codeName, currentAnnotation, color, callback) {
    // Retrieve link for primary study
    window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Get link for cell
        let link = this.getAnnotationUrl(currentAnnotation, primaryStudyLink)
        // Retrieve row and cell
        let row = window.abwa.specific.primaryStudySheetManager.primaryStudyRow
        let sheetData = window.abwa.specific.primaryStudySheetManager.sheetData
        let column = _.findIndex(sheetData.data[0].rowData[0].values, (cell) => {
          return cell.formattedValue === facetName
        })
        if (row !== 0 && column !== 0 && _.isString(link)) {
          window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.updateCell({
            row: row,
            column: column,
            value: codeName,
            link: link,
            backgroundColor: color,
            spreadsheetId: window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId,
            sheetId: window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
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

  getAnnotationValue (annotation) {
    let selector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
    if (_.has(selector, 'exact')) {
      return selector.exact
    } else {
      return null
    }
  }

  getAllAnnotations (callback) {
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

  destroy (callback) {
    // Remove the event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
  }
}

module.exports = CreateAnnotationManager
