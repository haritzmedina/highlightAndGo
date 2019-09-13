const AnnotationGuide = require('./AnnotationGuide')
const Code = require('./Code')
const _ = require('lodash')
const ColorUtils = require('../../utils/ColorUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const Config = require('../../Config')

class ClassificationScheme extends AnnotationGuide {
  constructor ({name = '', storage, codes = []}) {
    super({name: name, storage: storage, guideElements: codes})
    this.codes = this.guideElements
  }

  toAnnotation () {
    super.toAnnotation()
  }

  toAnnotations () {
    super.toAnnotations()
  }

  static fromAnnotation (annotation) {
    AnnotationGuide.fromAnnotation(annotation)
  }

  static fromAnnotations (annotations, storage = window.abwa.storageManager.getStorageMetadata()) {
    // TODO Retrieve spreadsheet information
    let classificationScheme = new ClassificationScheme({name: '', storage: storage})
    // Get criterias
    let codebookAnnotations = _.filter(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => {
        return tag.includes('motivation:slr:codebookDevelopment')
      })
    })
    let linkingAnnotations = _.filter(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => {
        return tag.includes('motivation:linking')
      })
    })
    let codes = []
    // Create code objects
    for (let i = 0; i < codebookAnnotations.length; i++) {
      let codebookAnnotation = codebookAnnotations[i]
      // Get code from annotation
      let code = Code.fromAnnotation(codebookAnnotation, classificationScheme)
      codes.push(code)
    }
    // Create relationships between codes
    for (let i = 0; i < linkingAnnotations.length; i++) {
      let linkingAnnotation = linkingAnnotations[i]
      // Get body and target from body and target attributes of annotations
      let parentAnnotationUrl = linkingAnnotation.body
      let childrenAnnotationUrl = linkingAnnotation['oa:target']
      // Get body and target
      let parentId = parentAnnotationUrl.replace(classificationScheme.storage.annotationUrl, '')
      let childrenId = childrenAnnotationUrl.replace(classificationScheme.storage.annotationUrl, '')
      // Find parent code
      let parentCode = _.find(codes, (code) => {
        return code.id === parentId
      })
      // Find children code
      let childrenCode = _.find(codes, (code) => {
        return code.id === childrenId
      })
      if (parentCode && childrenCode) {
        // Relate children and parent
        parentCode.codes.push(childrenCode)
        childrenCode.setParentCode(parentCode)
        // Add link id to the children element
        childrenCode.parentLinkAnnotationId = linkingAnnotation.id
      }
    }
    classificationScheme.codes = codes
    // Parent codes
    let parentCodes = _.filter(codes, (code) => {
      return code.parentCode === null
    })
    // Set colors for each parent
    this.colors = []
    if (_.isArray(parentCodes)) {
      classificationScheme.colors = ColorUtils.getDifferentColors()
    }
    // Set colors for each parent and its children
    for (let i = 0; i < parentCodes.length; i++) {
      let parentCode = parentCodes[i]
      let color = classificationScheme.colors.shift()
      if (color) {
        parentCode.color = ColorUtils.setAlphaToColor(color, Config.slrDataExtraction.colors.minAlpha)
        // Retrieve child codes for parent
        let childCodes = parentCode.getAllChildCodes()
        // Set colors for each child element
        for (let j = 0; j < childCodes.length; j++) {
          let childCode = childCodes[j]
          let alphaForChild = (Config.slrDataExtraction.colors.maxAlpha - Config.slrDataExtraction.colors.minAlpha) / childCodes.length * (j + 1) + Config.slrDataExtraction.colors.minAlpha
          childCode.color = ColorUtils.setAlphaToColor(color, alphaForChild)
        }
      }
    }
    return classificationScheme
  }

  addNewCode (code) {
    // Add code to code list
    this.codes.push(code)
    // Update the color for the new code and codes in the same group
    if (code.parentCode === null) {
      let color = this.colors.shift()
      code.color = ColorUtils.setAlphaToColor(color, Config.slrDataExtraction.colors.minAlpha)
    } else if (LanguageUtils.isInstanceOf(code.parentCode, Code)) {
      // Add to its parent as a child code
      code.parentCode.codes.push(code)
      // Need to recompute the colors for all the codes inside the ancestor code
      // Get the ancestor code
      let ancestorCode = code.getAncestorCode()
      // Get ancestor code color
      let color = ancestorCode.color
      //  Get all child codes
      let childCodes = ancestorCode.getAllChildCodes()
      // Set colors for each child element
      for (let j = 0; j < childCodes.length; j++) {
        let childCode = childCodes[j]
        let alphaForChild = (Config.slrDataExtraction.colors.maxAlpha - Config.slrDataExtraction.colors.minAlpha) / childCodes.length * (j + 1) + Config.slrDataExtraction.colors.minAlpha
        childCode.color = ColorUtils.setAlphaToColor(color, alphaForChild)
      }
    }
  }
}

module.exports = ClassificationScheme
