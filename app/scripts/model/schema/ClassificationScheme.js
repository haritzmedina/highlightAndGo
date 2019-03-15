const AnnotationGuide = require('./AnnotationGuide')
const Code = require('./Code')
const jsYaml = require('js-yaml')
const _ = require('lodash')
const ColorUtils = require('../../utils/ColorUtils')
const Config = require('../../Config')

class ClassificationScheme extends AnnotationGuide {
  constructor ({name = '', hypothesisGroup, codes = []}) {
    super({name: name, hypothesisGroup: hypothesisGroup, guideElements: codes})
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

  static fromAnnotations (annotations) {
    // TODO Retrieve spreadsheet information
    let classificationScheme = new ClassificationScheme({name: '', hypothesisGroup: window.abwa.groupSelector.currentGroup})
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
      // Get body and target
      let linking = jsYaml.load(linkingAnnotation.text)
      let parentAnnotationUrl = linking.body
      let childrenAnnotationUrl = linking.target
      let parentId = parentAnnotationUrl.replace('https://hypothes.is/api/annotation/', '')
      let childrenId = childrenAnnotationUrl.replace('https://hypothes.is/api/annotation/', '')
      // Find parent code
      let parentCode = _.find(codes, (code) => {
        return code.id === parentId
      })
      // Find children code
      let childrenCode = _.find(codes, (code) => {
        return code.id === childrenId
      })
      // Relate children and parent
      parentCode.codes.push(childrenCode)
      childrenCode.setParentCode(parentCode)
    }
    classificationScheme.codes = codes
    // Parent codes
    let parentCodes = _.filter(codes, (code) => {
      return code.parentCode === null
    })
    // Set colors for each parent
    let colors = []
    if (_.isArray(parentCodes)) {
      colors = ColorUtils.getDifferentColors(parentCodes.length)
    }
    // Set colors for each parent and its children
    for (let i = 0; i < parentCodes.length; i++) {
      let parentCode = parentCodes[i]
      let color = colors.pop()
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
}

module.exports = ClassificationScheme
