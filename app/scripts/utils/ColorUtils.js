const ColorHash = require('color-hash')
const Color = require('color')
const _ = require('lodash')

class ColorUtils {
  static getRandomColor () {
    let red = (Math.floor(Math.random() * 256))
    let green = (Math.floor(Math.random() * 256))
    let blue = (Math.floor(Math.random() * 256))
    let alpha = Math.random()
    if (alpha < 0.5) {
      alpha = 0.5
    }
    return 'rgba(' + red + ',' + green + ',' + blue + ', ' + alpha + ')'
  }

  static getHashColor (text, alpha) {
    let colorHash = new ColorHash({hash: ColorUtils.customHash})
    let resultArray = colorHash.rgb(text)
    let alphaValue = alpha || 0.5
    return 'rgba(' + resultArray[0] + ',' + resultArray[1] + ',' + resultArray[2] + ', ' + alphaValue + ')'
  }

  static setAlphaToColor (color, alpha) {
    return Color(color).alpha(alpha).rgb().string()
  }

  static customHash (str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      let char = str.charCodeAt(i)
      hash += char
    }
    return hash
  }

  static hasAlpha (str) {
    let color = new Color(str)
    return color.valpha !== 1
  }

  static getDifferentColor (colorList, str) {
    let color = null
    let attempts = 0
    do {
      color = ColorUtils.getHashColor(str)
      if (_.find(colorList, (c) => { return (new Color(c)).contrast(new Color(color)) < 2 })) {
        color = null
        str += 'a'
        attempts += 1 // Another try
      }
    } while (_.isEmpty(color) && attempts < 10)
    return color
  }

  static isDark (colorStr) {

  }
}

module.exports = ColorUtils
