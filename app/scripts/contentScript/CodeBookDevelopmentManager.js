const axios = require('axios')
const _ = require('lodash')
const Buttons = require('./Buttons')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')
const Alerts = require('../utils/Alerts')
const Code = require('../model/schema/Code')
const $ = require('jquery')

class CodeBookDevelopmentManager {
  constructor () {
    this.codebookCreationContainer = null
  }

  init (callback) {
    console.debug('Initializing codebook development manager')
    // Get classification scheme
    this.classificationScheme = window.abwa.mappingStudyManager.classificationScheme
    this.insertCodebookDevelopmentContainer(() => {
      this.codebookCreationContainer = document.querySelector('#codebookCreationContainer')
      // Populate codebook creation container with classification scheme elements
      this.populateCodebookCreationSidebar()
      // Add event listener for new code button
      this.addEventListenerNewCodeButton()
      // Callback
      if (_.isFunction(callback)) {
        callback()
      }
      // Codebook development initialized
      console.debug('Initialized codebook development manager')
    })
  }

  insertCodebookDevelopmentContainer (callback) {
    let generatorWrapperURL = chrome.extension.getURL('pages/sidebar/codebookDevelopment.html')
    axios.get(generatorWrapperURL).then((response) => {
      document.querySelector('#codeBookContainer').insertAdjacentHTML('afterbegin', response.data)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  addEventListenerNewCodeButton () {
    this.newCodeButton = this.codebookCreationContainer.querySelector('#newCodeButton')
    this.newCodeButton.addEventListener('click', () => {
      // TODO create new code with the annotated content
      this.createNewCode()
    })
  }

  populateCodebookCreationSidebar () {
    let codes = this.classificationScheme.codes
    let parentCodesWithChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length > 0
    })
    let parentCodesWithoutChild = _.filter(codes, (code) => {
      return code.parentCode === null && code.codes.length === 0
    })
    // Create container for each parent code which has child elements
    for (let i = 0; i < parentCodesWithChild.length; i++) {
      let parentCode = parentCodesWithChild[i]
      let groupButton = Buttons.createGroupedButtons({
        id: parentCode.id,
        name: parentCode.name,
        color: parentCode.color,
        childGuideElements: parentCode.codes,
        groupHandler: this.createNewCode,
        buttonHandler: this.createNewCode
      })
      this.codebookCreationContainer.append(groupButton)
    }
    // Create buttons for each parent code which has not child elements
    for (let i = 0; i < parentCodesWithoutChild.length; i++) {
      let parentCode = parentCodesWithoutChild[i]
      let groupButton = Buttons.createButton({
        id: parentCode.id,
        name: parentCode.name,
        color: parentCode.color,
        buttonHandler: this.createNewCode
      })
      this.codebookCreationContainer.append(groupButton)
    }
  }

  createNewCode (event) {
    // TODO Get user selected content
    let selection = document.getSelection()
    // If selection is child of sidebar, return null
    if ($(selection.anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
      window.alert('The selected content cannot be a new code, is not part of the document') // TODO change by swal
      return
    }
    // Retrieve code name from highlighted
    let codeName = selection.toString()
    let range
    if (selection.toString()) {
      range = document.getSelection().getRangeAt(0)
    }
    // Create code
    let code = new Code({
      name: codeName,
      description: '',
      classificationScheme: window.abwa.mappingStudyManager.classificationScheme
    })
    let promise = new Promise((resolve) => {
      if (codeName.length === 0) {
        // If selection is empty, ask if it is sure to create a new code without evidences
        Alerts.confirmAlert({
          title: 'No evidence highlighted for the new code',
          text: 'You have not selected any evidence on the document to use as basis for the new code. Would you like to create the code anyway?',
          callback: () => {
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
    promise.then(() => {
      // Retrieve selectors for current annotation
      let selectors = []
      if (codeName.length > 0) {
        selectors = TextAnnotator.getSelectors(range)
      }
      // Create the new annotation in hypothes.is
      let codeAnnotationId
      let annotations
      let createAnnotationPromise = new Promise((resolve, reject) => {
        this.createNewCodeAnnotations({
          code,
          selectors: selectors,
          callback: (err, createdAnnotations) => {
            if (err) {
              reject(err)
            } else {
              // TODO Check which of the 2 annotations is the code annotation
              let annotation = createdAnnotations[0]
              codeAnnotationId = annotation.id
              annotations = createdAnnotations
              resolve(annotations)
            }
          }
        })
      })
      Alerts.multipleInputAlert({
        title: 'You are creating a new code',
        html: '<input id="newCodeName" type="text" placeholder="New code name" value="' + codeName + '"/>' +
          '<textarea id="newCodeDescription" placeholder="Please type a description that describes this code..."></textarea>',
        preConfirm: () => {
          // Check if code name is empty
          code.name = document.querySelector('#newCodeName').value
          code.description = document.querySelector('#newCodeDescription').value
        },
        callback: (err, result) => {
          if (err) {
            window.alert('Unable to load alert. Is this an annotable document?')
          } else {
            createAnnotationPromise.catch(() => {
              Alerts.errorAlert({title: 'Unable to create new code.', text: 'Unable to create the new code. Please check your connection to Hypothes.is.'})
            }).then((codeAnnotation) => {
              this.updateNewCodeAnnotation({
                code,
                currentAnnotationId: codeAnnotationId,
                callback: (err, annotation) => {
                  if (err) {

                  } else {
                    // Add annotation to textannotator
                    window.abwa.contentAnnotator.allAnnotations.push(annotation)
                    window.abwa.contentAnnotator.currentAnnotations.push(annotation)
                    window.abwa.contentAnnotator.redrawAnnotations()
                  }
                }
              })
            })
          }
        }
      })
    })
  }

  createNewCodeAnnotations ({code, selectors, callback}) {
    let newCodeAnnotations = code.toAnnotation()
    let annotations = []
    if (newCodeAnnotations.codeAnnotation) {
      // Set selectors to code annotation
      newCodeAnnotations.codeAnnotation.target.push({selector: selectors})
      // Append to annotations to save in hypothes.is
      annotations.push(newCodeAnnotations.codeAnnotation)
    }
    if (newCodeAnnotations.linkAnnotation) {
      annotations.push(newCodeAnnotations.linkAnnotation)
    }
    // Create annotations in hypothes.is
    window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotations(annotations, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null, annotations)
        }
      }
    })
  }

  updateNewCodeAnnotation ({code, currentAnnotationId, callback}) {
    let newCodeAnnotation = code.toAnnotation()
    window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(currentAnnotationId, newCodeAnnotation, (err, annotation) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (_.isFunction(callback)) {
          callback(null, annotation)
        }
      }
    })
  }

  destroy () {
    document.querySelector('#codeBookContainer').innerText = ''
    console.log('Codebook manager destroyed')
  }
}

module.exports = CodeBookDevelopmentManager
