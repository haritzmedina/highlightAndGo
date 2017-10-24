const HypothesisClient = require('../../../hypothesis/HypothesisClient')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ChromeStorage = require('../../../utils/ChromeStorage')
const LanguageUtils = require('../../../utils/LanguageUtils')
const DOMTextUtils = require('../../../utils/DOMTextUtils')
const DataUtils = require('../../../utils/DataUtils')

const highlightClassName = 'popupHighlight'
const highlightFilteredClassName = 'popupHighlightFiltered'

const selectedGroupNamespace = 'hypothesis.currentGroup'
const reloadIntervalInSeconds = 60 // Reload the sidebar every 60 seconds
const defaultGroup = {id: '__world__', name: 'Public', public: true}

class Purpose {
  constructor () {
    this.hypothesisClient = null
    this.user = {}
    this.currentGroup = null
    this.currentPurposes = {}
  }

  init () {
    console.debug('Initializing purpose annotator')
    // Create sidebar
    this.initSidebar()
  }

  initSidebar () {
    let sidebarURL = chrome.extension.getURL('pages/annotator/Purpose/sidebar.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('body').append($.parseHTML(html))
      // Initialize sidebar toggle button
      this.initSidebarButton()
      // Load groups container
      this.reloadGroupsContainer({reloadAnnotations: true}, () => {
        setInterval(() => {
          console.debug('Reloading groups container')
          this.reloadGroupsContainer()
        }, reloadIntervalInSeconds * 1000)
      })
    })
  }

  setEventForGroupSelectChange () {
    let menu = document.querySelector('#groupSelector')
    $(menu).change(() => {
      let selectedGroup = $('#groupSelector').find('option:selected').get(0)
      this.updateCurrentGroup(selectedGroup.dataset.groupId)
    })
  }

  updateCurrentGroup (currentGroupId) {
    this.user.groups.forEach(group => {
      if (currentGroupId === group.id) {
        this.currentGroup = group
        // Save in chrome storage too
        ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(group)}, ChromeStorage.local, () => {
          console.debug('Group updated. Name: %s id: %s', group.name, group.id)
          // Reload purposes
          this.reloadPurposes(() => {
            // Reload annotations highlight
            this.reloadAnnotationsHighlight()
          })
        })
      }
    })
  }

  initSidebarButton () {
    let sidebarButton = document.querySelector('#sidebarButton')
    sidebarButton.addEventListener('click', () => {
      this.toggleSidebar()
    })
  }

  reloadPurposes (callback) {
    console.debug('Reloading purposes')
    // Retrieve annotations for url https://*/* and tag prefix Purpose:
    this.hypothesisClient.searchAnnotations({uri: 'https://*/*', group: this.currentGroup.id}, (annotations) => {
      let purposes = []
      annotations.forEach(annotation => {
        let purposeNames = [] // For each purpose in the annotation
        annotation.tags.forEach(tag => {
          if (tag.includes('Purpose:')) {
            purposeNames.push(tag.substr(8))
          }
        })
        // Set the color for each purpose
        let params = jsYaml.load(annotation.text)
        purposeNames.forEach(purposeName => {
          let purpose = {name: purposeName}
          if (params && params.color) {
            purpose['color'] = params.color
          } else {
            purpose['color'] = 'rgba(200,200,200,0.8)'
          }
          purposes.push(purpose)
        })
      })
      // Save current purposes
      this.updateCurrentPurposes(purposes)
      // Create the buttons of the cheatsheet
      let purposeContainer = document.querySelector('#purposes')
      purposeContainer.innerHTML = '' // On every reload, clean the previous buttons
      this.currentPurposes.forEach(purpose => {
        let purposeButtonTemplate = document.querySelector('#purposeButtonTemplate')
        let purposeButton = $(purposeButtonTemplate.content.firstElementChild).clone().get(0)
        purposeButton.innerText = purpose.name
        purposeButton.title = purpose.name
        // Add metadata required for the button operations
        purposeButton.dataset.tag = 'Purpose:' + purpose.name
        purposeButton.dataset.purpose = purpose.name
        purposeButton.dataset.color = purpose.color
        purposeButton.dataset.filterActive = purpose.activated || 'false'
        this.setBackgroundColor(purposeButton, purpose.color)
        purposeContainer.appendChild(purposeButton)
      })
      // Set event handler for purpose buttons
      this.setHandlerForButtons()
      console.debug('Reloaded purposes')
      // Callback
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
    })
  }

  updateCurrentPurposes (purposes) {
    console.debug('Updating current purposes')
    let originalPurposes = []
    originalPurposes = originalPurposes.concat(this.currentPurposes)
    purposes.forEach(purpose => {
      let originalPurpose = DataUtils.queryByExample(originalPurposes, {name: purpose.name})[0]
      if (originalPurpose && originalPurpose.activated) {
        purpose.activated = true
      }
    })
    this.currentPurposes = purposes
    console.debug('Updated current purposes')
  }

  reloadGroupsContainer (opts, callback) {
    // Check logged in hypothesis
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      if (token) {
        this.hypothesisClient = new HypothesisClient(token)
        // Hide login/sign up form
        $('#notLoggedInGroupContainer').attr('aria-hidden', 'true')
        // Display group container
        $('#loggedInGroupContainer').attr('aria-hidden', 'false')
        // Set current group if not defined
        this.defineCurrentGroup(() => {
          // Render groups container
          this.renderGroupsContainer(() => {
            if (opts && opts.reloadAnnotations) {
              // Load annotations highlight
              this.reloadAnnotationsHighlight({}, () => {
                if (LanguageUtils.isFunction(callback)) {
                  callback()
                }
              })
            } else {
              if (LanguageUtils.isFunction(callback)) {
                callback()
              }
            }
          })
        })
      } else {
        // Display login/sign up form
        $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
        // Hide group container
        $('#loggedInGroupContainer').attr('aria-hidden', 'true')
        // Hide purposes wrapper
        $('#purposesWrapper').attr('aria-hidden', 'true')
        if (LanguageUtils.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  reloadAnnotationsHighlight (opts, callback) {
    console.debug('Reloading annotations highlight')
    // Remove previously highlighted content
    DOMTextUtils.unHighlightAllContent(highlightClassName)
    DOMTextUtils.unHighlightAllContent(highlightFilteredClassName)
    // Retrieve purposes
    // Highlight the content according to current group's purposes
    if (this.hypothesisClient) {
      this.hypothesisClient.searchAnnotations({url: window.location.href, group: this.currentGroup.id}, (annotations) => {
        console.debug(annotations)
        let purposeAnnotations = []
        annotations.forEach(annotation => {
          for (let i = 0; i < annotation.tags.length; i++) {
            if (annotation.tags[i].includes('Purpose:')) {
              let purposeAnnotation = {}
              Object.assign(purposeAnnotation, annotation)
              purposeAnnotation.purpose = annotation.tags[i].substr(8)
              let purpose = DataUtils.queryByExample(this.currentPurposes, {name: purposeAnnotation.purpose})[0]
              purposeAnnotation.color = purpose.color || 'rgba(200,200,200,0.8)'
              purposeAnnotations.push(purposeAnnotation)
              return
            }
          }
        })
        let promises = []
        purposeAnnotations.forEach(purposeAnnotation => {
          promises.push(new Promise((resolve, reject) => {
            let classNameToHighlight = this.retrieveHighlightClassName(purposeAnnotation)
            try {
              let highlightedElements = DOMTextUtils.highlightContent(purposeAnnotation.target[0].selector, classNameToHighlight, purposeAnnotation.id, {purpose: purposeAnnotation.purpose})
              // Highlight in same color as button
              highlightedElements.forEach(highlightedElement => {
                // If need to highlight, set the color corresponding to, in other case, maintain its original color
                if (classNameToHighlight === highlightClassName) {
                  this.setBackgroundColor(highlightedElement, purposeAnnotation.color)
                } else {
                  this.setBackgroundColor(highlightedElement)
                }
                // Set purpose color
                highlightedElement.dataset.color = purposeAnnotation.color
                // Set data purpose
                highlightedElement.dataset.purpose = purposeAnnotation.purpose
                highlightedElement.dataset.tag = 'Purpose:' + purposeAnnotation.purpose
              })
            } catch (err) {
              throw err
            } finally {
              resolve()
            }
          }))
        })
        Promise.all(promises).then(() => {
          console.debug('Reloaded annotations highlight')
          if (LanguageUtils.isFunction(callback)) {
            callback()
          }
        })
      })
    } else {
      throw Error('Hypothesis client is not created')
    }
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
          if (!LanguageUtils.isEmptyObject(savedCurrentGroup) && savedCurrentGroup.data) {
            this.currentGroup = JSON.parse(savedCurrentGroup.data)
          } else {
            this.currentGroup = defaultGroup
          }
        }
        if (LanguageUtils.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
    }
  }

  renderGroupsContainer (callback) {
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    this.hypothesisClient.getUserProfile((profile) => {
      this.user.groups = profile.groups
      console.debug(profile.groups)
      let dropdownMenu = document.querySelector('#groupSelector')
      dropdownMenu.innerHTML = '' // Remove all groups
      this.user.groups.forEach(group => {
        let groupSelectorItem = document.createElement('option')
        groupSelectorItem.dataset.groupId = group.id
        groupSelectorItem.innerText = group.name
        groupSelectorItem.className = 'dropdown-item'
        dropdownMenu.appendChild(groupSelectorItem)
      })
      // Set select option
      $('#groupSelector').find('option[data-group-id="' + this.currentGroup.id + '"]').prop('selected', 'selected')
      // Set event handler for group change
      this.setEventForGroupSelectChange()
      // Set event for annotation toggle
      this.setEventForAnnotationToggle()
      // Reload purposes for current group
      this.reloadPurposes(() => {
        if (LanguageUtils.isFunction(callback)) {
          callback()
        }
      })
    })
  }

  toggleSidebar () {
    let sidebarButton = document.querySelector('#sidebarButton')
    sidebarButton.dataset.toggled = sidebarButton.dataset.toggled !== 'true'
    document.documentElement.dataset.sidebarShown = sidebarButton.dataset.toggled
    document.querySelector('#annotatorSidebarContainer').dataset.shown = sidebarButton.dataset.toggled
  }

  setHandlerForButtons () {
    // TODO Substitute by JQuery On content added to #purposes
    let purposeButtons = document.querySelectorAll('.purposeButton')
    purposeButtons.forEach(purposeButton => {
      purposeButton.addEventListener('click', (e) => {
        this.retrievePurposeOnClickEventHandler({event: e})()
      })
    })
  }

  retrievePurposeOnClickEventHandler (opts) {
    return () => {
      let annotatorToggle = document.querySelector('#annotatorToggle')
      if (annotatorToggle.checked) {
        this.createAnnotationHandler(opts)
      } else {
        this.filterAnnotationHandler(opts)
      }
    }
  }

  createAnnotationHandler (opts) {
    let selectors = []
    // If selection is empty, return null
    if (document.getSelection().toString().length === 0) {
      console.debug('Current selection is empty') // TODO Show user message
      return
    }
    let range = document.getSelection().getRangeAt(0)
    // Create FragmentSelector
    let fragmentSelector = DOMTextUtils.getFragmentSelector(range)
    if (fragmentSelector) {
      selectors.push(fragmentSelector)
    }
    // Create RangeSelector
    let rangeSelector = DOMTextUtils.getRangeSelector(range)
    if (rangeSelector) {
      selectors.push(rangeSelector)
    }
    // Create TextPositionSelector
    let textPositionSelector = DOMTextUtils.getTextPositionSelector(range)
    if (textPositionSelector) {
      selectors.push(textPositionSelector)
    }
    // Create TextQuoteSelector
    let textQuoteSelector = DOMTextUtils.getTextQuoteSelector(range)
    if (textQuoteSelector) {
      selectors.push(textQuoteSelector)
    }
    // Construct the annotation to send to hypothesis
    let annotation = this.constructAnnotation(selectors, opts.event.target.dataset.tag)
    this.hypothesisClient.createNewAnnotation(annotation, (annotationId) => {
      console.debug('Created annotation with ID: ' + annotationId)
      // Highlight the content in the DOM
      let highlightedElements = DOMTextUtils.highlightContent(selectors, highlightClassName, annotationId, {})
      highlightedElements.forEach(highlightedElement => {
        // Set color
        this.setBackgroundColor(highlightedElement, opts.event.target.dataset.color)
        // Set data purpose
        highlightedElement.dataset.color = opts.event.target.dataset.color
        highlightedElement.dataset.tag = opts.event.target.dataset.tag
        highlightedElement.dataset.purpose = opts.event.target.dataset.purpose
      })
    })
  }

  constructAnnotation (selectors, tag) {
    return {
      group: this.currentGroup.id,
      permissions: {
        read: ['group:__world__']
      },
      references: [],
      tags: [tag],
      target: [{
        selector: selectors
      }],
      text: '',
      uri: window.location.href
    }
  }

  filterAnnotationHandler (opts) {
    // Retrieve tag of element
    let purpose = opts.event.target.dataset.purpose
    if (opts.event.target.dataset.filterActive === 'true') {
      // Set in filter status current purpose
      this.currentPurposes[DataUtils.queryIndexByExample(this.currentPurposes, {name: purpose})].active = false
      // Deactivate filter button
      opts.event.target.dataset.filterActive = 'false'
      // Retrieve all elements highlighted and with tag
      let elements = document.querySelectorAll('.' + highlightClassName + '[data-purpose="' + purpose + '"]')
      // Unhighlight for each element
      elements.forEach(element => {
        $(element).removeClass(highlightClassName)
        $(element).addClass(highlightFilteredClassName)
        this.setBackgroundColor(element)
      })
    } else {
      // Set in filter status current purpose
      this.currentPurposes[DataUtils.queryIndexByExample(this.currentPurposes, {name: purpose})].active = true
      // Activate filter button
      opts.event.target.dataset.filterActive = 'true'
      // Retrieve all elements highlighted and with tag
      let elements = document.querySelectorAll('.' + highlightFilteredClassName + '[data-purpose="' + purpose + '"]')
      elements.forEach(element => {
        $(element).removeClass(highlightFilteredClassName)
        $(element).addClass(highlightClassName)
        this.setBackgroundColor(element, opts.event.target.dataset.color)
      })
    }
  }

  setBackgroundColor (elem, color) {
    if (color) {
      $(elem).css('background-color', color)
    } else {
      if (elem.nodeName === 'MARK') {
        $(elem).css('background-color', 'initial')
      } else {
        $(elem).css('background-color', '')
      }
    }
  }

  retrieveHighlightClassName (purposeAnnotation) {
    // If annotation toggle is active, all annotations with purpose are shown
    let annotatorToggle = document.querySelector('#annotatorToggle')
    if (annotatorToggle.checked) {
      return highlightClassName
    } else {
      let currentPurpose = DataUtils.queryByExample(this.currentPurposes, {name: purposeAnnotation.purpose})[0]
      if (currentPurpose.active) {
        return highlightClassName
      } else {
        return highlightFilteredClassName
      }
    }
  }

  setEventForAnnotationToggle () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    annotatorToggle.addEventListener('click', () => {
      let modeLabel = document.querySelector('#modeLabel')
      if (!annotatorToggle.checked) {
        // Change the label text
        modeLabel.innerText = chrome.i18n.getMessage('locating')
        // Highlight only actived purposes
        let elements = document.querySelectorAll('.' + highlightClassName)
        elements.forEach(element => {
          // Retrieve if purpose is active or not
          let elementPurpose = DataUtils.queryByExample(this.currentPurposes, {name: element.dataset.purpose})[0]
          if (elementPurpose.active) {
            $(element).removeClass(highlightFilteredClassName)
            $(element).addClass(highlightClassName)
            this.setBackgroundColor(element, element.dataset.color)
          } else {
            $(element).removeClass(highlightClassName)
            $(element).addClass(highlightFilteredClassName)
            this.setBackgroundColor(element)
          }
        })
        // Active only purposes already actived in the purpose panel
        this.currentPurposes.forEach((purpose) => {
          let purposeButton = document.querySelector('.purposeButton[data-purpose="' + purpose.name + '"')
          purposeButton.dataset.filterActive = purpose.active ? 'true' : 'false'
        })
      } else {
        // Change the label text
        modeLabel.innerText = chrome.i18n.getMessage('annotating')
        // Highlight all the filtered purposes
        let elements = document.querySelectorAll('.' + highlightFilteredClassName)
        elements.forEach(element => {
          $(element).removeClass(highlightFilteredClassName)
          $(element).addClass(highlightClassName)
          this.setBackgroundColor(element, element.dataset.color)
        })
        // Active all purposes in sidebar
        this.currentPurposes.forEach((purpose) => {
          let purposeButton = document.querySelector('.purposeButton[data-purpose="' + purpose.name + '"')
          purposeButton.dataset.filterActive = 'true'
        })
      }
    })
  }
}

module.exports = Purpose
