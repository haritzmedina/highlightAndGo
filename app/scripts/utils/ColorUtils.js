const ColorHash = require('color-hash')

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

  static getHashColor (text) {
    let colorHash = new ColorHash()
    let resultArray = colorHash.rgb(text)
    let alpha = 0.5
    return 'rgba(' + resultArray[0] + ',' + resultArray[1] + ',' + resultArray[2] + ', ' + alpha + ')'
  }
}

module.exports = ColorUtils
