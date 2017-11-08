const HypothesisClient = require('../../../hypothesis/HypothesisClient')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ChromeStorage = require('../../../utils/ChromeStorage')
const LanguageUtils = require('../../../utils/LanguageUtils')
const DOMTextUtils = require('../../../utils/DOMTextUtils')
const DataUtils = require('../../../utils/DataUtils')

const highlightClassName = 'purposeHighlight'
const highlightFilteredClassName = 'purposeHighlightFiltered'

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

  init (callback) {
    console.debug('Initializing purpose annotator')
    // Init hypothesis client
    this.initHypothesisClient(() => {
      // Create sidebar
      this.initSidebar(() => {
        // Load groups container
        this.reloadGroupsContainer(() => {
          this.reloadPurposes(() => {
            // Load annotations highlight
            this.reloadAnnotationsHighlight(() => {
              // Initialize sidebar reloading
              this.initSidebarReloading(() => {
                if (LanguageUtils.isFunction(callback)) {
                  callback(this.currentGroup)
                }
              })
            })
          })
        })
      })
    })
  }

  initSidebarReloading (callback) {
    setInterval(() => {
      console.debug('Reloading groups container')
      this.reloadGroupsContainer(() => {
        this.reloadPurposes(() => {
        })
      })
    }, reloadIntervalInSeconds * 1000)
    if (LanguageUtils.isFunction(callback)) {
      callback()
    }
  }

  initializeByAnnotations (annotations, callback) {
    console.debug('Initializing purpose annotator')
    // Init hypothesis client
    this.initHypothesisClient(() => {
      // Create sidebar
      this.initSidebar(() => {
        // Set group based on first annotation
        this.retrieveHypothesisGroups((groups) => {
          // Look for group of annotation
          groups.forEach(group => {
            if (group.id === annotations[0].group) {
              this.currentGroup = group
            }
          })
          this.reloadGroupsContainer(() => {
            this.reloadPurposes(() => {
              // Load annotations highlight
              this.reloadAnnotationsHighlight(() => {
                // Initialize sidebar reloading
                this.initSidebarReloading()
                // Activate corresponding purpose to visualize the annotation
                let purposesToActivate = []
                annotations.forEach(annotation => {
                  annotation.tags.forEach(tag => {
                    if (tag.toLowerCase().includes('purpose:')) {
                      // TODO Check if purpose exists in current selected group
                      // Add to the purposes
                      purposesToActivate.push(tag.substr(8))
                    }
                  })
                })
                purposesToActivate.forEach(purposeToActivate => {
                  this.setPurposeFiltering(purposeToActivate, true)
                })
                // Scroll down to the corresponding purpose
                // Retrieve only the first annotation (because it's impossible to scroll to more than one)
                if (annotations.length > 0) {
                  let annotation = annotations[0]
                  let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
                  $('html').animate({
                    scrollTop: $(firstElementToScroll).offset().top + 'px'
                  }, 300)
                }

                // Call the callback
                if (LanguageUtils.isFunction(callback)) {
                  callback()
                }
              })
            })
          })
        })
      })
    })
  }

  initSidebar (callback) {
    let sidebarURL = chrome.extension.getURL('pages/annotator/Purpose/sidebar.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('body').append($.parseHTML(html))
      // Initialize sidebar labels
      this.initSidebarLabels()
      // Initialize sidebar toggle button
      this.initSidebarButton()
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
    })
  }

  initHypothesisClient (callback) {
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      if (token) {
        this.hypothesisClient = new HypothesisClient(token)
      } else {
        this.hypothesisClient = new HypothesisClient()
      }
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
    })
  }

  setEventForGroupSelectChange () {
    let menu = document.querySelector('#groupSelector')
    $(menu).change(() => {
      let selectedGroup = $('#groupSelector').find('option:selected').get(0)
      this.updateCurrentGroup(selectedGroup.dataset.groupId)
    })
  }

  updateCurrentGroup (currentGroupId, callback) {
    this.user.groups.forEach(group => {
      if (currentGroupId === group.id) {
        this.currentGroup = group
        // Save in chrome storage too
        ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(group)}, ChromeStorage.local, () => {
          console.debug('Group updated. Name: %s id: %s', group.name, group.id)
          // Reload purposes
          this.reloadPurposes(() => {
            // Reload annotations highlight
            this.reloadAnnotationsHighlight(() => {
              if (LanguageUtils.isFunction(callback)) {
                callback()
              }
            })
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
    // Retrieve annotations for url of the group in hypothesis and tag prefix Purpose:
    this.hypothesisClient.searchAnnotations({uri: this.currentGroup.url, group: this.currentGroup.id}, (annotations) => {
      console.debug(annotations)
      let purposes = []
      annotations.forEach(annotation => {
        let purposeNames = [] // For each purpose in the annotation
        annotation.tags.forEach(tag => {
          if (tag.toLowerCase().startsWith('purpose:')) {
            purposeNames.push(tag.substr(8))
          }
        })
        console.debug('Loaded purposes:')
        console.debug(purposeNames)
        // Load purpose params
        let params
        if (annotation.text) {
          params = jsYaml.load(annotation.text)
        }
        purposeNames.forEach(purposeName => {
          let parsedPurposeName = this.parsePurposeName(purposeName)
          let purpose = {name: purposeName, id: parsedPurposeName}
          // Set the color for each purpose if exists
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
        purposeButton.dataset.purpose = purpose.id
        purposeButton.dataset.color = purpose.color
        purposeButton.dataset.filterActive = purpose.activated || 'false'
        this.setBackgroundColor(purposeButton, purpose.color)
        purposeContainer.appendChild(purposeButton)
      })
      // Set event handler for purpose buttons
      this.setHandlerForButtons()
      // Active currently activated purposes
      this.renderCurrentActivePurposes()
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
      if (originalPurpose && originalPurpose.active) {
        purpose.active = true
      }
    })
    this.currentPurposes = purposes
    console.debug('Updated current purposes')
  }

  reloadGroupsContainer (callback) {
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
            if (LanguageUtils.isFunction(callback)) {
              callback()
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

  reloadAnnotationsHighlight (callback) {
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
            if (annotation.tags[i].toLowerCase().includes('purpose:')) {
              let purposeAnnotation = {}
              Object.assign(purposeAnnotation, annotation)
              purposeAnnotation.purpose = annotation.tags[i].substr(8)
              let purpose = DataUtils.queryByExample(this.currentPurposes, {name: purposeAnnotation.purpose})[0]
              if (purpose) {
                purposeAnnotation.color = purpose.color || 'rgba(200,200,200,0.8)'
                purposeAnnotation.purpose = purpose.id
                purposeAnnotations.push(purposeAnnotation)
              }
              return
            }
          }
        })
        let promises = []
        purposeAnnotations.forEach(purposeAnnotation => {
          promises.push(new Promise((resolve) => {
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

  retrieveHypothesisGroups (callback) {
    this.hypothesisClient.getUserProfile((profile) => {
      this.user.groups = profile.groups
      if (LanguageUtils.isFunction(callback)) {
        callback(profile.groups)
      }
    })
  }

  renderGroupsContainer (callback) {
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    this.retrieveHypothesisGroups((groups) => {
      this.user.groups = groups
      console.debug(groups)
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
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
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
    // If selection is child of sidebar, return null
    if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
      console.debug('Current selection is child of the annotator sidebar') // TODO Show user message
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
      window.getSelection().removeAllRanges()
    })
  }

  constructAnnotation (selectors, tag) {
    return {
      group: this.currentGroup.id,
      permissions: {
        read: ['group:' + this.currentGroup.id]
      },
      references: [],
      tags: [tag],
      target: [{
        selector: selectors
      }],
      text: '',
      uri: location.href.replace(location.hash, '')
    }
  }

  /**
   * Set purpose filtering, active or deactivated if locating mode is selected (if annotation mode is selected, the purpose button and highlights doesn't change)
   * @param purpose String The id of the purpose
   * @param filter Boolean True or false, if you want to active or deactivate the purpose filtering
   */
  setPurposeFiltering (purpose, filter) {
    // Change purpose
    this.currentPurposes[DataUtils.queryIndexByExample(this.currentPurposes, {id: purpose})].active = filter
    let annotatorToggle = document.querySelector('#annotatorToggle')
    // If mode is locating, re-render the website
    if (!annotatorToggle.checked) {
      // Search for element in sidebar
      let purposeButton = document.querySelector('#purposes').querySelector('[data-purpose="' + purpose + '"')
      // Set purpose button status
      purposeButton.dataset.filterActive = filter
      // Highlight/unhighlight elements in DOM
      if (filter) {
        let elements = document.querySelectorAll('.' + highlightFilteredClassName + '[data-purpose="' + purpose + '"]')
        this.highlightElements(elements)
      } else {
        let elements = document.querySelectorAll('.' + highlightClassName + '[data-purpose="' + purpose + '"]')
        this.unHighlightElements(elements)
      }
    }
  }

  highlightElements (elements) {
    elements.forEach(element => {
      $(element).removeClass(highlightFilteredClassName)
      $(element).addClass(highlightClassName)
      this.setBackgroundColor(element, element.dataset.color)
    })
  }

  unHighlightElements (elements) {
    // Unhighlight for each element
    elements.forEach(element => {
      $(element).removeClass(highlightClassName)
      $(element).addClass(highlightFilteredClassName)
      this.setBackgroundColor(element)
    })
  }

  filterAnnotationHandler (opts) {
    // Retrieve tag of element
    let purpose = opts.event.target.dataset.purpose
    if (opts.event.target.dataset.filterActive === 'true') {
      this.setPurposeFiltering(purpose, false)
    } else {
      this.setPurposeFiltering(purpose, true)
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
          let elementPurpose = DataUtils.queryByExample(this.currentPurposes, {id: element.dataset.purpose})[0]
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
      }
      this.renderCurrentActivePurposes()
    })
  }

  renderCurrentActivePurposes () {
    let annotatorToggle = document.querySelector('#annotatorToggle')
    if (annotatorToggle.checked) {
      // Active all purposes in sidebar
      this.currentPurposes.forEach((purpose) => {
        let purposeButton = document.querySelector('.purposeButton[data-purpose="' + purpose.id + '"')
        purposeButton.dataset.filterActive = 'true'
      })
    } else {
      // Active only purposes already actived in the purpose panel
      this.currentPurposes.forEach((purpose) => {
        let purposeButton = document.querySelector('.purposeButton[data-purpose="' + purpose.id + '"')
        purposeButton.dataset.filterActive = purpose.active ? 'true' : 'false'
      })
    }
  }

  parsePurposeName (purposeName) {
    return purposeName.replace(/[^A-Za-z0-9]/g, '').replace(/[0-9]+/, '')
  }

  initSidebarLabels () {
    let sidebar = $('#annotatorSidebarContainer')
    let readingTaskLabel = sidebar.find('#groupHeader label')
    readingTaskLabel.text(chrome.i18n.getMessage('readingTask'))
    let modeLabel = sidebar.find('#modeHeader label')
    modeLabel.text(chrome.i18n.getMessage('mode'))
    let purposesLabel = sidebar.find('#purposesHeader')
    purposesLabel.text(chrome.i18n.getMessage('purposes'))
    let modeSwitchLabel = sidebar.find('#modeLabel')
    modeSwitchLabel.text(chrome.i18n.getMessage('locating'))
  }

  includesTag (array, tag) {
    for (let i = 0; i < array.length; i++) {
      if (array[i].toLowerCase() === tag) {
        return true
      }
    }
    return false
  }
}

module.exports = Purpose
