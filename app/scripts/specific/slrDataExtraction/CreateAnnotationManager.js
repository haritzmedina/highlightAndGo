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

  addClassificationToHypersheetMultivalued (code, annotation, callback) {
    debugger
  }

  addClassificationToHypersheetInductive (facet, annotation, callback) {
    debugger
  }

  addClassificationToHypersheetMonovalued (code, currentAnnotation, callback) {
    this.getAllAnnotations((err, allAnnotations) => {
      if (err) {
        // Error while updating hypersheet, TODO notify user
      } else {
        console.log(code, currentAnnotation)
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
            // Set in red background
            this.updateMonovaluedFacetInGSheet(code.facet, code.name, facetAnnotations[0], HyperSheetColors.red, (err, result) => {
              if (err) {
                callback(err)
              } else {
                callback(null)
              }
            })
          } else {
            // Retrieve users who use the code in facet
            let uniqueUsers = _.uniq(_.map(facetAnnotations, (facetAnnotation) => { return facetAnnotation.user }))
            if (uniqueUsers.length > 1) { // More than one reviewer has classified using same facet and code
              // Set in yellow background
              this.updateMonovaluedFacetInGSheet(code.facet, code.name, facetAnnotations[0], HyperSheetColors.yellow, (err, result) => {
                if (err) {
                  callback(err)
                } else {
                  callback(null)
                }
              })
            } else {
              // Is the same user with the same code, nothing to update
            }
          }
        } else { // No other annotation is found with same facet
          this.updateMonovaluedFacetInGSheet(code.facet, code.name, currentAnnotation, HyperSheetColors.white, (err, result) => {
            if (err) {
              callback(err)
            } else {
              callback(null)
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
