const GoogleSheetClientManager = require('../../googleSheets/GoogleSheetsClientManager')
const Alerts = require('../../utils/Alerts')
const _ = require('lodash')

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
      let primaryStudies = this.getPrimaryStudiesFromAnnotations(annotationsResolve.annotations)
      let sheetId = 0
      // TODO Update spreadsheet with primary studies data
      let rows = []
      // TODO Calculate for each code which one is the number of columns (multivalued use case)
      // First row is for codebook facets
      rows.push(this.createHeaderSpreadsheetRow())
      // Retrieve rows for primary studies
      for (let i = 0; i < primaryStudies.length; i++) {
        rows.push(primaryStudies[i].toSpreadsheetRow())
      }
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

  createHeaderSpreadsheetRow (parentCodes, codesColumnCalc) {
    let cells = []
    // Title cell
    cells.push({
      userEnteredValue: {
        formulaValue: '=HYPERLINK("' + window.abwa.groupSelector.currentGroup.url + '", "Primary Study")'
      }
    })
    // TODO Fill columns headers and take into account for each parent code which one is the number of columns (multivalued use case)
    return {
      values: cells
    }
  }

  getPrimaryStudiesFromAnnotations (annotations) {
    let codingAnnotation = _.filter(annotations, (annotation) => {
      return annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying'
    })
    let validatingAnnotation = _.filter(annotations, (annotation) => {
      return annotation.motivation === 'assessing' || annotation.motivation === 'oa:assessing'
    })
    let primaryStudiesUrl = _.map(_.uniqBy(codingAnnotation, (anno) => { return anno['uri'] }), 'uri') // TODO Change uri param if necessary
    let users = _.map(_.uniqBy(codingAnnotation, (anno) => { return anno['user'] }), 'user')
    let codes = window.abwa.mappingStudyManager.classificationScheme.codes
    let parentCodesWithChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length > 0
    })
    let parentCodesWithoutChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length === 0
    })
    // Create primary studies
    let primaryStudies = []
    for (let i = 0; i < primaryStudiesUrl.length; i++) {
      let primaryStudyUrl = primaryStudiesUrl[i]
      let primaryStudy = new PrimaryStudy({metadata: {url: primaryStudyUrl, title: 'PS' + i}}) // TODO Retrieve title
      primaryStudies.push(primaryStudy)
    }
    return primaryStudies
  }
}

class PrimaryStudy {
  constructor ({metadata, codes}) {
    this.title = metadata.title
    this.url = metadata.url
    this.codes = codes
  }

  toSpreadsheetRow () {
    let cells = []
    // Title column
    cells.push({
      userEnteredValue: {
        formulaValue: '=HYPERLINK("' + this.url + '", "' + this.title + '")'
      }
    })
    // TODO Calculate the rest of the columns
    return {
      values: cells
    }
  }
}

class Codes {
  constructor ({validated = false, valueToDisplay = ''}) {

  }
}

module.exports = SLRGoogleSheetManager
