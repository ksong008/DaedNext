import {
  buildSupportedXhttpExtra,
  validateXhttpDownloadSettingsRaw,
  validateXhttpExtraRaw,
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
    echConfigList: 'AD7+DQA6AAAgACC7Lynj4wV+BBnVL8X0QRh3b422HOpP33YHm5NgbFpiSAAIAAEAAQABAAMAB2VjaC5jb20AAA==',
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
      xhttpExtra: JSON.stringify({
        headers: { 'X-Test': '1' },
        xPaddingBytes: '100-200',
        xPaddingObfsMode: true,
        xPaddingPlacement: 'header',
        xPaddingMethod: 'tokenish',
        uplinkHTTPMethod: 'GET',
        sessionIDPlacement: 'header',
        sessionIDKey: 'X-Session',
        sessionIDTable: 'Base62',
        sessionIDLength: { from: 8, to: 12 },
        seqPlacement: 'query',
        noGRPCHeader: true,
        scStreamUpServerSecs: '20-30',
        serverMaxHeaderBytes: 8192,
      }),
      downloadSettingsRaw: DOWNLOAD_SETTINGS,
      xmuxRaw: '{"maxConcurrency":"-1","hMaxReusableSecs":"9-3","hKeepAlivePeriod":15}',
    }),
  ).toBe(
    JSON.stringify({
      headers: { 'X-Test': '1' },
      xPaddingBytes: '100-200',
      xPaddingObfsMode: true,
      xPaddingPlacement: 'header',
      xPaddingMethod: 'tokenish',
      uplinkHTTPMethod: 'GET',
      sessionIDPlacement: 'header',
      sessionIDKey: 'X-Session',
      sessionIDTable: 'Base62',
      sessionIDLength: { from: 8, to: 12 },
      seqPlacement: 'query',
      noGRPCHeader: true,
      scStreamUpServerSecs: '20-30',
      serverMaxHeaderBytes: 8192,
      downloadSettings: JSON.parse(DOWNLOAD_SETTINGS),
      xmux: {
        maxConcurrency: '-1',
        hMaxReusableSecs: '9-3',
        hKeepAlivePeriod: 15,
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
      xhttpExtra: '{"unknown":true}',
      downloadSettingsRaw: '{"xPaddingBytes":"100-200"}',
      xmuxRaw: '{"unsupported":15}',
    }),
  ).toBe('')
})

it('validateXhttpXmuxRaw accepts official signed ranges and hKeepAlivePeriod', () => {
  expect(
    validateXhttpXmuxRaw(
      JSON.stringify({
        maxConcurrency: '-1',
        cMaxReuseTimes: '',
        hMaxRequestTimes: '-5--3',
        hMaxReusableSecs: '9-3',
        hKeepAlivePeriod: '15',
      }),
    ),
  ).toBeNull()
})

it('validateXhttpDownloadSettingsRaw rejects non-standard ECHConfigList encoding', () => {
  const download = JSON.parse(DOWNLOAD_SETTINGS)
  download.tlsSettings.echConfigList = 'AA-_'

  expect(validateXhttpDownloadSettingsRaw(JSON.stringify(download))).toContain('padded standard Base64')
})

it('validateXhttpXmuxRaw blocks unsupported xmux fields and official conflicts', () => {
  expect(validateXhttpXmuxRaw('{"unsupported":15}')).toContain('unsupported fields')
  expect(validateXhttpXmuxRaw('{"maxConcurrency":8,"maxConnections":2}')).toContain(
    'cannot set maxConnections together with maxConcurrency',
  )
})

it('validateXhttpExtraRaw follows resident extended settings admission', () => {
  expect(
    validateXhttpExtraRaw(
      JSON.stringify({
        headers: { 'X-Test': '1' },
        xPaddingBytes: '1-2',
        sessionIDPlacement: 'cookie',
        sessionIDKey: 'x_session',
        seqPlacement: 'query',
        uplinkDataPlacement: 'header',
        noGRPCHeader: true,
        noSSEHeader: true,
        scMaxEachPostBytes: { from: 1024, to: 2048 },
        scMinPostsIntervalMs: '10-20',
        scMaxBufferedPosts: '3',
        scStreamUpServerSecs: '20-30',
        serverMaxHeaderBytes: 8192,
        xmux: { hKeepAlivePeriod: 15 },
      }),
    ),
  ).toBeNull()
  expect(validateXhttpExtraRaw('{"sessionPlacement":"header"}')).toContain('unsupported fields')
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
        tlsSettings: {
          serverName: 'download.example.com',
          alpn: ['h3'],
          fingerprint: 'chrome',
        },
        xhttpSettings: {
          path: '/down',
          xPaddingBytes: '1-2',
          sessionIDPlacement: 'header',
          seqPlacement: 'query',
          noGRPCHeader: true,
          xmux: { maxConnections: 2 },
          extra: JSON.stringify({ xmux: { maxConnections: 4 } }),
        },
      }),
    ),
  ).toBeNull()
  expect(
    validateXhttpDownloadSettingsRaw(
      JSON.stringify({
        address: 'download.example.com',
        port: 443,
        network: 'xhttp',
        security: 'reality',
        realitySettings: {
          serverName: 'download.example.com',
          alpn: ['h2'],
          fingerprint: 'chrome',
          publicKey: 'public-key',
          shortId: 'abcd',
          spiderX: '/',
          mldsa65Verify: 'mldsa65-public-key',
        },
        xhttpSettings: {
          path: '/down',
        },
      }),
    ),
  ).toBeNull()
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
