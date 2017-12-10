/* eslint-env jasmine, browser */
/* global browser */

const jsdom = require('jsdom')
const { JSDOM } = jsdom
const { window } = new JSDOM({url: 'https://hypothes.is/api/'})
global.window = window
const HypothesisClient = require('../../app/scripts/hypothesis/HypothesisClient')
const TOKEN = process.env.HYPOTHESIS_TOKEN
let annotation = null
let hypothesisClient = new HypothesisClient(TOKEN)

describe('Popup test', function () {
  beforeAll(() => {

  })

  it('Tool creates a popup using annotation', async function () {

  })

  afterAll(() => {

  })
})

let createFakeAnnotation = () => {

}
