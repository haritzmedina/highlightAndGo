/* eslint-env jasmine, browser */
/* global browser */

const jsdom = require('jsdom')
const { JSDOM } = jsdom
const { window } = new JSDOM({url: 'https://hypothes.is/api/'})
global.window = window

const HypothesisClient = require('../../app/scripts/hypothesis/HypothesisClient')

const TOKEN = process.env.HYPOTHESIS_TOKEN

const WEBSITE_URL = 'https://haritzmedina.com'

let annotationId = null
let hypothesisClient = new HypothesisClient(TOKEN)

describe('Popup test', function () {
  beforeAll(() => {
    browser.call(() => new Promise((resolve) => {
      hypothesisClient.createNewAnnotation({
        'group': '__world__',
        'permissions': {
          'read': [
            'group:__world__'
          ]
        },
        'references': [
        ],
        'tags': [
          'test'
        ],
        'target': [
          {
            'selector':
              [
                {
                  'exact': 'Haritz Medina',
                  'prefix': 'mi nombre es ',
                  'type': 'TextQuoteSelector',
                  'suffix': ' y este es mi sitio'
                }
              ]
          }
        ],
        'body': {
          'type': 'TextualBody',
          'value': 'Example',
          'format': 'text/html',
          'language': 'en'
        },
        'uri': WEBSITE_URL,
        'motivation': 'highlighting'
      }, (response) => {
        annotationId = response
        console.log('Created annotation with id: ' + annotationId)
        browser.url(WEBSITE_URL)
        resolve()
      })
    }))
  })

  it('Tool creates a popup using annotation', async function () {
    browser.call(() => new Promise((resolve) => {
      hypothesisClient.fetchAnnotation(annotationId, (response) => {
        expect(response.uri).toBe(WEBSITE_URL)
        resolve()
      })
    }))
  })

  afterAll(() => {
    browser.call(() => new Promise((resolve) => {
      hypothesisClient.deleteAnnotation(annotationId, () => {
        console.log('Deleted annotation ' + annotationId)
        resolve()
      })
    }))
  })
})
