class CodingManager {
  constructor () {
    this.primaryStudyCoding = []
  }

  init () {
    let codingAnnotations =  _.filter(window.abwa.contentAnnotator.allAnnotations, (annotation) => {
      return annotation.motivation === 'classifying' && annotation.user === window.abwa.groupSelector.user.userid // TODO Change annotation.user by annotation.creator
    })
  }
}

module.exports = CodingManager
