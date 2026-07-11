import type { DNSConfig } from './types'
import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { DaeEditor } from '~/components/DaeEditor'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  createDNSFormDocument,
  editDNSFormDocumentCode,
  updateDNSFormDocumentFromCode,
  updateDNSFormDocumentFromSimple,
} from './document'
import { RoutingList } from './RoutingList'
import { UpstreamList } from './UpstreamList'

interface Props {
  initialName?: string
  initialConfig?: string
  bindGetValues: (fn: () => { name: string; text: string }) => void
  opened?: boolean
}

export function DNSForm({ initialName = '', initialConfig = '', bindGetValues, opened = true }: Props) {
  const { t } = useTranslation()
  const [initialDocument] = useState(() => createDNSFormDocument(initialConfig))

  const [name, setName] = useState(() => initialName)
  const [mode, setMode] = useState<'simple' | 'code'>(() => initialDocument.mode)
  const [document, setDocument] = useState(() => initialDocument.document)
  const [modeError, setModeError] = useState<Error | null>(() => initialDocument.error ?? null)
  const { parsed: parsedConfig, text: configStr } = document

  const setParsedConfig = (parsed: DNSConfig) => {
    setDocument(updateDNSFormDocumentFromSimple(parsed))
    setModeError(null)
  }

  // Expose values getter
  useEffect(() => {
    bindGetValues(() => {
      return { name, text: document.text }
    })
  }, [bindGetValues, document.text, name])

  const handleModeChange = (newMode: 'simple' | 'code') => {
    if (newMode === mode) return
    if (mode === 'code' && newMode === 'simple') {
      const synchronized = updateDNSFormDocumentFromCode(document)
      if (!synchronized.ok) {
        setModeError(synchronized.error)
        return
      }
      setDocument(synchronized.document)
    }

    setModeError(null)
    setMode(newMode)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t('dnsConfig.name')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dnsConfig.name')} />
      </div>

      <Tabs value={mode} onValueChange={(v) => handleModeChange(v as 'simple' | 'code')}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="simple">{t('actions.simple mode')}</TabsTrigger>
          <TabsTrigger value="code">{t('actions.advanced mode')}</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-8 pt-2">
          <UpstreamList
            upstreams={parsedConfig.upstreams}
            onChange={(upstreams) => setParsedConfig({ ...parsedConfig, upstreams })}
          />

          <div className="border-t pt-4">
            <RoutingList
              type="request"
              rules={parsedConfig.requestRules}
              upstreams={parsedConfig.upstreams}
              onChange={(requestRules) => setParsedConfig({ ...parsedConfig, requestRules })}
            />
          </div>

          <div className="border-t pt-4">
            <RoutingList
              type="response"
              rules={parsedConfig.responseRules}
              upstreams={parsedConfig.upstreams}
              onChange={(responseRules) => setParsedConfig({ ...parsedConfig, responseRules })}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t('dnsConfig.simpleNote')}</p>

          {parsedConfig.others && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('dnsConfig.unparsedTitle')}</AlertTitle>
              <AlertDescription>{t('dnsConfig.unparsedDesc')}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="code" className="flex flex-col gap-1 pt-2">
          {modeError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('dnsConfig.parseErrorTitle')}</AlertTitle>
              <AlertDescription>{t('dnsConfig.parseErrorDesc', { error: modeError.message })}</AlertDescription>
            </Alert>
          )}
          <div className="rounded border h-[400px] relative">
            <DaeEditor
              value={configStr || ''}
              onChange={(value) => {
                setDocument((current) => editDNSFormDocumentCode(current, value))
                setModeError(null)
              }}
              configType="dns"
              height="400px"
              active={opened && mode === 'code'}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
