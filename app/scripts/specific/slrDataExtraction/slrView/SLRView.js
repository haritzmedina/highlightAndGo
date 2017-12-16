const HypothesisClientManager = require('../../../hypothesis/HypothesisClientManager')
const ChromeStorage = require('../../../utils/ChromeStorage')
const _ = require('lodash')
const $ = require('jquery')
const SLRDataExtractionAllowedTags = require('../SLRDataExtractionAllowedTags')
const CategoryEvidence = require('../CategoryEvidence')
const PrimaryStudy = require('../PrimaryStudy')

const selectedGroupNamespace = 'hypothesis.currentGroup'
const defaultGroup = {id: '__world__', name: 'Public', public: true}

class SLRView {
  constructor () {
    this.hypothesisClientManager = null
    this.user = {}
    this.currentGroup = null
  }

  init () {
    this.hypothesisClientManager = new HypothesisClientManager()
    this.hypothesisClientManager.init(() => {
      this.defineCurrentGroup(() => {
        // Set in title name of the group
        let heading = document.querySelector('#heading')
        heading.innerText += ' ' + this.currentGroup.name
        this.loadTable()
      })
    })
  }

  /**
   * If not current group set, load from chrome storage last session
   * @param callback
   */
  defineCurrentGroup (callback) {
    if (!this.currentGroup) {
      ChromeStorage.getData(selectedGroupNamespace, ChromeStorage.local, (err, savedCurrentGroup) => {
        if (err) {
          throw new Error('Unable to retrieve current selected group')
        } else {
          // Parse chrome storage result
          if (!_.isEmpty(savedCurrentGroup) && savedCurrentGroup.data) {
            this.currentGroup = JSON.parse(savedCurrentGroup.data)
          } else {
            this.currentGroup = defaultGroup
          }
        }
        if (_.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  retrieveHypothesisGroups (callback) {
    this.hypothesisClientManager.hypothesisClient.getUserProfile((profile) => {
      this.user.groups = profile.groups
      if (_.isFunction(callback)) {
        callback(profile.groups)
      }
    })
  }

  loadTable () {
    // Remove current table
    let tableContainer = document.querySelector('#slrViewTableContainer')
    tableContainer.innerHTML = ''
    // Add the new table template
    let slrViewTableTemplate = document.querySelector('#slrViewTableTemplate')
    let slrViewTable = $(slrViewTableTemplate.content.firstElementChild).clone().get(0)
    // Retrieve current dimensions
    this.retrieveDimensions((dimensions) => {
      this.dimensions = _.sortBy(dimensions)
      let tableHeaderRow = slrViewTable.querySelector('thead tr')
      for (let i = 0; i < this.dimensions.length; i++) {
        // Create th element
        let headerCell = document.createElement('th')
        headerCell.dataset.column = this.dimensions[i]
        headerCell.innerText = this.dimensions[i]
        tableHeaderRow.appendChild(headerCell)
      }
      // For each primary study add a row with the current classification
      this.retrieveAnnotationsOfClassifiedPrimaryStudies((classificationAnnotations) => {
        console.debug('Classification annotations')
        console.debug(classificationAnnotations)
        // Map the retrieved annotations in Primary Studies
        let classifiedPrimaryStudies = this.mapClassificationAnnotations(classificationAnnotations)
        console.debug('Classification')
        console.debug(classifiedPrimaryStudies)
        this.fillTableWithClassifiedPrimaryStudies(classifiedPrimaryStudies, slrViewTable)
      })
      // Append table to container
      tableContainer.appendChild(slrViewTable)
    })
  }

  retrieveDimensions (callback) {
    let groupUrl = this.currentGroup.url
    this.hypothesisClientManager.hypothesisClient.searchAnnotations({url: groupUrl}, (annotations) => {
      let slrDimensionAnnotations = _.filter(annotations, (annotation) => {
        let dimensionTags = _.filter(annotation.tags, (tag) => {
          return _.startsWith(tag, 'slr:dimension')
        })
        return dimensionTags.length > 0
      })
      let slrDimensions = slrDimensionAnnotations.map((slrDimensionAnnotation) => {
        let dimensionTag = _.find(slrDimensionAnnotation.tags, (tag) => {
          return _.startsWith(tag, 'slr:dimension')
        })
        return _.replace(dimensionTag, 'slr:dimension:', '')
      })
      console.debug('Found %s dimensions', slrDimensions.length)
      console.debug(slrDimensions)
      if (_.isFunction(callback)) {
        callback(slrDimensions)
      }
    })
  }

  retrieveAnnotationsOfClassifiedPrimaryStudies (callback) {
    this.hypothesisClientManager.hypothesisClient.searchAnnotations({group: this.currentGroup.id}, (annotations) => {
      // Filter annotations from hypothesis group url
      let classificationAnnotations = _.filter(annotations, (annotation) => {
        // Filter by allowed tags
        let allowedTag = _.filter(annotation.tags, (tag) => {
          return _.findIndex(SLRDataExtractionAllowedTags, (allowedTag) => {
            return _.startsWith(tag, 'slr:' + allowedTag)
          }) !== -1
        })
        return annotation.uri !== this.currentGroup.url && allowedTag.length > 0
      })
      if (_.isFunction(callback)) {
        callback(classificationAnnotations)
      }
    })
  }

  mapClassificationAnnotations (classificationAnnotations) {
    let primaryStudies = {}
    // Split all the annotations in categorization annotations and non-categorization annotations
    let partitionedAnnotations = _.partition(classificationAnnotations, (classificationAnnotation) => {
      return _.findIndex(classificationAnnotation.tags, (tag) => {
        return _.startsWith(tag, 'slr:category')
      }) === -1
    })
    let publicationDetailAnnotations = partitionedAnnotations[0]
    let categoryAnnotations = partitionedAnnotations[1]
    // Retrieve primary studies publication details
    for (let i = 0; i < publicationDetailAnnotations.length; i++) {
      let publicationDetailAnnotation = publicationDetailAnnotations[i]
      // It is differentiated because doi is targeted and the rest of the details are in the body of the annotation
      // TODO It doesn't matter where the data came from (body or target)
      if (this.hasATag(publicationDetailAnnotation, 'doi')) {
        let textQuoteSelector = _.find(publicationDetailAnnotation.target[0].selector, {type: 'TextQuoteSelector'})
        primaryStudies[publicationDetailAnnotation.uri] = primaryStudies[publicationDetailAnnotation.uri] || {}
        primaryStudies[publicationDetailAnnotation.uri]['doi'] = textQuoteSelector.exact
      } else {
        let detailTag = _.find(publicationDetailAnnotation.tags, (tag) => { return _.startsWith(tag, 'slr:') })
        let detail = _.replace(detailTag, 'slr:', '')
        primaryStudies[publicationDetailAnnotation.uri] = primaryStudies[publicationDetailAnnotation.uri] || {}
        primaryStudies[publicationDetailAnnotation.uri][detail] = publicationDetailAnnotation.text
      }
    }
    for (let key in primaryStudies) {
      let publicationDetails = primaryStudies[key]
      publicationDetails['uri'] = key
      primaryStudies[key] = new PrimaryStudy(publicationDetails)
    }
    // Retrieve primary studies classification details
    for (let i = 0; i < categoryAnnotations.length; i++) {
      let categoryAnnotation = categoryAnnotations[i]
      let uri = categoryAnnotation.uri
      let primaryStudiesArray = _.values(primaryStudies)
      let primaryStudy = _.find(primaryStudiesArray, (primaryStudy) => {
        let primaryStudyUriNoProtocol = primaryStudy.uri.replace(/^https?:\/\//i, '')
        let categoryUriNoProtocol = uri.replace(/^https?:\/\//i, '')
        return _.startsWith(categoryUriNoProtocol, primaryStudyUriNoProtocol)
      })
      // If classification doesn't have a primary study instance (doi, title or whatever), the classification is ommited
      if (!_.isEmpty(primaryStudy)) {
        // Retrieve category of
        let isCategoryOfTag = _.find(categoryAnnotation.tags, (tag) => {
          return tag.includes('slr:isCategoryOf:')
        })
        let categoryNameTag = _.find(categoryAnnotation.tags, (tag) => {
          return tag.includes('slr:category:')
        })
        let categoryEvidence = new CategoryEvidence(categoryAnnotation)
        categoryEvidence.category = _.replace(categoryNameTag, 'slr:category:', '')
        categoryEvidence.dimension = _.replace(isCategoryOfTag, 'slr:isCategoryOf:', '')
        primaryStudies[primaryStudy.uri].addCategoryEvidence(categoryEvidence)
      }
    }
    return primaryStudies
  }

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return annotationTag.includes(tag)
    }) !== -1
  }

  fillTableWithClassifiedPrimaryStudies (classifiedPrimaryStudies, viewTable) {
    let classifiedPrimaryStudiesArray = _.values(classifiedPrimaryStudies)
    for (let i = 0; i < classifiedPrimaryStudiesArray.length; i++) {
      let primaryStudyRow = this.createRowForPrimaryStudy(classifiedPrimaryStudiesArray[i])
      let tableBody = viewTable.querySelector('tbody')
      tableBody.appendChild(primaryStudyRow)
    }
  }

  createRowForPrimaryStudy (primaryStudy) {
    let slrViewTableRowTemplate = document.querySelector('#slrViewTableRowTemplate')
    let slrViewTableRow = $(slrViewTableRowTemplate.content.firstElementChild).clone().get(0)
    // TODO Generic for all publication details inserted
    // DOI
    let doiCell = slrViewTableRow.querySelector('th[data-column="doi"]')
    let linkToDoi = document.createElement('a')
    linkToDoi.href = 'http://dx.doi.org/' + primaryStudy.doi
    linkToDoi.target = '_blank'
    linkToDoi.innerText = primaryStudy.doi
    doiCell.appendChild(linkToDoi)
    // Title
    let titleCell = slrViewTableRow.querySelector('td[data-column="title"]')
    titleCell.innerText = primaryStudy.title
    // Author
    let authorCell = slrViewTableRow.querySelector('td[data-column="author"]')
    authorCell.innerText = primaryStudy.author
    // Add new columns for each dimension
    slrViewTableRow = this.appendCellsForDimensions(slrViewTableRow)
    // Fill cells for each dimension
    this.fillCellsForEachDimension(slrViewTableRow, primaryStudy.classification)
    return slrViewTableRow
  }

  appendCellsForDimensions (row) {
    for (let i = 0; i < this.dimensions.length; i++) {
      let cell = document.createElement('td')
      cell.dataset.column = this.dimensions[i]
      row.appendChild(cell)
    }
    return row
  }

  fillCellsForEachDimension (slrViewTableRow, classification) {
    let classificationDimensions = _.values(classification)
    for (let i = 0; i < classificationDimensions.length; i++) {
      let classificationDimension = classificationDimensions[i]
      let dimension = classificationDimension[0].dimension
      let cell = slrViewTableRow.querySelector('td[data-column="' + dimension + '"]')
      let categoryEvidences = _.values(_.groupBy(classificationDimension, 'category'))
      for (let j = 0; j < categoryEvidences.length; j++) {
        let categoryWrapper = document.createElement('div')
        let category = categoryEvidences[j][0].category
        // For first evidence, add a name
        cell.appendChild(this.getLinkForEvidence(categoryEvidences[j][0], category))
        if (categoryEvidences[j].length > 1) {
          cell.appendChild(document.createTextNode('[')) // Open brackets
          // For each other evidence add a number
          for (let k = 1; k < categoryEvidences[j].length; k++) {
            cell.appendChild(this.getLinkForEvidence(categoryEvidences[j][k], k))
            cell.appendChild(document.createTextNode(',')) // Add commas for each evidence
          }
          cell.removeChild(cell.lastChild) // Remove last comma
          cell.appendChild(document.createTextNode(']')) // Close brackets
        }
        cell.appendChild(categoryWrapper)
      }
    }
  }

  getLinkForEvidence (categoryEvidence, text) {
    // Create link to evidence
    let link = document.createElement('a')
    link.target = '_blank'
    link.href = categoryEvidence.annotation.uri + '#annotations:' + categoryEvidence.annotation.id
    link.innerText = text
    return link
  }
}

module.exports = SLRView
