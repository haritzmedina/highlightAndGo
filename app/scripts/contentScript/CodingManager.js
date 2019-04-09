const Events = require('./Events')
const _ = require('lodash')

class CodingManager {
  constructor () {
    this.primaryStudyCoding = {} // Save coding for current primary study for all the users
    this.userPrimaryStudyCoding = {} // Save coding for current primary study for current user
    this.events = {}
  }

  init (callback) {
    // Update data model for first time
    this.updateDataModel()
    // Listeners to create, update or delete annotation events
    this.events.annotationCreated = {element: document, event: Events.annotationCreated, handler: () => { this.updateDataModel() }}
    this.events.annotationCreated.element.addEventListener(this.events.annotationCreated.event, this.events.annotationCreated.handler, false)
    this.events.annotationDeleted = {element: document, event: Events.annotationDeleted, handler: () => { this.updateDataModel() }}
    this.events.annotationDeleted.element.addEventListener(this.events.annotationDeleted.event, this.events.annotationDeleted.handler, false)
    this.events.comment = {element: document, event: Events.comment, handler: () => { this.updateDataModel() }}
    this.events.comment.element.addEventListener(this.events.comment.event, this.events.comment.handler, false)
    // Listener for annotation validated
    this.events.annotationValidated = {element: document, event: Events.annotationValidated, handler: () => { this.updateDataModel() }}
    this.events.annotationValidated.element.addEventListener(this.events.annotationValidated.event, this.events.annotationValidated.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  updateDataModel () {
    // Get which codes are used in coding for all users
    let codingAnnotationsAllUsers = _.filter(window.abwa.contentAnnotator.allAnnotations, (annotation) => {
      return annotation.motivation === 'classifying'
    })
    this.primaryStudyCoding = this.parseAnnotationToCodingModel(codingAnnotationsAllUsers)
    // Get which codes are used in coding for current user
    let codingAnnotationsCurrentUser = _.filter(window.abwa.contentAnnotator.allAnnotations, (annotation) => {
      return annotation.motivation === 'classifying' && annotation.user === window.abwa.groupSelector.user.userid // TODO Change annotation.user by annotation.creator
    })
    this.userPrimaryStudyCoding = this.parseAnnotationToCodingModel(codingAnnotationsCurrentUser)
    let validatingAnnotations = _.filter(window.abwa.contentAnnotator.allAnnotations, (annotation) => {
      return annotation.motivation === 'assessing'
    })
    validatingAnnotations.forEach((validatingAnnotation) => {
      let validatedAnnotationId = validatingAnnotation['oa:target'].replace('https://hypothes.is/api/annotations/', '')
      _.forEach(_.toPairs(this.primaryStudyCoding), (pair) => {
        let codeId = pair[0]
        let data = pair[1]
        let isValidated = _.find(data.annotations, (annotation) => {
          return annotation.id === validatedAnnotationId
        })
        if (isValidated) {
          this.primaryStudyCoding[codeId].validated = true
          if (_.isArray(this.primaryStudyCoding[codeId].validatingAnnotations)) {
            this.primaryStudyCoding[codeId].validatingAnnotations.push(validatingAnnotation)
          } else {
            this.primaryStudyCoding[codeId].validatingAnnotations = [validatingAnnotation]
          }
        }
      })
    })
    validatingAnnotations.forEach((validatingAnnotation) => {
      let validatedAnnotationId = validatingAnnotation['oa:target'].replace('https://hypothes.is/api/annotations/', '')
      _.forEach(_.toPairs(this.userPrimaryStudyCoding), (pair) => {
        let codeId = pair[0]
        let data = pair[1]
        let isValidated = _.find(data.annotations, (annotation) => {
          return annotation.id === validatedAnnotationId
        })
        if (isValidated) {
          this.primaryStudyCoding[codeId].validated = true
          if (_.isArray(this.userPrimaryStudyCoding[codeId].validatingAnnotations)) {
            this.primaryStudyCoding[codeId].validatingAnnotations.push(validatingAnnotation)
          } else {
            this.primaryStudyCoding[codeId].validatingAnnotations = [validatingAnnotation]
          }
        }
      })
    })
  }

  /**
   * Giving a list of classifying annotations it returns codes ids with evidencing annotations
   * @param codingAnnotations
   */
  parseAnnotationToCodingModel (codingAnnotations) {
    let coding = {}
    codingAnnotations.forEach((annotation) => {
      // Get code id
      let codeId = annotation.body.replace('https://hypothes.is/api/annotations/', '')
      // Check if code is in codebook
      if (codeId) {
        let codeIsInCodeBook = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => { return codeId === code.id })
        if (codeIsInCodeBook) {
          if (!_.isObject(coding[codeId])) {
            coding[codeId] = {}
          }
          if (_.isArray(coding[codeId].annotations)) {
            coding[codeId].annotations.push(annotation)
          } else {
            coding[codeId].annotations = [annotation]
          }
        }
      }
    })
    return coding
  }
}

module.exports = CodingManager
