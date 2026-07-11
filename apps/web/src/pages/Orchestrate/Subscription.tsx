import type { NodeLatencyProbeResult } from '~/apis'
import type { SubscriptionListView } from '~/apis/types'
import type { QRCodeModalRef } from '~/components/QRCodeModal'
import { Droppable } from '@hello-pangea/dnd'
import dayjs from 'dayjs'
import { CloudCog, CloudUpload, Download, Eye, Gauge, Pencil } from 'lucide-react'
import { Fragment, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useImportSubscriptionsMutation,
  useRemoveSubscriptionsMutation,
  useSubscriptionsQuery,
  useTagSubscriptionMutation,
  useUpdateSubscriptionCronMutation,
  useUpdateSubscriptionLinkMutation,
  useUpdateSubscriptionsMutation,
  useUpdateSubscriptionUseProxyMutation,
} from '~/apis'
import { DraggableResourceBadge } from '~/components/DraggableResourceBadge'
import { EditSubscriptionFormModal } from '~/components/EditSubscriptionFormModal'
import { ImportResourceFormModal } from '~/components/ImportResourceFormModal'
import { QRCodeModal } from '~/components/QRCodeModal'
import { Section } from '~/components/Section'
import { SortableSubscriptionCard } from '~/components/SortableSubscriptionCard'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { SimpleTooltip } from '~/components/ui/tooltip'
import { UpdateSubscriptionAction } from '~/components/UpdateSubscriptionAction'
import { useDisclosure } from '~/hooks'
import { cn } from '~/lib/utils'
import { formatNodeLatencyCardLabel, getNodeLatencyCardTone } from '~/utils/node_display'

export function SubscriptionResource({
  sortedSubscriptions,
  nodeLatencies,
  testingLatencies,
  testingLatencyProgress,
  lastLatencyProbeAt,
  onTestAllNodeLatencies,
}: {
  sortedSubscriptions: SubscriptionListView['subscriptions']
  nodeLatencies?: Record<string, NodeLatencyProbeResult>
  testingLatencies?: boolean
  testingLatencyProgress?: { completed: number; total: number } | null
  lastLatencyProbeAt?: string | null
  onTestAllNodeLatencies: () => Promise<void>
}) {
  const { t } = useTranslation()

  const [openedQRCodeModal, { open: openQRCodeModal, close: closeQRCodeModal }] = useDisclosure(false)
  const [
    openedImportSubscriptionFormModal,
    { open: openImportSubscriptionFormModal, close: closeImportSubscriptionFormModal },
  ] = useDisclosure(false)
  const [
    openedEditSubscriptionFormModal,
    { open: openEditSubscriptionFormModal, close: closeEditSubscriptionFormModal },
  ] = useDisclosure(false)
  const [editingSubscription, setEditingSubscription] = useState<{
    id: string
    link: string
    tag: string
    cronExp: string
    cronEnable: boolean
    useProxy: boolean
  }>()
  const qrCodeModalRef = useRef<QRCodeModalRef>(null)
  const { refetch: refetchSubscriptions } = useSubscriptionsQuery()
  const removeSubscriptionsMutation = useRemoveSubscriptionsMutation()
  const importSubscriptionsMutation = useImportSubscriptionsMutation()
  const updateSubscriptionsMutation = useUpdateSubscriptionsMutation()
  const updateSubscriptionLinkMutation = useUpdateSubscriptionLinkMutation()
  const tagSubscriptionMutation = useTagSubscriptionMutation()

  const updateSubscriptionCronMutation = useUpdateSubscriptionCronMutation()
  const updateSubscriptionUseProxyMutation = useUpdateSubscriptionUseProxyMutation()
  const measuredNodeCount = Object.keys(nodeLatencies || {}).length
  const latencyActionStatus = testingLatencyProgress
    ? `${testingLatencyProgress.completed}/${testingLatencyProgress.total}`
    : lastLatencyProbeAt
      ? `${t('latency.lastTested', { time: dayjs(lastLatencyProbeAt).format('HH:mm:ss') })} · ${t('latency.nodesMeasured', { count: measuredNodeCount })}`
      : undefined

  return (
    <Section
      title={t('subscription')}
      icon={<CloudCog className="h-5 w-5" />}
      iconPlus={<CloudUpload className="h-4 w-4" />}
      onCreate={openImportSubscriptionFormModal}
      bordered
      actions={
        <Fragment>
          {sortedSubscriptions.length > 0 && (
            <div className="flex items-center gap-2">
              {latencyActionStatus && (
                <span className="hidden max-w-[18rem] truncate text-right text-xs font-medium leading-none text-muted-foreground sm:inline-block">
                  {latencyActionStatus}
                </span>
              )}
              {testingLatencyProgress && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {testingLatencyProgress.completed}/{testingLatencyProgress.total}
                </span>
              )}
              <SimpleTooltip label={t('latency.testAllNodes')}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void onTestAllNodeLatencies()
                  }}
                  loading={testingLatencies}
                >
                  <Gauge className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            </div>
          )}
          {sortedSubscriptions.length > 2 && (
            <SimpleTooltip label={t('actions.updateAll')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  updateSubscriptionsMutation.mutate(sortedSubscriptions.map(({ id }) => id))
                }}
                loading={updateSubscriptionsMutation.isPending}
              >
                <Download className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          )}
        </Fragment>
      }
    >
      {latencyActionStatus && (
        <div className="-mt-1 flex justify-center px-1 sm:hidden">
          <span className="max-w-full truncate text-center text-[11px] font-medium leading-none text-muted-foreground sm:text-xs">
            {latencyActionStatus}
          </span>
        </div>
      )}
      <Droppable droppableId="subscription-list" type="SUBSCRIPTION">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex max-h-[min(760px,calc(100vh-16rem))] min-h-[100px] flex-col gap-3 overflow-y-auto overscroll-contain pr-1',
              snapshot.isDraggingOver && 'bg-primary/5 rounded-lg',
            )}
          >
            {sortedSubscriptions.map(
              ({ id: subscriptionID, tag, link, updatedAt, cronExp, cronEnable, useProxy, nodes }, index) => (
                <SortableSubscriptionCard
                  key={subscriptionID}
                  id={`subscription-${subscriptionID}`}
                  index={index}
                  name={tag || link}
                  leftSection={`${nodes.items.length} ${t('node')}`}
                  actions={
                    <Fragment>
                      <SimpleTooltip label={t('actions.edit')}>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingSubscription({
                              id: subscriptionID,
                              link,
                              tag: tag || '',
                              cronExp,
                              cronEnable,
                              useProxy,
                            })
                            openEditSubscriptionFormModal()
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </SimpleTooltip>
                      <SimpleTooltip label={t('actions.viewQRCode')}>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            qrCodeModalRef.current?.setProps({
                              name: tag!,
                              link,
                            })
                            openQRCodeModal()
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </SimpleTooltip>
                      <UpdateSubscriptionAction id={subscriptionID} loading={updateSubscriptionsMutation.isPending} />
                    </Fragment>
                  }
                  onRemove={() => removeSubscriptionsMutation.mutate([subscriptionID])}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
                    <span>{dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                    {cronEnable && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <span>⏱</span>
                        <span>{cronExp}</span>
                      </span>
                    )}
                    {useProxy && (
                      <span className="inline-flex items-center rounded-full border border-primary/25 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        {t('useProxySubscription')}
                      </span>
                    )}
                  </div>

                  <Spoiler label={link} showLabel={t('actions.show sensitive')} hideLabel={t('actions.hide')} />

                  <Accordion type="single" collapsible className="w-full mt-2">
                    <AccordionItem value="node" className="border-none">
                      <AccordionTrigger className="text-xs py-1 hover:no-underline">
                        {t('actions.show content')}
                      </AccordionTrigger>
                      <AccordionContent>
                        <Droppable droppableId={`subscription-${subscriptionID}-nodes`} type="NODE" isDropDisabled>
                          {(droppableProvided) => (
                            <div
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                              className="flex flex-wrap gap-2 pt-2"
                            >
                              {nodes.items.map(({ id, name, protocol, transport }, nodeIndex) => {
                                const latencyResult = nodeLatencies?.[id]

                                return (
                                  <DraggableResourceBadge
                                    key={id}
                                    id={`subscription-node-${id}`}
                                    index={nodeIndex}
                                    name={name}
                                    protocol={protocol}
                                    transport={transport}
                                    meta={formatLatencyMeta(latencyResult)}
                                    metaTone={getNodeLatencyCardTone(latencyResult)}
                                  >
                                    {name}
                                  </DraggableResourceBadge>
                                )
                              })}
                              {droppableProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </SortableSubscriptionCard>
              ),
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <QRCodeModal ref={qrCodeModalRef} opened={openedQRCodeModal} onClose={closeQRCodeModal} />

      <ImportResourceFormModal
        title={t('subscription')}
        opened={openedImportSubscriptionFormModal}
        onClose={closeImportSubscriptionFormModal}
        showUseProxySubscription
        handleSubmit={async (values) => {
          return importSubscriptionsMutation.mutateAsync(
            values.resources.map(({ link, tag }) => ({ link, tag, useProxy: values.useProxySubscription })),
          )
        }}
      />

      <EditSubscriptionFormModal
        opened={openedEditSubscriptionFormModal}
        onClose={closeEditSubscriptionFormModal}
        subscription={editingSubscription}
        onSubmit={async (values) => {
          // Update subscription link if changed
          if (values.link !== editingSubscription?.link) {
            await updateSubscriptionLinkMutation.mutateAsync({
              id: values.id,
              link: values.link,
            })
          }

          // Update subscription tag if changed
          if (values.tag !== editingSubscription?.tag) {
            await tagSubscriptionMutation.mutateAsync({
              id: values.id,
              tag: values.tag,
            })
          }

          // Update subscription cron if changed
          if (
            values.cronExp !== editingSubscription?.cronExp ||
            values.cronEnable !== editingSubscription?.cronEnable
          ) {
            await updateSubscriptionCronMutation.mutateAsync({
              id: values.id,
              cronExp: values.cronExp,
              cronEnable: values.cronEnable,
            })
          }

          if (values.useProxy !== editingSubscription?.useProxy) {
            await updateSubscriptionUseProxyMutation.mutateAsync({
              id: values.id,
              useProxy: values.useProxy,
            })
          }

          await refetchSubscriptions()
          closeEditSubscriptionFormModal()
        }}
      />
    </Section>
  )
}

function formatLatencyMeta(result?: NodeLatencyProbeResult) {
  if (!result) {
    return undefined
  }
  return formatNodeLatencyCardLabel(result, 'N/A')
}

function Spoiler({ label, showLabel, hideLabel }: { label: string; showLabel: string; hideLabel: string }) {
  const [show, setShow] = useState(false)

  return (
    <div>
      {show && <p className="text-sm break-all">{label}</p>}
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShow(!show)}>
        {show ? hideLabel : showLabel}
      </button>
    </div>
  )
}
