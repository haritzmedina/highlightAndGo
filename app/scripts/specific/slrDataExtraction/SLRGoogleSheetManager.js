const GoogleSheetClientManager = require('../../googleSheets/GoogleSheetsClientManager')
const Alerts = require('../../utils/Alerts')
const _ = require('lodash')
const HyperSheetColors = require('./HyperSheetColors')

class SLRGoogleSheetManager {
  init (callback) {
    this.initGoogleSheetClientManager(callback)
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

  createSpreadsheet (callback) {
    // TODO Check if slr:spreadsheet annotation exists
    // TODO If exists, ask user overwrite or create new
    Alerts.loadingAlert({text: 'Creating spreadsheet, please be patient...'})
    let promises = []
    // Promise to create spreadsheet
    promises.push(new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        scope: 'googleSheets',
        cmd: 'createSpreadsheet',
        data: {properties: {title: window.abwa.groupSelector.currentGroup.name}}
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
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({group: window.abwa.groupSelector.currentGroup.id, limit: 100000000}, (err, annotations) => {
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
      let users = slrInfo.users
      let sheetId = 0
      // Update spreadsheet with primary studies data
      let rows = []
      // Calculate for each code which one is the number of columns (multivalued use case)
      let columns = this.calculateColumns(primaryStudies)
      // First row is for codebook facets
      let parentCodes = _.filter(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.parentCode === null
      })
      rows.push(this.createHeaderSpreadsheetRow(parentCodes, columns))
      // Retrieve rows for primary studies
      for (let i = 0; i < primaryStudies.length; i++) {
        rows.push(primaryStudies[i].toSpreadsheetRow(columns, users))
      }
      console.log(rows)
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
          callback(null, 'https://docs.google.com/spreadsheets/d/' + spreadsheetId)
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
          return ps.codes[parentCode.id].numberOfColumns()
        } else {
          return 1
        }
      })
      if (_.has(primaryStudyWithMaxValuesForThisCode.codes, parentCode.id)) {
        return {parentCode: parentCode, columns: primaryStudyWithMaxValuesForThisCode.codes[parentCode.id].numberOfColumns()}
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
    // TODO Fill columns headers and take into account for each parent code which one is the number of columns (multivalued use case)
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
    let primaryStudiesUrl = _.map(_.uniqBy(codingAnnotations, (anno) => { return anno['uri'] }), 'uri') // TODO Change uri param if necessary
    let users = _.map(_.uniqBy(codingAnnotations, (anno) => { return anno['user'] }), 'user')
    let codes = window.abwa.mappingStudyManager.classificationScheme.codes
    let parentCodesWithOnlyOneParent = _.filter(codes, (code) => {
      return code.parentCode !== null && code.parentCode.parentCode === null
    })
    let parentCodesWithoutChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length === 0
    })
    // Create primary studies
    let primaryStudies = []
    for (let i = 0; i < primaryStudiesUrl.length; i++) {
      let primaryStudyUrl = primaryStudiesUrl[i]
      let codingAnnotationsForPrimaryStudy = _.filter(codingAnnotations, (codingAnnotation) => {
        return codingAnnotation.uri === primaryStudyUrl
      })
      // Retrieve from any annotation the document title
      let title
      try {
        title = _.find(codingAnnotationsForPrimaryStudy, (annotation) => { return _.isArray(annotation.document.title) }).document.title[0]
      } catch (e) {
        title = 'Primary Study ' + i
      }
      let primaryStudy = new PrimaryStudy({metadata: {url: primaryStudyUrl, title: title}}) // TODO Retrieve title
      let parentCodes = {}
      for (let i = 0; i < codingAnnotationsForPrimaryStudy.length; i++) {
        let codingAnnotationForPrimaryStudy = codingAnnotationsForPrimaryStudy[i]
        let codeId = codingAnnotationForPrimaryStudy.body.replace('https://hypothes.is/api/annotations/', '')
        let code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => { return code.id === codeId })
        if (code) {
          let parentCode = code.getAncestorCode()
          let firstLevelCode = _.find(parentCode.codes, (firstLevelChild) => { return code.isChildOf(firstLevelChild) || code === firstLevelChild })
          if (_.has(parentCodes, parentCode.id)) {
            if (_.has(parentCodes[parentCode.id].chosenCodes, firstLevelCode.id)) {
              parentCodes[parentCode.id].chosenCodes[firstLevelCode.id].annotations.push(codingAnnotationForPrimaryStudy)
              // TODO Calculate status
            } else {
              // If chosen code is parent itself
              if (parentCode.id !== code.id && firstLevelCode) {
                // If chosen code is new
                parentCodes[parentCode.id].chosenCodes[firstLevelCode.id] = new Code({codeId: firstLevelCode.id, codeName: firstLevelCode.name, annotations: [codingAnnotationForPrimaryStudy]})
              } else if (parentCode.id === code.id) {
                parentCodes[parentCode.id].itself = [codingAnnotationForPrimaryStudy]
              }
            }
          } else {
            if (parentCode.id !== code.id && firstLevelCode) {
              let chosenCodes = {}
              chosenCodes[firstLevelCode.id] = new Code({codeId: firstLevelCode.id, codeName: firstLevelCode.name, annotations: [codingAnnotationForPrimaryStudy]})
              parentCodes[parentCode.id] = new Codes({parentCode, chosenCodes, multivalued: parentCode.multivalued}) // TODO Check if multivalued or not
            } else if (parentCode.id === code.id) {
              parentCodes[parentCode.id] = new Codes({parentCode, multivalued: parentCode.multivalued, itself: codingAnnotationForPrimaryStudy}) // TODO Check if multivalued or not
            }
          }
        }
      }
      primaryStudy.codes = parentCodes
      // TODO Check validated annotations

      primaryStudies.push(primaryStudy)
    }
    return {primaryStudies: primaryStudies, users: users}
  }
}

class PrimaryStudy {
  constructor ({metadata, codes}) {
    this.title = metadata.title
    this.url = metadata.url
    this.codes = codes
  }

  toSpreadsheetRow (codesColumnCalc, users) {
    let cells = []
    // Title column
    cells.push({
      userEnteredValue: {
        formulaValue: '=HYPERLINK("' + this.url + '", "' + this.title + '")'
      }
    })
    // Calculate the rest of the columns based on columnsCalc
    for (let i = 0; i < codesColumnCalc.length; i++) {
      let lengthOfCurrentColumn = codesColumnCalc[i].columns
      let code = codesColumnCalc[i].parentCode
      if (_.has(this.codes, code.id)) {
        // Filled cells
        let currentCodeCells = this.codes[code.id].toCells(users)
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
  constructor ({codeId, codeName, annotations, status}) {
    this.codeId = codeId
    this.codeName = codeName
    this.annotations = annotations
    this.status = status
    this.users = []
  }

  toCell () {

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
  constructor ({parentCode, chosenCodes = {}, itself, multivalued = false, validated}) {
    this.parentCode = parentCode
    this.chosenCodes = chosenCodes
    this.itself = itself
    this.multivalued = multivalued
    this.validated = validated
  }

  numberOfColumns () {
    if (this.multivalued) {
      return _.values(this.chosenCodes).length || 1
    } else {
      return 1
    }
  }

  toCells (allUsers) {
    let pairs = _.toPairs(this.chosenCodes)
    if (pairs.length > 0) {
      // Can be in conflict or coincing
      if (this.multivalued) {
        // TODO If multivalued
      } else {
        // No multivalued, codify status
        let chosenCodes = _.values(this.chosenCodes)
        if (chosenCodes.length > 1) {
          let annotation = chosenCodes[0].annotations[0] // Retrieve one annotation
          // Conflict
          return [{
            userEnteredValue: {
              formulaValue: '=HYPERLINK("' + annotation.uri + '#hag:' + annotation.id + '", "' + chosenCodes[0].codeName + '")'
            },
            userEnteredFormat: {
              backgroundColor: HyperSheetColors.red
            }
          }]
        } else {
          // Review all users
          let annotation = chosenCodes[0].annotations[0] // Retrieve one annotation
          let chosenCode = chosenCodes[0]
          let every = _.every(chosenCode.annotations, (annotation) => {
            let index = _.findIndex(allUsers, (user) => {
              return user === annotation.user
            })
            return index !== -1
          })
          if (every && allUsers.length > 1) {
            // All reviewers has annotated with that code and more than one reviewer has codified the PS
            return [{
              userEnteredValue: {
                formulaValue: '=HYPERLINK("' + annotation.uri + '#hag:' + annotation.id + '", "' + chosenCodes[0].codeName + '")'
              },
              userEnteredFormat: {
                backgroundColor: HyperSheetColors.yellow
              }
            }]
          } else {
            // Not all reviewers has annotated with that code or there is only one reviewer that has codified the PS
            return [{
              userEnteredValue: {
                formulaValue: '=HYPERLINK("' + annotation.uri + '#hag:' + annotation.id + '", "' + chosenCodes[0].codeName + '")'
              }
            }]
          }
        }
      }
    } else {
      if (this.itself) {
        // Quote of the annotation in itself
        // TODO Get quote of annotation
        let textQuoteSelector = _.find(this.itself.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
        let quote = 'Quote'
        if (textQuoteSelector && textQuoteSelector.exact) {
          quote = textQuoteSelector.exact
        }
        return [{userEnteredValue: {
          formulaValue: '=HYPERLINK("' + this.itself.uri + '#hag:' + this.itself.id + '", "' + quote + '")'
        }}]
      }
    }
    return []
  }
}

module.exports = SLRGoogleSheetManager
