const HypothesisClient = require('../../../hypothesis/HypothesisClient')
const $ = require('jquery')
const ChromeStorage = require('../../../utils/ChromeStorage')
const LanguageUtils = require('../../../utils/LanguageUtils')
const DOM = require('../../../utils/DOM')

const domAnchorTextQuote = require('dom-anchor-text-quote')
const domAnchorTextPosition = require('dom-anchor-text-position')
const xpathRange = require('xpath-range')

// TODO Review
// require('bootstrap')

const selectedGroupNamespace = 'hypothesis.currentGroup'
const reloadIntervalInSeconds = 6 // Reload the group annotations every 60 seconds
const defaultGroup = {id: '__world__', name: 'Public', public: true}

class Purpose {
  constructor () {
    this.hypothesisClient = null
    this.user = {}
    this.currentGroup = null
  }

  init () {
    console.debug('Initializing purpose annotator')
    // Create sidebar
    this.initSidebar()
    // TODO Retrieve annotations to highlight
    /* document.addEventListener('selectionchange', (e) => {
      console.log(e)
    }) */
  }

  initSidebar () {
    let sidebarURL = chrome.extension.getURL('pages/annotator/Purpose/sidebar.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('body').append($.parseHTML(html))
      // Initialize sidebar toggle button
      this.initSidebarButton()
      // Load groups container
      this.reloadGroupsContainer(() => {
        setInterval(() => {
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
          this.reloadPurposes()
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
    // TODO Retrieve annotations for url https://*/* and tag prefix purpose:
    this.hypothesisClient.searchAnnotations({uri: 'https://*/*', group: this.currentGroup.id}, (annotations) => {
      let purposes = []
      annotations.forEach(annotation => {
        annotation.tags.forEach(tag => {
          if (tag.includes('Purpose:')) {
            purposes.push(tag.substr(8))
          }
        })
      })
      // Create the buttons of the cheatsheet
      let purposeContainer = document.querySelector('#purposes')
      purposeContainer.innerHTML = '' // On every reload, clean the previous buttons
      purposes.forEach(purpose => {
        let purposeButtonTemplate = document.querySelector('#purposeButtonTemplate')
        let purposeButton = $(purposeButtonTemplate.content.firstElementChild).clone().get(0)
        purposeButton.innerText = purpose
        purposeButton.dataset.tag = 'Purpose:' + purpose
        purposeContainer.appendChild(purposeButton)
      })
      this.setHandlerForButtons()
      if (LanguageUtils.isFunction(callback)) {
        callback()
      }
    })
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
    // Set select option
    $('#groupSelector').find('option[data-group-id="' + this.currentGroup.id + '"]').prop('selected', 'selected')
    // Reload purposes for current group
    this.reloadPurposes()
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    this.hypothesisClient.getUserProfile((profile) => {
      this.user.groups = profile.groups
      console.debug(profile.groups)
      let dropdownMenu = document.querySelector('#groupSelector')
      this.user.groups.forEach(group => {
        let groupSelectorItem = document.createElement('option')
        groupSelectorItem.dataset.groupId = group.id
        groupSelectorItem.innerText = group.name
        groupSelectorItem.className = 'dropdown-item'
        dropdownMenu.appendChild(groupSelectorItem)
      })
      // Set event handler for group change
      this.setEventForGroupSelectChange()
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
        let handler = this.purposeOnClickEvent({event: e})
        handler()
      })
    })
  }

  purposeOnClickEvent (opts) {
    return () => {
      /* let text = ''
      if (window.getSelection) {
        text = window.getSelection().toString()
      } else if (document.selection && document.selection.type !== 'Control') {
        text = document.selection.createRange().text
      }
      console.log(text) */
      let selectors = []
      let range = document.getSelection().getRangeAt(0)
      // Create FragmentSelector
      let fragmentSelector = this.getFragmentSelector(range)
      if (fragmentSelector) {
        selectors.push(fragmentSelector)
      }
      // Create RangeSelector
      let rangeSelector = this.getRangeSelector(range)
      if (rangeSelector) {
        selectors.push(rangeSelector)
      }
      // Create TextPositionSelector
      let textPositionSelector = this.getTextPositionSelector(range)
      if (textPositionSelector) {
        selectors.push(textPositionSelector)
      }
      // Create TextQuoteSelector
      let textQuoteSelector = this.getTextQuoteSelector(range)
      if (textQuoteSelector) {
        selectors.push(textQuoteSelector)
      }
      // TODO Construct the annotation to send to hypothesis
      let annotation = this.constructAnnotation(selectors, opts.event.target.dataset.tag)
      this.hypothesisClient.createNewAnnotation(annotation, (response) => {
        console.log('Created annotation with ID: ' + response)
      })
      // TODO Highlight the content in the DOM
    }
  }

  getFragmentSelector (range) {
    if (range.commonAncestorContainer) {
      let parentId = DOM.getParentNodeWithId(range.commonAncestorContainer)
      if (parentId) {
        return {
          'conformsTo': 'https://tools.ietf.org/html/rfc3236',
          'type': 'FragmentSelector',
          'value': parentId
        }
      }
    }
  }

  getRangeSelector (range) {
    let rangeSelector = xpathRange.fromRange(range)
    rangeSelector['type'] = 'RangeSelector'
    return rangeSelector
  }

  getTextPositionSelector (range) {
    let textPositionSelector = domAnchorTextPosition.fromRange(document.body, range)
    textPositionSelector['type'] = 'TextPositionSelector'
    return textPositionSelector
  }

  getTextQuoteSelector (range) {
    let textQuoteSelector = domAnchorTextQuote.fromRange(document.body, range)
    textQuoteSelector['type'] = 'TextQuoteSelector'
    return textQuoteSelector
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
}

module.exports = Purpose
