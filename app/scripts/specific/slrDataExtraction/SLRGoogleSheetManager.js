const GoogleSheetClientManager = require('../../googleSheets/GoogleSheetsClientManager')
const Alerts = require('../../utils/Alerts')
const AnnotationUtils = require('../../utils/AnnotationUtils')
const URLUtils = require('../../utils/URLUtils')
const _ = require('lodash')
const HyperSheetColors = require('./HyperSheetColors')

class SLRGoogleSheetManager {
  init (callback) {
    this.initGoogleSheetClientManager(() => {
      this.getGoogleSheetPreferences(callback)
    })
  }

  initGoogleSheetClientManager (callback) {
    // Login in google sheets
    this.googleSheetClientManager = new GoogleSheetClientManager()
    this.googleSheetClientManager.init(() => {
      this.googleSheetClientManager.logInGoogleSheets((err) => {
        if (err) {
          Alerts.warningAlert({text: 'It is recommended to give permissions to google sheets. Part of the functionality of the extension will not work correctly.'})
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback(null)
          }
        }
      })
    })
  }

  getGoogleSheetPreferences (callback) {
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getPreferences'}, ({preferences}) => {
      this.preferences = preferences
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  createSpreadsheet (callback) {
    // TODO Check if slr:spreadsheet annotation exists
    // TODO If exists, ask user overwrite or create new
    Alerts.loadingAlert({title: 'Creating spreadsheet', text: 'Please be patient...'})
    let promises = []
    // Promise to create spreadsheet
    promises.push(new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        scope: 'googleSheets',
        cmd: 'createSpreadsheet',
        data: {
          properties: {
            title: window.abwa.groupSelector.currentGroup.name,
            locale: 'en'
          },
          sheets: [
            {
              properties: {
                gridProperties: {
                  columnCount: 1000,
                  rowCount: 2000
                },
                sheetId: 0
              }
            }
          ]
        }
      }, (result) => {
        if (_.has(result.err)) {
          reject(result.err)
        } else {
          resolve({spreadsheet: result})
        }
      })
    }))
    // Promise to retrieve all annotations from current group
    promises.push(new Promise((resolve, reject) => {
      // TODO Change the limit of annotations
      window.abwa.storageManager.client.searchAnnotations({
        group: window.abwa.groupSelector.currentGroup.id,
        limit: 100000000,
        order: 'desc',
        sort: 'updated'
      }, (err, annotations) => {
        if (err) {
          reject(err)
        } else {
          resolve({annotations: annotations})
        }
      })
    }))
    Promise.all(promises).catch(() => {

    }).then((resolves) => {
      console.debug(resolves)
      let annotationsResolve = _.find(resolves, (resolve) => { return _.has(resolve, 'annotations') })
      let spreadsheetResolve = _.find(resolves, (resolve) => { return _.has(resolve, 'spreadsheet') })
      let spreadsheetId = spreadsheetResolve.spreadsheet.spreadsheetId
      // Get annotations for coding and assessing
      let slrInfo = this.getSLRInfoFromAnnotations(annotationsResolve.annotations)
      let primaryStudies = slrInfo.primaryStudies
      let sheetId = 0
      // Update spreadsheet with primary studies data
      let rows = []
      // Calculate for each code which one is the number of columns (multivalued or single code use cases)
      let columns = this.calculateColumns(primaryStudies)
      // First row is for codebook facets
      let parentCodes = _.filter(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.parentCode === null
      })
      rows.push(this.createHeaderSpreadsheetRow(parentCodes, columns))
      // Retrieve rows for primary studies
      for (let i = 0; i < primaryStudies.length; i++) {
        rows.push(primaryStudies[i].toSpreadsheetRow(columns))
      }
      console.debug(rows)
      chrome.runtime.sendMessage({
        scope: 'googleSheets',
        cmd: 'updateSpreadsheet',
        data: {
          spreadsheetId: spreadsheetId,
          sheetId: sheetId,
          rows: rows,
          rowIndex: 0,
          columnIndex: 0
        }
      }, (result) => {
        if (_.has(result, 'error')) {
          callback(result.error)
        } else {
          callback(null, {spreadsheetId: spreadsheetId, sheetId: sheetId})
        }
      })
    })
  }

  calculateColumns (primaryStudies) {
    // Get all parent codes
    let codes = window.abwa.mappingStudyManager.classificationScheme.codes
    let parentCodes = _.filter(codes, (code) => {
      return code.parentCode === null
    })
    return parentCodes.map((parentCode) => {
      let primaryStudyWithMaxValuesForThisCode = _.maxBy(primaryStudies, (ps) => {
        if (_.has(ps.codes, parentCode.id)) {
          return ps.codes[parentCode.id].numberOfColumns({allEvidenceSheet: this.preferences.allEvidenceSheet})
        } else {
          return 1
        }
      })
      if (_.has(primaryStudyWithMaxValuesForThisCode.codes, parentCode.id)) {
        return {parentCode: parentCode, columns: primaryStudyWithMaxValuesForThisCode.codes[parentCode.id].numberOfColumns({allEvidenceSheet: this.preferences.allEvidenceSheet})}
      } else {
        return {parentCode: parentCode, columns: 1}
      }
    })
  }

  createHeaderSpreadsheetRow (parentCodes, codesColumnCalc) {
    let cells = []
    // Title cell
    cells.push({
      userEnteredValue: {
        formulaValue: '=HYPERLINK("' + window.abwa.groupSelector.currentGroup.url + '", "Title")'
      }
    })
    // Fill columns headers and take into account for each parent code which one is the number of columns (multivalued use case)
    for (let i = 0; i < codesColumnCalc.length; i++) {
      let lengthOfCurrentColumn = codesColumnCalc[i].columns
      let code = codesColumnCalc[i].parentCode
      for (let j = 0; j < lengthOfCurrentColumn; j++) {
        cells.push({
          userEnteredValue: {
            stringValue: code.name
          }
        })
      }
    }
    return {
      values: cells
    }
  }

  getSLRInfoFromAnnotations (annotations) {
    let codingAnnotations = _.filter(annotations, (annotation) => {
      return annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying'
    })
    let validatingAnnotations = _.filter(annotations, (annotation) => {
      return annotation.motivation === 'assessing' || annotation.motivation === 'oa:assessing'
    })
    let anAnnotationForEachPrimaryStudy = _.uniqWith(codingAnnotations, (a, b) => {
      return AnnotationUtils.areFromSameDocument(a, b)
    })
    let users = _.map(_.uniqBy(codingAnnotations, (anno) => { return anno['user'] }), 'user')
    /* let codes = window.abwa.mappingStudyManager.classificationScheme.codes
    let parentCodesWithOnlyOneParent = _.filter(codes, (code) => {
      return code.parentCode !== null && code.parentCode.parentCode === null
    })
    let parentCodesWithoutChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length === 0
    }) */
    // Create primary studies
    let primaryStudies = []
    for (let i = 0; i < anAnnotationForEachPrimaryStudy.length; i++) {
      let annotationForPrimaryStudy = anAnnotationForEachPrimaryStudy[i]
      let codingAnnotationsForPrimaryStudy = _.filter(codingAnnotations, (codingAnnotation) => {
        return AnnotationUtils.areFromSameDocument(annotationForPrimaryStudy, codingAnnotation)
      })
      // Retrieve from any annotation the document title and url
      let title
      try {
        // Look for any annotation with document title
        let annotationWithTitle = _.find(codingAnnotationsForPrimaryStudy, (annotation) => {
          if (_.has(annotation, 'target[0].source.title')) {
            return _.isString(annotation.target[0].source.title)
          }
        })
        if (annotationWithTitle) {
          title = annotationWithTitle.target[0].source.title
        } else {
          annotationWithTitle = _.find(codingAnnotationsForPrimaryStudy, (annotation) => {
            return _.isArray(annotation.document.title)
          })
          if (annotationWithTitle) {
            title = annotationWithTitle.document.title[0]
          }
        }
      } catch (e) {
        title = 'Primary Study ' + i
      }
      // Retrieve annotated document url (doi or url)
      let url
      try {
        // Most reliable annotation
        let annotationWithUrl = _.find(codingAnnotationsForPrimaryStudy, (annotation) => {
          if (_.has(annotation, 'target[0].source') && _.has(annotation, 'documentMetadata.link')) {
            let links = annotation.documentMetadata.link.map(l => l.href).concat(annotation.target[0].source)
            return links.find(l => !l.includes('dropboxuser') && !l.startsWith('urn:'))
          }
        })
        // If not found
        if (!annotationWithUrl) {
          annotationWithUrl = _.find(codingAnnotationsForPrimaryStudy, (annotation) => {
            if (_.has(annotation, 'target[0].source')) {
              return URLUtils.isUrl(annotation.target[0].source.url) || URLUtils.isUrl(annotation.target[0].source.doi) || URLUtils.isUrl(annotation.uri)
            }
          })
        }
        url = annotationWithUrl.target[0].source.doi || annotationWithUrl.target[0].source.url || annotationWithUrl.uri
        if (url.includes('https://www.dropbox.com') && url.endsWith('raw=1url')) {
          url = url.replace('raw=1url', 'raw=1')
        }
      } catch (e) {
        url = null
      }
      // Retrieve users for current primary study
      let usersForPrimaryStudy = _.map(_.uniqBy(codingAnnotationsForPrimaryStudy, (anno) => { return anno['user'] }), 'user')
      let primaryStudy = new PrimaryStudy({metadata: {url: url, title: title}, users: usersForPrimaryStudy})
      let parentCodes = {}
      for (let i = 0; i < codingAnnotationsForPrimaryStudy.length; i++) {
        let codingAnnotationForPrimaryStudy = codingAnnotationsForPrimaryStudy[i]
        // Check if annotation is validated
        let validatingAnnotation = _.find(validatingAnnotations, (validatingAnnotation) => {
          let validatedAnnotationId = validatingAnnotation['oa:target'].replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
          return codingAnnotationForPrimaryStudy.id === validatedAnnotationId
        })
        if (codingAnnotationForPrimaryStudy.body) {
          let codeId = codingAnnotationForPrimaryStudy.body.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
          let code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => { return code.id === codeId })
          if (code) {
            let parentCode = code.getAncestorCode()
            let firstLevelCode = _.find(parentCode.codes, (firstLevelChild) => { return code.isChildOf(firstLevelChild) || code === firstLevelChild })
            if (_.has(parentCodes, parentCode.id) && firstLevelCode) {
              if (_.has(parentCodes[parentCode.id].chosenCodes, firstLevelCode.id)) {
                parentCodes[parentCode.id].chosenCodes[firstLevelCode.id].annotations.push(codingAnnotationForPrimaryStudy)
                if (validatingAnnotation) {
                  parentCodes[parentCode.id].chosenCodes[firstLevelCode.id].validatingAnnotation = validatingAnnotation
                }
              } else {
                // If chosen code is parent itself
                if (parentCode.id !== code.id && firstLevelCode) {
                  // If chosen code is new
                  parentCodes[parentCode.id].chosenCodes[firstLevelCode.id] = new Code({url, codeId: firstLevelCode.id, codeName: firstLevelCode.name, annotations: [codingAnnotationForPrimaryStudy], validatingAnnotation})
                } else if (parentCode.id === code.id) {
                  parentCodes[parentCode.id].itself = [codingAnnotationForPrimaryStudy]
                  if (validatingAnnotation) {
                    parentCodes[parentCode.id].validatingAnnotations.push(validatingAnnotation)
                  }
                }
              }
            } else {
              if (parentCode.id !== code.id && firstLevelCode) {
                let chosenCodes = {}
                chosenCodes[firstLevelCode.id] = new Code({url, codeId: firstLevelCode.id, codeName: firstLevelCode.name, annotations: [codingAnnotationForPrimaryStudy], validatingAnnotation})
                parentCodes[parentCode.id] = new Codes({url, parentCode, chosenCodes, multivalued: parentCode.multivalued})
              } else if (parentCode.id === code.id) {
                if (parentCodes[parentCode.id]) {
                  parentCodes[parentCode.id].itself = codingAnnotationForPrimaryStudy
                  if (validatingAnnotation) {
                    parentCodes[parentCode.id].validatingAnnotations.push(validatingAnnotation)
                  }
                } else {
                  parentCodes[parentCode.id] = new Codes({url, parentCode, multivalued: parentCode.multivalued, itself: codingAnnotationForPrimaryStudy, validatingAnnotation})
                }
              }
            }
            parentCodes[parentCode.id].annotations.push(codingAnnotationForPrimaryStudy)
          }
        }
      }
      primaryStudy.codes = parentCodes
      primaryStudies.push(primaryStudy)
    }
    return {primaryStudies: primaryStudies, users: users}
  }
}

class PrimaryStudy {
  constructor ({metadata, codes, users}) {
    this.title = metadata.title
    this.url = metadata.url
    this.codes = codes
    this.users = users // Users that had codified this primary study
  }

  toSpreadsheetRow (codesColumnCalc) {
    let cells = []
    // Title column
    if (this.url) {
      cells.push({
        userEnteredValue: {
          formulaValue: '=HYPERLINK("' + this.url + '", "' + this.title + '")'
        }
      })
    } else {
      cells.push({
        userEnteredValue: {
          stringValue: this.title
        }
      })
    }
    // Calculate the rest of the columns based on columnsCalc
    for (let i = 0; i < codesColumnCalc.length; i++) {
      let lengthOfCurrentColumn = codesColumnCalc[i].columns
      let code = codesColumnCalc[i].parentCode
      if (_.has(this.codes, code.id)) {
        // Filled cells
        let currentCodeCells = this.codes[code.id].toCells(this.users)
        // Empty cells
        for (let j = currentCodeCells.length; j < lengthOfCurrentColumn; j++) {
          currentCodeCells.push({userEnteredValue: {stringValue: ''}})
        }
        cells = cells.concat(currentCodeCells)
      } else {
        // No evidence in current primary study for that code, all empty
        // Empty cells
        for (let j = 0; j < lengthOfCurrentColumn; j++) {
          cells.push({userEnteredValue: {stringValue: ''}})
        }
      }
    }
    return {
      values: cells
    }
  }
}

class Code {
  constructor ({url, codeId, codeName, annotations, validatingAnnotation}) {
    this.url = url
    this.codeId = codeId
    this.codeName = codeName
    this.annotations = annotations
    this.validatingAnnotation = validatingAnnotation
  }

  toCell (users) {
    if (this.validatingAnnotation) {
      // Find validated annotation
      let validatedAnnotationId = this.validatingAnnotation['oa:target'].replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
      let annotation = _.find(this.annotations, (annotation) => { return annotation.id === validatedAnnotationId })
      if (!_.isObject(annotation)) { // If not found, retrieve first annotation, but something is probably wrong
        annotation = this.annotations[0]
      }
      return {
        userEnteredValue: {
          formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + this.codeName + '")'
        },
        userEnteredFormat: {
          backgroundColor: HyperSheetColors.green
        }
      }
    } else {
      if (users.length > 1) {
        // Yellow or red, because more than one user has annotations in this Primary Study
        let allUsersWithThisCode = _.every(users, (user) => {
          return _.find(this.annotations, (annotation) => {
            return annotation.user === user
          })
        })
        let annotation = this.annotations[0]
        if (allUsersWithThisCode) {
          return {
            userEnteredValue: {
              formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + this.codeName + '")'
            },
            userEnteredFormat: {
              backgroundColor: HyperSheetColors.yellow
            }
          }
        } else {
          return {
            userEnteredValue: {
              formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + this.codeName + '")'
            },
            userEnteredFormat: {
              backgroundColor: HyperSheetColors.red
            }
          }
        }
      } else {
        // If only 1 user has annotated, it must be white
        let annotation = this.annotations[0]
        return {
          userEnteredValue: {
            formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + this.codeName + '")'
          }
        }
      }
    }
  }
}

Code.status = {
  'inProgress': {
    name: 'inProgress'
  },
  'conflicting': {
    name: 'conflicting'
  },
  'coinciding': {
    name: 'coinciding'
  },
  'validated': {
    name: 'validated'
  }
}

class Codes {
  constructor ({url, parentCode, annotations = [], chosenCodes = {}, itself, multivalued = false, validatingAnnotation}) {
    this.url = url
    this.annotations = annotations
    this.parentCode = parentCode
    this.chosenCodes = chosenCodes
    this.itself = itself
    this.multivalued = multivalued
    this.validatingAnnotations = []
    if (validatingAnnotation) {
      this.validatingAnnotations.push(validatingAnnotation)
    }
  }

  numberOfColumns ({allEvidenceSheet}) {
    if (this.multivalued) {
      return _.values(this.chosenCodes).length || 1
    } else if (allEvidenceSheet) {
      if (_.values(this.chosenCodes).length > 0) {
        return _.values(this.chosenCodes).length || 1
      } else {
        return this.annotations.length || 1
      }
    } else {
      return 1
    }
  }

  toCells (allUsers) {
    let pairs = _.toPairs(this.chosenCodes)
    if (pairs.length > 0) {
      if (this.multivalued) {
        // If multivalued
        let chosenCodes = _.values(this.chosenCodes)
        let cells = []
        for (let i = 0; i < chosenCodes.length; i++) {
          let chosenCode = chosenCodes[i]
          cells.push(chosenCode.toCell(allUsers))
        }
        return cells
      } else {
        // No multivalued, codify status
        let chosenCodes = _.values(this.chosenCodes)
        // Check if someone is validated
        let validatedCode = _.find(chosenCodes, (chosenCode) => { return chosenCode.validatingAnnotation })
        if (validatedCode) {
          // Find validated annotation
          let validatedAnnotationId = validatedCode.validatingAnnotation['oa:target'].replace(window.abwa.storageManager.storageMetadata.annotationUrl, '')
          let annotation = _.find(validatedCode.annotations, (annotation) => { return annotation.id === validatedAnnotationId })
          if (!_.isObject(annotation)) { // If not found, retrieve first annotation, but something is probably wrong
            annotation = validatedCode.annotations[0]
          }
          return [{
            userEnteredValue: {
              formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + validatedCode.codeName + '")'
            },
            userEnteredFormat: {
              backgroundColor: HyperSheetColors.green
            }
          }]
        } else {
          // Can be in conflict or coinciding, if more than one code, is conflicting, if only one, coinciding or in-progress
          if (chosenCodes.length > 1) {
            let annotation = chosenCodes[0].annotations[0] // Retrieve one annotation
            // Conflict
            return [{
              userEnteredValue: {
                formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + chosenCodes[0].codeName + '")'
              },
              userEnteredFormat: {
                backgroundColor: HyperSheetColors.red
              }
            }]
          } else {
            // Review all users
            let annotation = chosenCodes[0].annotations[0] // Retrieve one annotation
            let chosenCode = chosenCodes[0]
            let every = _.every(allUsers, (user) => {
              let index = _.findIndex(chosenCode.annotations, (annotation) => {
                return user === annotation.user
              })
              return index !== -1
            })
            /* let every = _.every(chosenCode.annotations, (annotation) => {
              let index = _.findIndex(allUsers, (user) => {
                return user === annotation.user
              })
              return index !== -1
            }) */
            if (every && allUsers.length > 1) {
              // All reviewers has annotated with that code and more than one reviewer has codified the PS
              return [{
                userEnteredValue: {
                  formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + chosenCodes[0].codeName + '")'
                },
                userEnteredFormat: {
                  backgroundColor: HyperSheetColors.yellow
                }
              }]
            } else {
              // Not all reviewers has annotated with that code or there is only one reviewer that has codified the PS
              return [{
                userEnteredValue: {
                  formulaValue: '=HYPERLINK("' + this.url + '#hag:' + annotation.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + chosenCodes[0].codeName + '")'
                }
              }]
            }
          }
        }
      }
    } else {
      if (window.abwa.toolset.slrGoogleSheetManager.preferences.allEvidenceSheet) {
        return this.annotations.map(anno => {
          // Get quote of annotation in itself
          let textQuoteSelector = _.find(anno.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
          let quote = 'Quote'
          if (textQuoteSelector && textQuoteSelector.exact) {
            quote = textQuoteSelector.exact
          }
          if (this.validatingAnnotations.length > 0) {
            let validatingAnnotation = this.validatingAnnotations.find(validatingAnnotation => {
              return validatingAnnotation['oa:target'].replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') === anno.id
            })
            if (validatingAnnotation && validatingAnnotation.agreement === 'agree') {
              // Set green only if current annotation is validated positively
              return [
                {userEnteredValue: {
                  formulaValue: '=HYPERLINK("' + this.url + '#hag:' + anno.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + quote + '")'
                },
                userEnteredFormat: {
                  backgroundColor: HyperSheetColors.green
                }
                }]
            } else {
              return [{userEnteredValue: {
                formulaValue: '=HYPERLINK("' + this.url + '#hag:' + anno.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + quote + '")'
              }}]
            }
          } else {
            return [{
              userEnteredValue: {
                formulaValue: '=HYPERLINK("' + this.url + '#hag:' + anno.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + quote + '")'
              }
            }]
          }
        })
      } else {
        if (this.itself) {
          // Get quote of annotation in itself
          let textQuoteSelector = _.find(this.itself.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
          let quote = 'Quote'
          if (textQuoteSelector && textQuoteSelector.exact) {
            quote = textQuoteSelector.exact
          }
          if (this.validatingAnnotations.length > 0) {
            let validatingAnnotation = this.validatingAnnotations.find(validatingAnnotation => {
              return validatingAnnotation['oa:target'].replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') === this.itself.id
            })
            if (validatingAnnotation && validatingAnnotation.agreement === 'agree') {
              // Set green only if current annotation is validated positively
              return [
                {userEnteredValue: {
                  formulaValue: '=HYPERLINK("' + this.url + '#hag:' + this.itself.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + quote + '")'
                },
                userEnteredFormat: {
                  backgroundColor: HyperSheetColors.green
                }
                }]
            } else {
              return [{userEnteredValue: {
                formulaValue: '=HYPERLINK("' + this.url + '#hag:' + this.itself.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + quote + '")'
              }}]
            }
          } else {
            return [{userEnteredValue: {
              formulaValue: '=HYPERLINK("' + this.url + '#hag:' + this.itself.id.replace(window.abwa.storageManager.storageMetadata.annotationUrl, '') + '", "' + quote + '")'
            }}]
          }
        }
      }
    }
    return []
  }
}

module.exports = SLRGoogleSheetManager
