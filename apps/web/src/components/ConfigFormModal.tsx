import type { ConfigGlobal, GlobalInput } from '~/apis/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Download, Upload } from 'lucide-react'
import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { z } from 'zod'
import { useCreateConfigMutation, useGeneralQuery, usePreviewConfigMutation, useUpdateConfigMutation } from '~/apis'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Dialog, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { InputList } from '~/components/ui/input-list'
import { Label } from '~/components/ui/label'
import { MultiSelect } from '~/components/ui/multi-select'
import { NumberInput } from '~/components/ui/number-input'
import { Radio, RadioGroup } from '~/components/ui/radio-group'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'
import { Select } from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'
import {
  DEFAULT_ALLOW_INSECURE,
  DEFAULT_AUTO_CONFIG_KERNEL_PARAMETER,
  DEFAULT_BANDWIDTH_MAX_RX,
  DEFAULT_BANDWIDTH_MAX_TX,
  DEFAULT_CHECK_INTERVAL_SECONDS,
  DEFAULT_CHECK_TOLERANCE_MS,
  DEFAULT_DIAL_MODE,
  DEFAULT_DISABLE_WAITING_NETWORK,
  DEFAULT_ENABLE_LOCAL_TCP_FAST_REDIRECT,
  DEFAULT_FALLBACK_RESOLVER,
  DEFAULT_MPTCP,
  DEFAULT_SNIFFING_TIMEOUT_MS,
  DEFAULT_SO_MARK_FROM_DAE,
  DEFAULT_TCP_CHECK_HTTP_METHOD,
  DEFAULT_TCP_CHECK_URL,
  DEFAULT_TLS_IMPLEMENTATION,
  DEFAULT_TPROXY_PORT,
  DEFAULT_TPROXY_PORT_PROTECT,
  DEFAULT_UDP_CHECK_DNS,
  DEFAULT_UTLS_IMITATE,
  DialMode,
  GET_LOG_LEVEL_STEPS,
  TcpCheckHttpMethod,
  TLSImplementation,
  UTLSImitate,
} from '~/constants'
import { useSetValue } from '~/hooks/useSetValue'
import { deriveTime } from '~/utils'

import { FormActions } from './FormActions'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  logLevelNumber: z.number().min(0).max(4),
  tproxyPort: z.number(),
  allowInsecure: z.boolean(),
  checkIntervalSeconds: z.number(),
  checkToleranceMS: z.number(),
  sniffingTimeoutMS: z.number(),
  lanInterface: z.array(z.string()),
  wanInterface: z.array(z.string()),
  udpCheckDns: z.array(z.string().min(1, 'Required')).min(1),
  tcpCheckUrl: z.array(z.string().min(1, 'Required')).min(1),
  dialMode: z.string(),
  tcpCheckHttpMethod: z.string(),
  disableWaitingNetwork: z.boolean(),
  autoConfigKernelParameter: z.boolean(),
  tlsImplementation: z.string(),
  utlsImitate: z.string(),
  tproxyPortProtect: z.boolean(),
  soMarkFromDae: z.number(),
  mptcp: z.boolean(),
  enableLocalTcpFastRedirect: z.boolean(),
  bandwidthMaxTx: z.string(),
  bandwidthMaxRx: z.string(),
  fallbackResolver: z.string(),
})

type FormValues = z.infer<typeof schema>

const defaultValues: FormValues = {
  name: '',
  mptcp: DEFAULT_MPTCP,
  enableLocalTcpFastRedirect: DEFAULT_ENABLE_LOCAL_TCP_FAST_REDIRECT,
  bandwidthMaxTx: DEFAULT_BANDWIDTH_MAX_TX,
  bandwidthMaxRx: DEFAULT_BANDWIDTH_MAX_RX,
  soMarkFromDae: DEFAULT_SO_MARK_FROM_DAE,
  logLevelNumber: 2,
  tproxyPort: DEFAULT_TPROXY_PORT,
  tproxyPortProtect: DEFAULT_TPROXY_PORT_PROTECT,
  allowInsecure: DEFAULT_ALLOW_INSECURE,
  checkIntervalSeconds: DEFAULT_CHECK_INTERVAL_SECONDS,
  checkToleranceMS: DEFAULT_CHECK_TOLERANCE_MS,
  sniffingTimeoutMS: DEFAULT_SNIFFING_TIMEOUT_MS,
  lanInterface: [],
  wanInterface: ['auto'],
  udpCheckDns: DEFAULT_UDP_CHECK_DNS,
  tcpCheckUrl: DEFAULT_TCP_CHECK_URL,
  dialMode: DEFAULT_DIAL_MODE,
  tcpCheckHttpMethod: DEFAULT_TCP_CHECK_HTTP_METHOD,
  disableWaitingNetwork: DEFAULT_DISABLE_WAITING_NETWORK,
  autoConfigKernelParameter: DEFAULT_AUTO_CONFIG_KERNEL_PARAMETER,
  tlsImplementation: DEFAULT_TLS_IMPLEMENTATION,
  utlsImitate: DEFAULT_UTLS_IMITATE,
  fallbackResolver: DEFAULT_FALLBACK_RESOLVER,
}

export interface ConfigFormModalRef {
  form: {
    setValues: (values: FormValues) => void
    reset: () => void
  }
  setEditingID: (id: string) => void
  initOrigins: (origins: ConfigFormOrigin) => void
}

interface ConfigFormOrigin {
  name: string
  rawGlobal: string
  parsedGlobal: ConfigGlobal | null
  parseError?: string | null
}

function toFormValues(global: ConfigGlobal, name: string, logLevelSteps: ReturnType<typeof GET_LOG_LEVEL_STEPS>): FormValues {
  const { checkInterval, checkTolerance, sniffingTimeout, logLevel, ...rest } = global
  const logLevelNumber = Math.max(
    logLevelSteps.findIndex(([, level]) => level === logLevel),
    0,
  )

  return {
    name,
    logLevelNumber,
    checkIntervalSeconds: deriveTime(checkInterval, 's'),
    checkToleranceMS: deriveTime(checkTolerance, 'ms'),
    sniffingTimeoutMS: deriveTime(sniffingTimeout, 'ms'),
    ...rest,
  }
}

function toGlobalInput(data: FormValues, logLevelSteps: ReturnType<typeof GET_LOG_LEVEL_STEPS>): GlobalInput {
  const { logLevelNumber, checkIntervalSeconds, checkToleranceMS, sniffingTimeoutMS, ...globalFields } = data
  return {
    logLevel: logLevelSteps[logLevelNumber][1],
    checkInterval: `${checkIntervalSeconds}s`,
    checkTolerance: `${checkToleranceMS}ms`,
    sniffingTimeout: `${sniffingTimeoutMS}ms`,
    ...globalFields,
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ConfigFormDrawer({
  ref,
  opened,
  onClose,
}: {
  ref?: React.Ref<ConfigFormModalRef>
  opened: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [editingID, setEditingID] = useState<string>()
  const [origins, setOrigins] = useState<ConfigFormOrigin>()
  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple')
  const [rawGlobal, setRawGlobal] = useState('')
  const [rawGlobalError, setRawGlobalError] = useState<string | null>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const {
    handleSubmit,
    setValue: setValueOriginal,
    reset,
    control,
    formState: { errors, isDirty: formIsDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'all',
  })

  const logLevelSteps = GET_LOG_LEVEL_STEPS(t)
  const setValue = useSetValue(setValueOriginal)
  const formValues = useWatch({ control })

  const createConfigMutation = useCreateConfigMutation()
  const updateConfigMutation = useUpdateConfigMutation()
  const previewConfigMutation = usePreviewConfigMutation()
  const isValid = Object.keys(errors).length === 0 && !rawGlobalError
  const isDirty =
    formIsDirty ||
    rawGlobal !== (origins?.rawGlobal ?? '') ||
    activeTab !== (origins?.parseError ? 'advanced' : 'simple')

  const initOrigins = useCallback(
    (nextOrigins: ConfigFormOrigin) => {
      setOrigins(nextOrigins)
      setRawGlobal(nextOrigins.rawGlobal)
      setRawGlobalError(nextOrigins.parseError ?? null)

      if (nextOrigins.parsedGlobal && !nextOrigins.parseError) {
        reset(toFormValues(nextOrigins.parsedGlobal, nextOrigins.name, logLevelSteps))
        setActiveTab('simple')
      } else {
        reset({ ...defaultValues, name: nextOrigins.name })
        setActiveTab('advanced')
      }
    },
    [logLevelSteps, reset],
  )

  const resetForm = useCallback(() => {
    reset(defaultValues)
    setActiveTab('simple')
    setRawGlobal('')
    setRawGlobalError(null)
  }, [reset])

  useImperativeHandle(ref, () => ({
    form: {
      setValues: (values: FormValues) => reset(values),
      reset: resetForm,
    },
    setEditingID,
    initOrigins,
  }))

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose()
        // Delay reset until after dialog close animation completes
        setTimeout(() => {
          resetForm()
          setEditingID(undefined)
          setOrigins(undefined)
        }, 200)
      }
    },
    [onClose, resetForm],
  )

  const { data: generalQuery } = useGeneralQuery()

  const wanInterfacesData = useMemo(() => {
    const interfaces = generalQuery?.general.interfaces

    if (interfaces) {
        return [
          { label: t('autoDetect'), value: 'auto' },
          ...interfaces
          .filter(({ defaultRoutes }: { defaultRoutes?: unknown }) => !!defaultRoutes)
          .map(({ name, addresses }: { name: string; addresses?: string[] | null }) => ({
            label: name,
            value: name,
            description: Array.isArray(addresses) && addresses.length > 0 ? addresses.join(', ') : undefined,
          })),
      ]
    }

    return []
  }, [generalQuery?.general.interfaces, t])

  const lanInterfacesData = useMemo(() => {
    const interfaces = generalQuery?.general.interfaces

    if (interfaces) {
      return interfaces.map(({ name, addresses }: { name: string; addresses?: string[] | null }) => ({
        label: name,
        value: name,
        description: Array.isArray(addresses) && addresses.length > 0 ? addresses.join(', ') : undefined,
      }))
    }

    return []
  }, [generalQuery?.general.interfaces])

  const onSubmit = async (data: FormValues) => {
    setRawGlobalError(null)

    try {
      if (editingID) {
        await updateConfigMutation.mutateAsync(
          activeTab === 'advanced'
            ? {
                id: editingID,
                global: rawGlobal,
              }
            : {
                id: editingID,
                parsedGlobal: toGlobalInput(data, logLevelSteps),
              },
        )
      } else {
        await createConfigMutation.mutateAsync(
          activeTab === 'advanced'
            ? {
                name: data.name,
                global: rawGlobal,
              }
            : {
                name: data.name,
                parsedGlobal: toGlobalInput(data, logLevelSteps),
              },
        )
      }

      handleOpenChange(false)
    } catch (error) {
      setRawGlobalError(errorMessage(error, t('configEditor.switchToStructuredError')))
    }
  }

  const handleModeChange = useCallback(
    async (nextTab: 'simple' | 'advanced') => {
      if (nextTab === activeTab) {
        return
      }
      setRawGlobalError(null)

      try {
        if (nextTab === 'advanced') {
          const preview = await previewConfigMutation.mutateAsync({
            parsedGlobal: toGlobalInput(formValues as FormValues, logLevelSteps),
          })
          setRawGlobal(preview.global)
          setActiveTab('advanced')
          return
        }

        const preview = await previewConfigMutation.mutateAsync({ global: rawGlobal })
        reset(toFormValues(preview.parsedGlobal, formValues.name || '', logLevelSteps))
        setRawGlobal(preview.global)
        setActiveTab('simple')
      } catch (error) {
        setRawGlobalError(errorMessage(error, t('configEditor.switchToStructuredError')))
      }
    },
    [activeTab, formValues, logLevelSteps, previewConfigMutation, rawGlobal, reset, t],
  )

  const handleImportConfig = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const text = await file.text()
    setRawGlobal(text)
    setRawGlobalError(null)
    setActiveTab('advanced')
    if (!editingID && !(formValues.name ?? '').trim()) {
      setValue('name', file.name.replace(/\.[^.]+$/, ''))
    }
    event.target.value = ''
  }, [editingID, formValues.name, setValue])

  const handleExportConfig = useCallback(async () => {
    try {
      setRawGlobalError(null)
      let content = rawGlobal
      if (activeTab === 'simple') {
        const preview = await previewConfigMutation.mutateAsync({
          parsedGlobal: toGlobalInput(formValues as FormValues, logLevelSteps),
        })
        content = preview.global
        setRawGlobal(preview.global)
      }
      downloadTextFile(`${(formValues.name || 'config').trim() || 'config'}.dae`, content)
    } catch (error) {
      setRawGlobalError(errorMessage(error, t('configEditor.switchToStructuredError')))
    }
  }, [activeTab, formValues, logLevelSteps, previewConfigMutation, rawGlobal, t])

  return (
    <Dialog open={opened} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent size="lg">
        <ScrollableDialogHeader>
          <DialogTitle>{t('config')}</DialogTitle>
        </ScrollableDialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <ScrollableDialogBody className="flex-1">
            <div className="space-y-4">
              <Input
                label={t('name')}
                withAsterisk
                value={formValues.name}
                onChange={(e) => setValue('name', e.target.value)}
                error={errors.name?.message}
                disabled={!!editingID}
              />

              <Tabs value={activeTab} onValueChange={(value) => void handleModeChange(value as 'simple' | 'advanced')}>
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="simple">{t('configEditor.simpleMode')}</TabsTrigger>
                  <TabsTrigger value="advanced">{t('configEditor.advancedMode')}</TabsTrigger>
                </TabsList>

                <TabsContent value="simple" className="space-y-4 pt-4">
                  <Accordion
                    type="multiple"
                    defaultValue={[
                      'software-options',
                      'interface-and-kernel-options',
                      'node-connectivity-check',
                      'connecting-options',
                    ]}
                    className="w-full"
                  >
                    <AccordionItem value="software-options">
                      <AccordionTrigger>
                        <h4 className="text-sm font-semibold">{t('software options')}</h4>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <NumberInput
                            label={t('tproxyPort')}
                            description={t('descriptions.config.tproxyPort')}
                            withAsterisk
                            min={0}
                            max={65535}
                            value={formValues.tproxyPort}
                            onChange={(val) => setValue('tproxyPort', Number(val))}
                          />

                          <Checkbox
                            label={t('tproxyPortProtect')}
                            description={t('descriptions.config.tproxyPortProtect')}
                            checked={formValues.tproxyPortProtect}
                            onCheckedChange={(checked) => setValue('tproxyPortProtect', !!checked)}
                          />

                          <NumberInput
                            label={t('soMarkFromDae')}
                            description={t('descriptions.config.soMarkFromDae')}
                            withAsterisk
                            min={0}
                            max={2 ** 32 - 1}
                            value={formValues.soMarkFromDae}
                            onChange={(val) => setValue('soMarkFromDae', Number(val))}
                          />

                          <div className="space-y-2">
                            <Label>{t('logLevel')}</Label>
                            <Select
                              data={logLevelSteps.map(([label], value) => ({ label, value: String(value) }))}
                              value={String(formValues.logLevelNumber)}
                              onChange={(val) => setValue('logLevelNumber', Number(val))}
                            />
                          </div>

                          <Checkbox
                            label={t('disableWaitingNetwork')}
                            description={t('descriptions.config.disableWaitingNetwork')}
                            checked={formValues.disableWaitingNetwork}
                            onCheckedChange={(checked) => setValue('disableWaitingNetwork', !!checked)}
                          />

                          <Checkbox
                            label={t('enableLocalTcpFastRedirect')}
                            checked={formValues.enableLocalTcpFastRedirect}
                            onCheckedChange={(checked) => setValue('enableLocalTcpFastRedirect', !!checked)}
                          />

                          <Checkbox
                            label={t('mptcp')}
                            checked={formValues.mptcp}
                            onCheckedChange={(checked) => setValue('mptcp', !!checked)}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="interface-and-kernel-options">
                      <AccordionTrigger>
                        <h4 className="text-sm font-semibold">{t('interface and kernel options')}</h4>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <MultiSelect
                            label={t('lanInterface')}
                            description={t('descriptions.config.lanInterface')}
                            data={lanInterfacesData}
                            values={formValues.lanInterface || []}
                            onChange={(vals) => setValue('lanInterface', vals)}
                          />

                          <MultiSelect
                            label={t('wanInterface')}
                            description={t('descriptions.config.wanInterface')}
                            data={wanInterfacesData}
                            values={formValues.wanInterface || []}
                            onChange={(vals) => setValue('wanInterface', vals)}
                          />

                          <Checkbox
                            label={t('autoConfigKernelParameter')}
                            description={t('descriptions.config.autoConfigKernelParameter')}
                            checked={formValues.autoConfigKernelParameter}
                            onCheckedChange={(checked) => setValue('autoConfigKernelParameter', !!checked)}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="node-connectivity-check">
                      <AccordionTrigger>
                        <h4 className="text-sm font-semibold">{t('node connectivity check')}</h4>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <InputList
                            label={t('tcpCheckUrl')}
                            description={t('descriptions.config.tcpCheckUrl')}
                            values={formValues.tcpCheckUrl || []}
                            onChange={(vals) => setValue('tcpCheckUrl', vals)}
                          />

                          <Select
                            label={t('tcpCheckHttpMethod')}
                            description={t('descriptions.config.tcpCheckHttpMethod')}
                            data={Object.values(TcpCheckHttpMethod).map((method) => ({ label: method, value: method }))}
                            value={formValues.tcpCheckHttpMethod}
                            onChange={(val) => setValue('tcpCheckHttpMethod', val || '')}
                          />

                          <InputList
                            label={t('udpCheckDns')}
                            description={t('descriptions.config.udpCheckDns')}
                            values={formValues.udpCheckDns || []}
                            onChange={(vals) => setValue('udpCheckDns', vals)}
                            errors={(formValues.udpCheckDns || []).map((v) =>
                              v.trim() === '' ? t('form.required') : undefined,
                            )}
                          />

                          <Input
                            label={t('fallbackResolver')}
                            description={t('descriptions.config.fallbackResolver')}
                            value={formValues.fallbackResolver}
                            onChange={(e) => setValue('fallbackResolver', e.target.value)}
                          />

                          <NumberInput
                            label={`${t('checkInterval')} (s)`}
                            withAsterisk
                            value={formValues.checkIntervalSeconds}
                            onChange={(val) => setValue('checkIntervalSeconds', Number(val))}
                          />

                          <NumberInput
                            label={`${t('checkTolerance')} (ms)`}
                            description={t('descriptions.config.checkTolerance')}
                            withAsterisk
                            step={500}
                            value={formValues.checkToleranceMS}
                            onChange={(val) => setValue('checkToleranceMS', Number(val))}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="connecting-options">
                      <AccordionTrigger>
                        <h4 className="text-sm font-semibold">{t('connecting options')}</h4>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <RadioGroup
                            label={t('dialMode')}
                            value={formValues.dialMode}
                            onChange={(val) => setValue('dialMode', val)}
                          >
                            <Radio
                              value={DialMode.ip}
                              label={DialMode.ip}
                              description={t('descriptions.config.dialMode.ip')}
                            />
                            <Radio
                              value={DialMode.domain}
                              label={DialMode.domain}
                              description={t('descriptions.config.dialMode.domain')}
                            />
                            <Radio
                              value={DialMode.domainP}
                              label={DialMode.domainP}
                              description={t('descriptions.config.dialMode.domain+')}
                            />
                            <Radio
                              value={DialMode.domainPP}
                              label={DialMode.domainPP}
                              description={t('descriptions.config.dialMode.domain++')}
                            />
                          </RadioGroup>

                          <Checkbox
                            label={t('allowInsecure')}
                            description={t('descriptions.config.allowInsecure')}
                            checked={formValues.allowInsecure}
                            onCheckedChange={(checked) => setValue('allowInsecure', !!checked)}
                          />

                          <NumberInput
                            label={`${t('sniffingTimeout')} (ms)`}
                            description={t('descriptions.config.sniffingTimeout')}
                            step={500}
                            value={formValues.sniffingTimeoutMS}
                            onChange={(val) => setValue('sniffingTimeoutMS', Number(val))}
                          />

                          <Select
                            label={t('tlsImplementation')}
                            description={t('descriptions.config.tlsImplementation')}
                            data={Object.values(TLSImplementation).map((impl) => ({ label: impl, value: impl }))}
                            value={formValues.tlsImplementation}
                            onChange={(val) => setValue('tlsImplementation', val || '')}
                          />

                          {formValues.tlsImplementation === TLSImplementation.utls && (
                            <Select
                              label={t('utlsImitate')}
                              description={t('descriptions.config.utlsImitate')}
                              data={Object.values(UTLSImitate).map((impl) => ({ label: impl, value: impl }))}
                              value={formValues.utlsImitate}
                              onChange={(val) => setValue('utlsImitate', val || '')}
                            />
                          )}

                          <Input
                            label={t('bandwidthMaxTx')}
                            description={t('descriptions.config.bandwidthMaxTx')}
                            value={formValues.bandwidthMaxTx}
                            onChange={(e) => setValue('bandwidthMaxTx', e.target.value)}
                          />

                          <Input
                            label={t('bandwidthMaxRx')}
                            description={t('descriptions.config.bandwidthMaxRx')}
                            value={formValues.bandwidthMaxRx}
                            onChange={(e) => setValue('bandwidthMaxRx', e.target.value)}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 pt-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('configEditor.advancedMode')}</AlertTitle>
                    <AlertDescription>{t('configEditor.advancedDesc')}</AlertDescription>
                  </Alert>

                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept=".dae,.conf,.txt"
                      className="hidden"
                      onChange={handleImportConfig}
                    />
                    <Button type="button" variant="outline" onClick={() => importFileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('actions.import')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleExportConfig()}>
                      <Download className="mr-2 h-4 w-4" />
                      {t('actions.save dae')}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t('configEditor.importDesc')} {t('configEditor.exportDesc')}
                  </p>

                  <div className="space-y-2">
                    <Label>{t('configEditor.rawLabel')}</Label>
                    <Textarea
                      value={rawGlobal}
                      onChange={(event) => {
                        setRawGlobal(event.target.value)
                        if (rawGlobalError) {
                          setRawGlobalError(null)
                        }
                      }}
                      className="min-h-[420px] font-mono text-sm"
                      spellCheck={false}
                    />
                  </div>

                  {rawGlobalError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('configEditor.parseErrorTitle')}</AlertTitle>
                      <AlertDescription>{rawGlobalError}</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollableDialogBody>
          <ScrollableDialogFooter>
            <FormActions
              reset={() => {
                if (editingID && origins) {
                  initOrigins(origins)
                } else {
                  resetForm()
                }
              }}
              isDirty={isDirty}
              isValid={isValid}
              errors={errors}
              loading={createConfigMutation.isPending || updateConfigMutation.isPending || previewConfigMutation.isPending}
            />
          </ScrollableDialogFooter>
        </form>
      </ScrollableDialogContent>
    </Dialog>
  )
}
