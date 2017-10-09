const HypothesisClient = require('../../../hypothesis/HypothesisClient')
const $ = require('jquery')
const ChromeStorage = require('../../../utils/ChromeStorage')
const LanguageUtils = require('../../../utils/LanguageUtils')

const domAnchorTextQuote = require('dom-anchor-text-quote')

// TODO Review
// require('bootstrap')

const selectedGroupNamespace = 'hypothesis.currentGroup'
const reloadIntervalInSeconds = 60 // Reload the group annotations every 60 seconds

class Purpose {
  constructor () {
    this.hypothesisClient = null
    this.user = {}
    this.currentGroup = {id: '__world__', name: 'Public', public: true}
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
    let _this = this
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('body').append($.parseHTML(html))
      // Initialize sidebar toggle button
      this.initSidebarButton()
      // Retrieve hypothesis token
      chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
        let sidebarContainer = document.querySelector('#annotatorSidebarContainer')
        if (token) {
          this.hypothesisClient = new HypothesisClient(token)
          this.reloadGroups(() => {
            ChromeStorage.getData(selectedGroupNamespace, ChromeStorage.local, (err, savedCurrentGroup) => {
              let currentGroup
              if (!LanguageUtils.isEmptyObject(savedCurrentGroup) && savedCurrentGroup.data) {
                currentGroup = JSON.parse(savedCurrentGroup.data)
                _this.currentGroup = currentGroup
              } else {
                currentGroup = _this.currentGroup
              }
              // Set select option
              this.setGroupSelectorValue(currentGroup)
              // TODO Set event handler for group change
              this.setEventForGroupSelectChange()
              // Periodically retrieve annotations and reload layout
              this.reloadPurposes(() => {
                setInterval(() => {
                  this.reloadPurposes()
                }, reloadIntervalInSeconds * 1000)
              })
            })
          })
        } else {
          // Display login/sign up form
          let hypothesisLogin = sidebarContainer.querySelector('#hypothesisLogin')
          $(hypothesisLogin).attr('aria-hidden', 'false')
        }
      })
    })
  }

  setGroupSelectorValue (currentGroup) {
    $('#dropdown-menu').find('option[data-group-id="' + currentGroup.id + '"]').prop('selected', 'selected')
  }

  setEventForGroupSelectChange () {
    let menu = document.querySelector('#dropdown-menu')
    $(menu).change(() => {
      let selectedGroup = $('#dropdown-menu').find('option:selected').get(0)
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

  reloadGroups (callback) {
    // Display group selector and purposes selector
    let groupSelectorContainer = document.querySelector('#groupSelectorContainer')
    let purposes = document.querySelector('#purposes')
    $(groupSelectorContainer).attr('aria-hidden', 'false')
    $(purposes).attr('aria-hidden', 'false')
    // TODO Retrieve groups if user is logged in
    this.hypothesisClient.getUserProfile((profile) => {
      this.user.groups = profile.groups
      console.log(profile.groups)
      let dropdownMenu = document.querySelector('#dropdown-menu')
      this.user.groups.forEach(group => {
        let groupSelectorItem = document.createElement('option')
        groupSelectorItem.dataset.groupId = group.id
        groupSelectorItem.innerText = group.name
        groupSelectorItem.className = 'dropdown-item'
        dropdownMenu.appendChild(groupSelectorItem)
      })
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
    let purposeButtons = document.querySelectorAll('.purposeButton')
    purposeButtons.forEach(purposeButton => {
      purposeButton.addEventListener('click', (e) => {
        let handler = this.purposeOnClickEvent()
        handler()
      })
    })
  }

  purposeOnClickEvent (opts) {
    return (event) => {
      let text = ''
      if (window.getSelection) {
        text = window.getSelection().toString()
      } else if (document.selection && document.selection.type !== 'Control') {
        text = document.selection.createRange().text
      }
      console.log(text)
    }
  }
}

module.exports = Purpose
