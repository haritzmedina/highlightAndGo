const axios = require('axios')
const _ = require('lodash')
const Buttons = require('./Buttons')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')
const Alerts = require('../utils/Alerts')
const Code = require('../model/schema/Code')
const $ = require('jquery')
const ColorUtils = require('../utils/ColorUtils')
const Config = require('../Config')

class CodeBookDevelopmentManager {
  constructor () {
    this.codebookCreationContainer = null
    this.mode = CodeBookDevelopmentManager.modes.creating // The default mode is creating
    this.codebookCreationContainer = null
    this.codebookButtonsContainer = null
    this.codebookValidationContainer = null
  }

  init (callback) {
    console.debug('Initializing codebook development manager')
    // Get classification scheme
    this.classificationScheme = window.abwa.mappingStudyManager.classificationScheme
    this.insertCodebookDevelopmentContainer(() => {
      this.codebookCreationContainer = document.querySelector('#codebookCreationContainer')
      this.codebookButtonsContainer = document.querySelector('#codebookButtonsContainer')
      this.codebookValidationContainer = document.querySelector('#codebookValidationContainer')
      // Drop event for codebook buttons container
      this.codebookButtonsContainer.addEventListener('dragenter', (event) => {
        event.stopPropagation()
        this.codebookButtonsContainer.style.backgroundColor = 'rgba(150,150,150,0.5)'
      })
      this.codebookButtonsContainer.addEventListener('dragleave', (event) => {
        event.stopPropagation()
        this.codebookButtonsContainer.style.backgroundColor = ''
      })
      this.codebookButtonsContainer.addEventListener('dragover', (event) => {
        event.preventDefault()
      })
      this.codebookButtonsContainer.addEventListener('drop', (event) => {
        event.preventDefault()
        let draggedCodeId = event.dataTransfer.getData('codeId')
        let code = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
          return code.id === draggedCodeId
        })
        let results = this.changeParentCodeToCode(code)
        // TODO Update linked annotation in annotation list on: results.hypothesisUpdatePromise
        // Redraw annotations
        window.abwa.contentAnnotator.redrawAnnotations()
      })
      // Populate codebook creation container with classification scheme elements
      this.populateCodebookCreationSidebar()
      // TODO Populate validation container with classification scheme elements

      // Add event listener for new code button
      this.addEventListenerNewCodeButton()
      // Add event listener for codebook mode change
      this.addEventListenerModeToggle()
      // Callback
      if (_.isFunction(callback)) {
        callback()
      }
      // Codebook development initialized
      console.debug('Initialized codebook development manager')
    })
  }

  addEventListenerModeToggle () {
    this.modeToggleElement = document.querySelector('#codebookAnnotatorToggle')
    this.modeToggleElement.addEventListener('click', () => {
      this.switchMode()
    })
  }

  switchMode () {
    if (this.modeToggleElement.checked) {
      // Switch to mode creating
      this.mode = CodeBookDevelopmentManager.modes.creating
      // Change text for label
      document.querySelector('#codebookModeLabel').innerText = 'Creating'
      // Hide/unhide modes containers
      this.codebookCreationContainer.setAttribute('aria-hidden', 'false')
      this.codebookValidationContainer.setAttribute('aria-hidden', 'true')
    } else {
      // Switch to mode creating
      this.mode = CodeBookDevelopmentManager.modes.validating
      // Change text for label
      document.querySelector('#codebookModeLabel').innerText = 'Validating'
      // Hide/unhide modes containers
      this.codebookCreationContainer.setAttribute('aria-hidden', 'true')
      this.codebookValidationContainer.setAttribute('aria-hidden', 'false')
    }
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
    this.newCodeButton.addEventListener('click', this.createNewCodeEventHandler())
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
        description: parentCode.description || '',
        color: parentCode.color,
        childGuideElements: parentCode.codes,
        groupHandler: this.createNewCodeEventHandler(),
        buttonHandler: this.createNewCodeEventHandler(),
        groupRightClickHandler: this.createRightClickHandler(),
        buttonRightClickHandler: this.createRightClickHandler(),
        ondragstart: (event, codeId) => {
          event.dataTransfer.setData('codeId', codeId)
        },
        ondragover: () => {},
        ondrop: this.createOnDropHandler()
      })
      this.codebookButtonsContainer.append(groupButton)
    }
    // Create buttons for each parent code which has not child elements
    for (let i = 0; i < parentCodesWithoutChild.length; i++) {
      let parentCode = parentCodesWithoutChild[i]
      let groupButton = Buttons.createButton({
        id: parentCode.id,
        name: parentCode.name,
        description: parentCode.description || '',
        color: parentCode.color,
        handler: this.createNewCodeEventHandler(),
        buttonRightClickHandler: this.createRightClickHandler(),
        ondragstart: (event, codeId) => {
          event.dataTransfer.setData('codeId', codeId)
          console.log('Drag start ' + event.dataTransfer.getData('codeId'))
        },
        ondragover: () => {},
        ondrop: this.createOnDropHandler()
      })
      this.codebookButtonsContainer.append(groupButton)
    }
  }

  createOnDropHandler () {
    return (event, codeId) => {
      event.stopPropagation()
      // Retrieve dragged code
      let draggedCodeId = event.dataTransfer.getData('codeId')
      // Retrieve code from codeid
      let parentCode = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.id === codeId
      })
      let childCode = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.id === draggedCodeId
      })
      // Dragged code is child of parentCode
      this.changeParentCodeToCode(childCode, parentCode)
      // TODO Update linked annotation in annotation list on: results.hypothesisUpdatePromise
      // Redraw annotations
      window.abwa.contentAnnotator.redrawAnnotations()
    }
  }

  createRightClickHandler () {
    return (codeId) => {
      let items = {}
      items['modifyCodebookCode'] = {name: 'Modify code properties'}
      items['deleteCodebookCode'] = {name: 'Remove this code from codebook'}
      return {
        callback: (key) => {
          if (key === 'deleteCodebookCode') {
            // Get the code for this annotation
            let codeToDelete = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
              return code.id === codeId
            })
            // Remove code from classification scheme
            let removeCodeResult = this.removeCodeFromCodebook(codeToDelete)
            // Remove annotation from all and current annotations
            window.abwa.contentAnnotator.removeAnnotationsFromModel(removeCodeResult.annotationIdsToRemove)
            // Redraw annotations
            window.abwa.contentAnnotator.redrawAnnotations()
          } else if (key === 'modifyCodebookCode') {
            let codeToModify = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
              return code.id === codeId
            })
            Alerts.multipleInputAlert({
              title: 'You are modifying the code ' + codeToModify.name,
              html: '<input id="codeName" type="text" placeholder="New code name" value="' + codeToModify.name + '"/>' +
                '<textarea id="codeDescription" placeholder="Please type a description that describes this code...">' + codeToModify.description + '</textarea>',
              preConfirm: () => {
                // Check if code name is empty
                codeToModify.name = document.querySelector('#codeName').value
                codeToModify.description = document.querySelector('#codeDescription').value
              },
              callback: (err, result) => {
                if (err) {
                  window.alert('Unable to load alert. Is this an annotable document?')
                } else {
                  if (result === Alerts.results.cancel) {

                  } else {
                    // TODO Update annotation in hypothes.is
                    let codeAnnotations = codeToModify.toAnnotation()
                    let codeAnnotation = codeAnnotations.codeAnnotation
                    window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(codeToModify.id, codeAnnotation, (err) => {
                      if (err) {
                        Alerts.errorAlert({text: 'An unexpected error occurred in hypothes.is, please try again', title: 'Unable to update'})
                      } else {
                        this.updateSidebarButtons()
                      }
                    })
                  }
                }
              }
            })
          }
        },
        items: items
      }
    }
  }

  /**
   * Creates a new code in the classification schema, with a parent or without a parent code. Steps:
   * 1. Retrieves the selected text
   * 2. Retrieves if the new code is a subcode of a previously defined code
   * 3. Ask if nothing is selected (no-evidence based codebook annotation)
   * 4. Creates a temporal annotation for the code to give an ID to the code
   * 5. Ask for a name and description for the new code
   * 6. Saves the changes in hypothes.is
   * 7. Updates the sidebar
   * 8. Highlights the codebook code evidence in the document
   * @return {Function}
   */
  createNewCodeEventHandler () {
    return (event) => {
      // Get user selected content
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
      // Get if it is created with a parent code or not
      let parentCodeId
      if (event.target.classList.contains('groupName')) {
        parentCodeId = event.target.parentElement.dataset.codeId
      } else if (event.target.classList.contains('tagButton')) {
        parentCodeId = event.target.dataset.codeId
      }
      // Locate parent code
      let parentCode = _.find(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
        return code.id === parentCodeId
      })
      // Create code
      let code = new Code({
        name: codeName,
        description: '',
        classificationScheme: window.abwa.mappingStudyManager.classificationScheme,
        parentCode: parentCode
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
        let codeAnnotation
        let linkAnnotation
        let createAnnotationPromise = new Promise((resolve, reject) => {
          this.createNewCodeAnnotations({
            code,
            selectors: selectors,
            callback: (err, createdAnnotations) => {
              if (err) {
                reject(err)
              } else {
                codeAnnotation = createdAnnotations.codeAnnotation
                if (createdAnnotations.linkAnnotation) {
                  linkAnnotation = createdAnnotations.linkAnnotation
                }
                resolve(createdAnnotations)
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
              if (result === Alerts.results.cancel) {
                // If canceled, remove annotations
                let annotationsToDelete = []
                if (_.isObject(codeAnnotation)) {
                  annotationsToDelete.push(codeAnnotation)
                }
                if (_.isObject(linkAnnotation)) {
                  annotationsToDelete.push(linkAnnotation)
                }
                window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotations(annotationsToDelete)
              } else {
                // Complete the created annotation and update codebook
                createAnnotationPromise.catch(() => {
                  Alerts.errorAlert({title: 'Unable to create new code.', text: 'Unable to create the new code. Please check your connection to Hypothes.is.'})
                }).then((codeAnnotations) => {
                  // Set id to code annotation
                  code.id = codeAnnotation.id
                  // Set annotation for code
                  code.annotation = codeAnnotations.codeAnnotation
                  // Set parentlink annotation
                  if (codeAnnotations.linkAnnotation) {
                    code.parentLinkAnnotationId = codeAnnotations.linkAnnotation.id
                  }
                  // Add the new code to the codebook
                  this.addNewCodeToCodebook(code)
                  // Update sidebar buttons
                  this.updateSidebarButtons()
                  // Update the annotations with the final data in hypothes.is
                  let linkAnnotationId = linkAnnotation ? linkAnnotation.id : null
                  this.updateNewCodeAnnotation({
                    code,
                    currentAnnotationId: codeAnnotation.id,
                    currentLinkAnnotationId: linkAnnotationId,
                    callback: (err, codeAnnotations) => {
                      if (err) {
                        Alerts.errorAlert({title: 'Unable to create new code.', text: 'Unable to create the new code. Please check your connection to Hypothes.is.'})
                      } else {
                        // Add code annotation to textannotator
                        window.abwa.contentAnnotator.allAnnotations.push(codeAnnotations.codeAnnotation)
                        window.abwa.contentAnnotator.currentAnnotations.push(codeAnnotations.codeAnnotation)
                        window.abwa.contentAnnotator.redrawAnnotations()
                      }
                    }
                  })
                })
              }
            }
          }
        })
      })
    }
  }

  updateSidebarButtons () {
    this.codebookButtonsContainer.innerText = ''
    this.populateCodebookCreationSidebar()
  }

  addNewCodeToCodebook (code) {
    // Get a new color for the new code
    window.abwa.mappingStudyManager.classificationScheme.addNewCode(code)
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
          let codeAnnotation = _.find(annotations, (annotation) => {
            return annotation.motivation === 'slr:codebookDevelopment'
          })
          let linkAnnotation = _.find(annotations, (annotation) => {
            return annotation.motivation === 'linking'
          })
          callback(null, {codeAnnotation: codeAnnotation, linkAnnotation: linkAnnotation})
        }
      }
    })
  }

  updateNewCodeAnnotation ({code, currentAnnotationId, currentLinkAnnotationId, callback}) {
    let newCodeAnnotation = code.toAnnotation()
    let linkAnnotation = newCodeAnnotation.linkAnnotation
    let codeAnnotation = newCodeAnnotation.codeAnnotation
    let promises = []
    // Update code annotation
    promises.push(new Promise((resolve, reject) => {
      window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(currentAnnotationId, codeAnnotation, (err, annotation) => {
        if (err) {
          if (_.isFunction(callback)) {
            reject(err)
          }
        } else {
          if (_.isFunction(callback)) {
            codeAnnotation = annotation
            resolve(null, annotation)
          }
        }
      })
    }))
    // Update link annotation
    promises.push(new Promise((resolve, reject) => {
      if (currentLinkAnnotationId) {
        window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(currentLinkAnnotationId, linkAnnotation, (err, annotation) => {
          if (err) {
            if (_.isFunction(callback)) {
              reject(err)
            }
          } else {
            if (_.isFunction(callback)) {
              linkAnnotation = annotation
              resolve(null, annotation)
            }
          }
        })
      } else {
        resolve()
      }
    }))
    Promise.all(promises).catch((err) => {
      if (_.isFunction(callback)) {
        callback(err)
      }
    }).then((annotations) => {
      if (_.isFunction(callback)) {
        callback(null, {codeAnnotation: codeAnnotation, linkAnnotation: linkAnnotation})
      }
    })
  }

  /**
   * Given a code, it removes all the code its annotations and relations
   * @param code
   * @param recursive
   * @return an object including: annotation ids to be removed, a promise with the deletion in hypothes.is of the annotations for codebook and the new classification scheme
   */
  removeCodeFromCodebook (code, recursive = false) {
    // Get all children codes
    let allChildrenCodes = code.getAllChildCodes()
    // Get codes to remove
    let allCodesToRemove = [code]
    // If recursive, code's children is also deleted
    if (recursive) {
      allCodesToRemove = allCodesToRemove.concat(allChildrenCodes)
    }
    // Retrieve all codes ids to remove from hypothes.is
    let annotationIdsToRemove = []
    for (let i = 0; i < allCodesToRemove.length; i++) {
      let codeToRemove = allCodesToRemove[0]
      // Code annotation Id
      annotationIdsToRemove.push(codeToRemove.id)
      // Link annotation with its parent
      if (code.parentLinkAnnotationId) {
        annotationIdsToRemove.push(codeToRemove.parentLinkAnnotationId)
      }
      // Link annotations with its child
      for (let j = 0; j < code.codes.length; j++) {
        let childCode = code.codes[j]
        annotationIdsToRemove.push(childCode.parentLinkAnnotationId)
      }
    }
    // Remove all annotations from hypothes.is
    let deleteAnnotationsPromise = new Promise((resolve, reject) => {
      window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotations(annotationIdsToRemove, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    // Remove relation of its child codes with the code to be removed if it is not recursive
    if (!recursive) {
      code.codes.forEach((childCode) => {
        childCode.parentCode = null
        childCode.parentElement = window.abwa.mappingStudyManager.classificationScheme
        childCode.parentLinkAnnotationId = null
        childCode.color = ColorUtils.setAlphaToColor(window.abwa.mappingStudyManager.classificationScheme.colors.shift(), Config.slrDataExtraction.colors.minAlpha)
        // Update color for all its child nodes
        let childCodesOfChild = childCode.getAllChildCodes()
        // Set colors for each child element
        for (let j = 0; j < childCodesOfChild.length; j++) {
          let childCodeOfChild = childCodesOfChild[j]
          let alphaForChild = (Config.slrDataExtraction.colors.maxAlpha - Config.slrDataExtraction.colors.minAlpha) / childCodesOfChild.length * (j + 1) + Config.slrDataExtraction.colors.minAlpha
          childCodeOfChild.color = ColorUtils.setAlphaToColor(childCode.color, alphaForChild)
        }
      })
    }
    // Remove code from its parent
    if (code.parentCode) {
      _.remove(code.parentCode.codes, code)
    }
    // Remove all codes from classification scheme
    _.remove(window.abwa.mappingStudyManager.classificationScheme.codes, (code) => {
      return _.find(allCodesToRemove, (toRemoveCode) => {
        return toRemoveCode.id === code.id
      })
    })

    // Update sidebar buttons
    this.updateSidebarButtons()

    // Return the values
    return {
      annotationIdsToRemove: annotationIdsToRemove,
      deleteAnnotationsPromise: deleteAnnotationsPromise,
      classificationScheme: window.abwa.mappingStudyManager.classificationScheme
    }
  }

  /**
   * Changes code's parent to a new parent
   * @param code
   * @param newParentCode
   */
  changeParentCodeToCode (code, newParentCode = null) {
    // Retrieve old ancestor and new ancestor, it will be useful to know if the code needs to change its color or not
    let ancestorCode = code.getAncestorCode()
    let newAncestorCode
    if (newParentCode) {
      newAncestorCode = newParentCode.getAncestorCode()
    }
    // Retrieve link annotation id
    let linkAnnotationId = code.parentLinkAnnotationId
    let hypothesisUpdatePromise
    // Remove code from old parent
    if (code.parentCode) {
      _.remove(code.parentCode.codes, code)
    }
    // Set new parent
    code.parentCode = newParentCode
    // Add code to new parent's codes
    if (code.parentCode) {
      code.parentCode.codes.push(code)
    }
    // Change color of code and its child if necessary
    if (ancestorCode !== newAncestorCode) {
      // If new ancestor already exists
      if (newAncestorCode !== undefined) {
        // Update color for all its child nodes
        let childCodesOfChild = newAncestorCode.getAllChildCodes()
        // Set colors for each child element
        for (let j = 0; j < childCodesOfChild.length; j++) {
          let childCodeOfChild = childCodesOfChild[j]
          let alphaForChild = (Config.slrDataExtraction.colors.maxAlpha - Config.slrDataExtraction.colors.minAlpha) / childCodesOfChild.length * (j + 1) + Config.slrDataExtraction.colors.minAlpha
          childCodeOfChild.color = ColorUtils.setAlphaToColor(newAncestorCode.color, alphaForChild)
        }
      } else { // If there is not a new ancestor, a new color must be designed for the element
        code.color = ColorUtils.setAlphaToColor(window.abwa.mappingStudyManager.classificationScheme.colors.shift(), Config.slrDataExtraction.colors.minAlpha)
      }
    }
    if (newParentCode === null) {
      code.parentElement = window.abwa.mappingStudyManager.classificationScheme
      code.parentLinkAnnotationId = null
      // Remove parent link annotation
      hypothesisUpdatePromise = new Promise((resolve, reject) => {
        window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(linkAnnotationId, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    } else {
      // Update annotation if parent has change
      if (linkAnnotationId) {
        hypothesisUpdatePromise = new Promise((resolve, reject) => {
          // Get new link annotation corpus
          let codeAnnotations = code.toAnnotation()
          if (codeAnnotations.linkAnnotation) {
            // Update annotation in hypothes.is
            window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(linkAnnotationId, codeAnnotations.linkAnnotation, (err) => {
              if (err) {
                reject(err)
              } else {
                resolve()
              }
            })
          }
        })
      } else { // Create new link annotation if parent does not exist
        hypothesisUpdatePromise = new Promise((resolve, reject) => {
          // Get new link annotation corpus
          let codeAnnotations = code.toAnnotation()
          if (codeAnnotations.linkAnnotation) {
            // Update annotation in hypothes.is
            window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(codeAnnotations.linkAnnotation, (err, annotation) => {
              if (err) {
                reject(err)
              } else {
                resolve()
                // Update code parentLinkAnnotationId
                code.parentLinkAnnotationId = annotation.id
              }
            })
          }
        })
      }
    }
    // Update link annotation in hypothes.is
    this.updateSidebarButtons()
    // Update
    return {code: code, classificationScheme: window.abwa.mappingStudyManager.classificationScheme, hypothesisUpdatePromise}
  }

  destroy () {
    document.querySelector('#codeBookContainer').innerText = ''
    console.log('Codebook manager destroyed')
  }
}

CodeBookDevelopmentManager.modes = {
  creating: 'creating',
  validating: 'validating'
}

module.exports = CodeBookDevelopmentManager
