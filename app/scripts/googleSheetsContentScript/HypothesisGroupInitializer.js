const _ = require('lodash')

class HypothesisGroupInitializer {
  init (parsedSheetData, callback) {
    this.parsedSheetData = parsedSheetData
    this.initializeHypothesisGroup(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initializeHypothesisGroup (callback) {
    // TODO Get if current hypothesis group exists
    window.hag.hypothesisClientManager.hypothesisClient.getUserProfile((userProfile) => {
      let group = _.find(userProfile.groups, (group) => {
        return group.name === this.parsedSheetData.title.substr(0, 25)
      })
      // Create the group if not exists
      if (_.isEmpty(group)) {
        this.createHypothesisGroup(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      } else {
        // TODO Update Hypothesis group
      }
    })
  }

  createHypothesisGroup () {
    window.hag.hypothesisClientManager.hypothesisClient.createHypothesisGroup(this.parsedSheetData.title, (err, group) => {
      if (err) {
        console.error(err) // TODO Show to the user the error
      }
      console.debug('Created group in hypothesis: ')
      console.debug(group)
      // Create dimensions and categories annotations
      let dimensionsAndCategoriesPairs = _.toPairs(this.parsedSheetData.dimensions)
      let annotations = []
      for (let i = 0; i < dimensionsAndCategoriesPairs.length; i++) {
        let pair = dimensionsAndCategoriesPairs[i]
        // Create dimension annotation
        let dimensionName = pair[0]
        annotations.push(this.generateAnnotationCorpus(group, ['slr:dimension:' + dimensionName]))
        // Create categories annotation
        let categories = pair[1]
        for (let j = 0; j < categories.length; j++) {
          let categoryName = categories[j]
          annotations.push(this.generateAnnotationCorpus(
            group,
            ['slr:category:' + categoryName, 'slr:isCategoryOf:' + dimensionName]))
        }
      }
      console.debug('Generated dimensions and categories annotations: ')
      console.debug(annotations)
      window.hag.hypothesisClientManager.hypothesisClient.createNewAnnotations(annotations, (err, result) => {
        if (err) {
          console.error(err) // TODO Show to the user the error
        } else {
          // TODO Create relation to sheet annotation
          let relationAnnotation = this.generateRelateSheetAndGroupAnnotation(this.parsedSheetData.gSheetId, group)
          window.hag.hypothesisClientManager.hypothesisClient.createNewAnnotation(relationAnnotation, (response) => {
            prompt(chrome.i18n.getMessage('ShareHypothesisGroup'), group.url)
          })
        }
      })
    })
  }

  generateAnnotationCorpus (group, tags) {
    return {
      group: group.id,
      permissions: {
        read: ['group:' + group.id]
      },
      references: [],
      tags: tags,
      target: [],
      text: '',
      uri: group.url // Group url
    }
  }

  generateRelateSheetAndGroupAnnotation (idGSheet, group) {
    return {
      group: group.id,
      permissions: {
        read: ['group:' + group.id]
      },
      references: [],
      tags: ['slr:spreadsheet'],
      target: [],
      text: 'id: ' + idGSheet,
      uri: group.url // Group url
    }
  }

  updateHypothesisGroup () {

  }

  disableExtensionButton () {

  }
}

module.exports = HypothesisGroupInitializer
