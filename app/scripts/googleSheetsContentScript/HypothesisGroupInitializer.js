const _ = require('lodash')
const swal = require('sweetalert2')

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
        this.createHypothesisGroup((group) => {
          this.createDimensionsAndCategories(group, () => {
            this.createRelationGSheetGroup(group, () => {
              // When window.focus
              swal('Correctly configured', // TODO i18n
                chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + group.url + '">' + group.url + '</a>',
                'success')
              if (_.isFunction(callback)) {
                callback()
              }
            })
          })
        })
      } else {
        swal('Correctly configured', // TODO i18n
          chrome.i18n.getMessage('ShareHypothesisGroup') + '<br/><a href="' + group.url + '">' + group.url + '</a>',
          'success')
        // TODO Update Hypothesis group
      }
    })
  }

  createHypothesisGroup (callback) {
    window.hag.hypothesisClientManager.hypothesisClient.createHypothesisGroup(this.parsedSheetData.title, (err, group) => {
      if (err) {
        console.error(err) // TODO Show to the user the error
      } else {
        console.debug('Created group in hypothesis: ')
        console.debug(group)
        if (_.isFunction(callback)) {
          callback(group)
        }
      }
    })
  }

  createDimensionsAndCategories (group, callback) {
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
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  createRelationGSheetGroup (group, callback) {
    // Create relation to sheet annotation
    let relationAnnotation = this.generateRelateSheetAndGroupAnnotation(this.parsedSheetData.gSheetId, group)
    window.hag.hypothesisClientManager.hypothesisClient.createNewAnnotation(relationAnnotation, (err, response) => {
      if (err) {
        alert('Error while creating relation between hypothesis and google sheet. Please try it again.')
      }
      if (_.isFunction(callback)) {
        callback()
      }
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
