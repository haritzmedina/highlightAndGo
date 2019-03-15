const ColorUtils = require('../utils/ColorUtils')
const $ = require('jquery')

class TagGroup {
  constructor (config, tags) {
    this.config = config
    this.tags = tags || []
    this.config.color = this.config.color || 'rgba(150,150,150,0.5)'
  }

  getColor () {
    return ColorUtils.setAlphaToColor(this.config.color, 0.3)
  }

  createPanel () {
    if (this.tags.length > 0) {
      let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
      let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
      let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = this.config.name
      groupNameSpan.title = this.config.name
      for (let j = 0; j < this.tags.length; j++) {
        let tagButton = this.tags[j].createButton()
        tagButtonContainer.append(tagButton)
      }
      return tagGroup
    }
  }
}

module.exports = TagGroup
