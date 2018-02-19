const Events = require('../../contentScript/Events')
const Config = require('../../Config')
const CommonHypersheetManager = require('./CommonHypersheetManager')
const HyperSheetColors = require('./HyperSheetColors')
const swal = require('sweetalert2')
const _ = require('lodash')

class ValidateAnnotationManager {
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
    this.events.annotationValidated = {element: document, event: Events.annotationValidated, handler: this.createAnnotationValidatedEventHandler()}
    this.events.annotationValidated.element.addEventListener(this.events.annotationValidated.event, this.events.annotationValidated.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationValidatedEventHandler () {
    return (event) => {
      let annotation = event.detail.annotation
      console.debug('Validating annotation ' + annotation.id)
      let typeOfFacetData = this.typeOfFacet(annotation)
      if (_.isObject(typeOfFacetData)) {
        this.validateClassificationOnHypersheet(typeOfFacetData, (err, result) => {
          if (err) {
            // TODO Show user an error number
            console.error(err)
            swal({
              type: 'error',
              title: 'Oops...',
              text: 'Unable to update hypersheet. Ensure you have permission to update it and try it again.'
            })
          } else {
            // Nothing to do, everything went okay
            swal({ // TODO i18n
              position: 'top-end',
              type: 'success',
              title: 'Correctly validated',
              showConfirmButton: false,
              timer: 1500
            })
          }
        })
      }
    }
  }

  validateClassificationOnHypersheet (typeOfFacetData, callback) {
    if (typeOfFacetData.typeOfFacet === 'monovalued') {
      // TODO Detect conflict
      // Update cell with current annotation link and green background
      CommonHypersheetManager.updateMonovaluedFacetInGSheet(
        typeOfFacetData.facet.name,
        typeOfFacetData.code.name,
        typeOfFacetData.annotation,
        HyperSheetColors.green,
        (err, result) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (_.isFunction(callback)) {
              callback()
            }
          }
        })
    } else if (typeOfFacetData.typeOfFacet === 'inductive') {
      CommonHypersheetManager.updateInductiveFacetInGSheet(
        typeOfFacetData.facet.name,
        typeOfFacetData.annotation,
        HyperSheetColors.green,
        (err, result) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            if (_.isFunction(callback)) {
              callback()
            }
          }
        })
    } else if (typeOfFacetData.typeOfFacet === 'multivalued') {
      window.abwa.specific.primaryStudySheetManager.getGSheetData((err, sheetData) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          // TODO Detect conflict
          // Retrieve row
          let primaryStudyRow = window.abwa.specific.primaryStudySheetManager.primaryStudyRow
          let headersRow = sheetData.data[0].rowData[0].values
          let facetStartColumn = _.findIndex(headersRow, (cell) => { return cell.formattedValue === typeOfFacetData.facet.name })
          let facetLastColumn = _.findLastIndex(headersRow, (cell) => { return cell.formattedValue === typeOfFacetData.facet.name })
          // Find cell for selected code
          let row = sheetData.data[0].rowData[primaryStudyRow].values
          let facetCells = _.slice(row, facetStartColumn, facetLastColumn + 1)
          let facetCellsCodeIndex = _.findIndex(facetCells, (cell) => { return cell.formattedValue === typeOfFacetData.code.name })
          if (facetCellsCodeIndex === -1) {
            callback(new Error('Validated code on multivalued facet is not found.'))
          } else {
            // Retrieve link for primary study
            window.abwa.specific.primaryStudySheetManager.getPrimaryStudyLink((err, primaryStudyLink) => {
              if (err) {
                if (_.isFunction(callback)) {
                  callback(err)
                }
              } else {
                // Create link for annotation
                let link = CommonHypersheetManager.getAnnotationUrl(typeOfFacetData.annotation, primaryStudyLink)
                // Create request to update the cell
                let request = window.abwa.specific.primaryStudySheetManager.googleSheetClientManager.googleSheetClient.createRequestUpdateCell({
                  row: primaryStudyRow,
                  column: facetCellsCodeIndex + facetStartColumn,
                  value: typeOfFacetData.code.name,
                  link: link,
                  backgroundColor: HyperSheetColors.green,
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
            })
          }
        }
      })
    }
  }

  destroy (callback) {
    // Remove the event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }

  typeOfFacet (annotation) {
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
              return {
                annotation: annotation,
                typeOfFacet: 'multivalued',
                facet: facet,
                code: code
              }
            } else {
              return {
                annotation: annotation,
                typeOfFacet: 'monovalued',
                facet: facet,
                code: code
              }
            }
          } else {
            return null
          }
        } else {
          return null
        }
      } else {
        return null
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
          return {
            annotation: annotation,
            typeOfFacet: 'inductive',
            facet: facet
          }
        } else {
          return null
        }
      } else {
        return null
      }
    }
  }
}

module.exports = ValidateAnnotationManager
