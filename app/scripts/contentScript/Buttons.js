const $ = require('jquery')
const _ = require('lodash')
const ColorUtils = require('../utils/ColorUtils')

/**
 * A class to collect functionality to create buttons and groups of buttons for the sidebar
 */
class Buttons {
  static createGroupedButtons ({id, name, color = 'white', childGuideElements, groupHandler, buttonHandler, groupTemplate, groupRightClickHandler, buttonRightClickHandler}) {
    if (id) {
      let tagGroup
      // Create the container
      if (!groupTemplate) {
        groupTemplate = document.querySelector('#tagGroupTemplate')
        if (!_.isElement(groupTemplate)) {
          tagGroup = document.createElement('div')
          tagGroup.className = 'tagGroup'
          let groupName = document.createElement('h4')
          groupName.className = 'groupName'
          tagGroup.appendChild(groupName)
          let tagButtonContainer = document.createElement('div')
          tagButtonContainer.className = 'tagButtonContainer'
          tagGroup.appendChild(tagButtonContainer)
        }
      } else {
        $(groupTemplate.content.firstElementChild).clone().get(0)
      }
      tagGroup.dataset.codeName = name
      tagGroup.dataset.codeId = id
      let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = name
      groupNameSpan.title = name
      groupNameSpan.style.backgroundColor = color
      groupNameSpan.dataset.baseColor = color
      // Create event handler for tag group
      groupNameSpan.addEventListener('click', groupHandler)
      // Tag button background color change
      // TODO It should be better to set it as a CSS property, but currently there is not an option for that
      groupNameSpan.addEventListener('mouseenter', () => {
        groupNameSpan.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(groupNameSpan.dataset.baseColor), 0.7)
      })
      groupNameSpan.addEventListener('mouseleave', () => {
        if (groupNameSpan.dataset.chosen === 'true') {
          groupNameSpan.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(groupNameSpan.dataset.baseColor), 0.6)
        } else {
          groupNameSpan.style.backgroundColor = groupNameSpan.dataset.baseColor
        }
      })
      // Set button right click handler
      if (_.isFunction(groupRightClickHandler)) {
        Buttons.createGroupRightClickHandler(id, groupRightClickHandler)
      }
      // Create buttons and add to the container
      if (_.isArray(childGuideElements) && childGuideElements.length > 0) { // Only create group containers for groups which have elements
        for (let i = 0; i < childGuideElements.length; i++) {
          let element = childGuideElements[i]
          if (element.childElements.length > 0) {
            let groupButton = Buttons.createGroupedButtons({
              id: element.id,
              name: element.name,
              childGuideElements: element.childElements,
              color: element.color,
              groupHandler: groupHandler,
              buttonHandler: buttonHandler,
              groupRightClickHandler: groupRightClickHandler,
              buttonRightClickHandler: buttonRightClickHandler
            })
            tagButtonContainer.append(groupButton)
          } else {
            let button = Buttons.createButton({
              id: element.id,
              name: element.name,
              description: element.description,
              color: element.color,
              handler: buttonHandler,
              buttonRightClickHandler: buttonRightClickHandler
            })
            tagButtonContainer.append(button)
          }
        }
      }
      return tagGroup
    } else {
      throw new Error('Group button must have an unique id')
    }
  }

  static createGroupRightClickHandler (id, handler) {
    $.contextMenu({
      selector: '.tagGroup[data-code-id="' + id + '"] > .groupName',
      build: () => {
        return handler(id)
      }
    })
  }

  static createButton ({id, name, color = 'rgba(200, 200, 200, 1)', description, handler, buttonTemplate, buttonRightClickHandler}) {
    if (id) {
      let tagButton
      // Create the container
      if (!buttonTemplate) {
        buttonTemplate = document.querySelector('#tagGroupTemplate')
        if (!_.isElement(buttonTemplate)) {
          tagButton = document.createElement('button')
          tagButton.className = 'tagButton'
        }
      } else {
        $(buttonTemplate.content.firstElementChild).clone().get(0)
      }
      tagButton.dataset.codeName = name
      tagButton.dataset.codeId = id
      tagButton.innerText = name
      if (description) {
        tagButton.title = name + ': ' + description
      } else {
        tagButton.title = name
      }
      tagButton.dataset.mark = name
      if (color) {
        $(tagButton).css('background-color', color)
        tagButton.dataset.baseColor = color
      }
      // Set handler for button
      tagButton.addEventListener('click', handler)
      // Tag button background color change
      // TODO It should be better to set it as a CSS property, but currently there is not an option for that
      tagButton.addEventListener('mouseenter', () => {
        tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.dataset.baseColor), 0.7)
      })
      tagButton.addEventListener('mouseleave', () => {
        if (tagButton.dataset.chosen === 'true') {
          tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.dataset.baseColor), 0.6)
        } else {
          tagButton.style.backgroundColor = tagButton.dataset.baseColor
        }
      })
      return tagButton
    } else {
      throw new Error('Button must have an unique id')
    }
  }
}

module.exports = Buttons
