import {
  buildSupportedXhttpExtra,
  validateXhttpDownloadSettingsRaw,
  validateXhttpFormFields,
  validateXhttpXmuxRaw,
} from './xhttp'

const DOWNLOAD_SETTINGS = JSON.stringify({
  address: 'download.example.com',
  port: 443,
  network: 'xhttp',
  security: 'tls',
  tlsSettings: {
    serverName: 'download.example.com',
    alpn: ['h2'],
    allowInsecure: true,
  },
  xhttpSettings: {
    host: 'download.example.com',
    path: '/down?ed=4096',
    xmux: {
      maxConnections: 4,
    },
  },
})

it('buildSupportedXhttpExtra emits only resident-supported xhttp extra fields', () => {
  expect(
    buildSupportedXhttpExtra({
      xhttpMode: 'packet-up',
      downloadSettingsRaw: DOWNLOAD_SETTINGS,
      xmuxRaw: '{"maxConcurrency":"-1","hMaxReusableSecs":"9-3"}',
    }),
  ).toBe(
    JSON.stringify({
      downloadSettings: JSON.parse(DOWNLOAD_SETTINGS),
      xmux: {
        maxConcurrency: '-1',
        hMaxReusableSecs: '9-3',
      },
    }),
  )
})

it('buildSupportedXhttpExtra drops downloadSettings for stream-one', () => {
  expect(
    buildSupportedXhttpExtra({
      xhttpMode: 'stream-one',
      downloadSettingsRaw: DOWNLOAD_SETTINGS,
      xmuxRaw: '{"maxConcurrency":1}',
    }),
  ).toBe(JSON.stringify({ xmux: { maxConcurrency: 1 } }))
})

it('buildSupportedXhttpExtra does not emit unsupported raw xhttp json', () => {
  expect(
    buildSupportedXhttpExtra({
      xhttpMode: 'packet-up',
      downloadSettingsRaw: '{"xPaddingBytes":"100-200"}',
      xmuxRaw: '{"hKeepAlivePeriod":15}',
    }),
  ).toBe('')
})

it('validateXhttpXmuxRaw accepts official signed and reversed ranges', () => {
  expect(
    validateXhttpXmuxRaw(
      JSON.stringify({
        maxConcurrency: '-1',
        cMaxReuseTimes: '',
        hMaxRequestTimes: '-5--3',
        hMaxReusableSecs: '9-3',
      }),
    ),
  ).toBeNull()
})

it('validateXhttpXmuxRaw blocks unsupported xmux fields and official conflicts', () => {
  expect(validateXhttpXmuxRaw('{"hKeepAlivePeriod":15}')).toContain('unsupported fields')
  expect(validateXhttpXmuxRaw('{"maxConcurrency":8,"maxConnections":2}')).toContain(
    'cannot set maxConnections together with maxConcurrency',
  )
})

it('validateXhttpDownloadSettingsRaw follows resident downloadSettings admission', () => {
  expect(validateXhttpDownloadSettingsRaw(DOWNLOAD_SETTINGS)).toBeNull()
  expect(validateXhttpDownloadSettingsRaw('{"xPaddingBytes":"100-200"}')).toContain('unsupported fields')
  expect(
    validateXhttpDownloadSettingsRaw(
      JSON.stringify({
        address: 'download.example.com',
        port: 443,
        network: 'xhttp',
        security: 'tls',
        xhttpSettings: {
          path: '/down',
          xmux: { maxConnections: 2 },
          extra: JSON.stringify({ xmux: { maxConnections: 4 } }),
        },
      }),
    ),
  ).toContain('cannot contain xmux in both xmux and extra.xmux')
})

it('validateXhttpFormFields hides stream-one downloadSettings instead of blocking hidden state', () => {
  expect(
    validateXhttpFormFields({
      xhttpMode: 'stream-one',
      downloadSettingsRaw: '{bad json',
      xmuxRaw: '',
      tls: 'tls',
      alpn: 'h2',
    }),
  ).toEqual([])
})

it('validateXhttpFormFields blocks unsupported xhttp alpn combinations', () => {
  expect(
    validateXhttpFormFields({
      xhttpMode: 'packet-up',
      downloadSettingsRaw: '',
      xmuxRaw: '',
      tls: 'reality',
      alpn: 'h3',
    }),
  ).toEqual([{ path: 'alpn', message: 'ALPN does not support h3 with Reality' }])
})
