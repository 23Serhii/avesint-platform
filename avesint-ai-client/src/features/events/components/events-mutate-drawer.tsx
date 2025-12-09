import { useEffect } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  eventSeverities,
  eventStatuses,
  eventTypes,
  type Event,
} from '../data/schema'
import { createEvent, updateEvent } from '@/lib/api/events'
import { useEvents } from './events-provider'

// 🔹 схема максимально проста для форми
const formSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  summary: z.string().optional(),
  type: z.string().min(1, 'Select event type.'),
  severity: z.string().min(1, 'Select severity.'),
  status: z.string().min(1, 'Select status.'),
  confidence: z.number().min(0).max(1).optional(),
  latitude: z.string().optional(),   // string у формі
  longitude: z.string().optional(),  // string у формі
  occurredAt: z.string().min(1, 'Occurred at is required.'),
})

type EventFormValues = z.infer<typeof formSchema>

type EventsMutateDrawerProps = {
  mode: 'create' | 'update'
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Event | null
}

const DEFAULT_VALUES: EventFormValues = {
  title: '',
  summary: '',
  type: 'other',
  severity: 'medium',
  status: 'new',
  confidence: 0.6,
  latitude: '',
  longitude: '',
  occurredAt: new Date().toISOString(),
}

export function EventsMutateDrawer({
                                     mode,
                                     open,
                                     onOpenChange,
                                     currentRow,
                                   }: EventsMutateDrawerProps) {
  const queryClient = useQueryClient()
  const { setCurrentRow, setOpen } = useEvents()

  const form = useForm<EventFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  })

  // заповнюємо форму при відкритті
  useEffect(() => {
    if (!open) return

    if (mode === 'update' && currentRow) {
      form.reset({
        title: currentRow.title,
        summary: currentRow.summary ?? '',
        type: currentRow.type,
        severity: currentRow.severity,
        status: currentRow.status,
        confidence: currentRow.confidence ?? 0.6,
        latitude:
          currentRow.latitude !== null && currentRow.latitude !== undefined
            ? String(currentRow.latitude)
            : '',
        longitude:
          currentRow.longitude !== null && currentRow.longitude !== undefined
            ? String(currentRow.longitude)
            : '',
        occurredAt: currentRow.occurredAt,
      })
      return
    }

    if (mode === 'create') {
      form.reset({
        ...DEFAULT_VALUES,
        occurredAt: new Date().toISOString(),
      })
    }
  }, [mode, currentRow, open, form])

  const onSubmit: SubmitHandler<EventFormValues> = async (values) => {
    const lat = values.latitude?.trim()
    const lng = values.longitude?.trim()

    const payload: Partial<Event> = {
      title: values.title,
      summary: values.summary,
      type: values.type as never,
      severity: values.severity as never,
      status: values.status as never,
      confidence: values.confidence,
      latitude: lat ? Number(lat) : null,
      longitude: lng ? Number(lng) : null,
      occurredAt: values.occurredAt,
    }

    if (mode === 'create') {
      await createEvent(payload)
    } else if (mode === 'update' && currentRow) {
      await updateEvent(currentRow.id, payload)
    }

    await queryClient.invalidateQueries({ queryKey: ['events'] })
    setCurrentRow(null)
    setOpen(null)
  }

  const title = mode === 'create' ? 'Create event' : 'Update event'
  const description =
    mode === 'create'
      ? 'Create a new OSINT / battlefield event.'
      : 'Update event details and metadata.'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col gap-6 sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='events-form'
            className='flex flex-1 flex-col gap-4 overflow-y-auto'
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {/* Title */}
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Short event title (e.g. UAV strike near Bakhmut)'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary */}
            <FormField
              control={form.control}
              name='summary'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder='Brief description, context, source notes…'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type / Severity / Status */}
            <div className='grid gap-4 sm:grid-cols-3'>
              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select type' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='severity'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select severity' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventSeverities.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventStatuses.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Confidence */}
            <FormField
              control={form.control}
              name='confidence'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Confidence ({Math.round((field.value ?? 0.6) * 100)}%)
                  </FormLabel>
                  <FormControl>
                    <input
                      type='range'
                      min={0}
                      max={1}
                      step={0.05}
                      value={field.value ?? 0.6}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                      className='w-full cursor-pointer'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Geo + time */}
            <div className='grid gap-4 sm:grid-cols-3'>
              <FormField
                control={form.control}
                name='latitude'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lat</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.000001'
                        placeholder='48.5123'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='longitude'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lng</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.000001'
                        placeholder='37.9987'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='occurredAt'
                render={({ field }) => {
                  const value = field.value
                    ? new Date(field.value).toISOString().slice(0, 16)
                    : ''

                  return (
                    <FormItem>
                      <FormLabel>Occurred at</FormLabel>
                      <FormControl>
                        <Input
                          type='datetime-local'
                          value={value}
                          onChange={(e) => {
                            const val = e.target.value
                            if (!val) {
                              field.onChange('')
                              return
                            }
                            const iso = new Date(val).toISOString()
                            field.onChange(iso)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            </div>
          </form>
        </Form>

        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline'>Cancel</Button>
          </SheetClose>
          <Button form='events-form' type='submit'>
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
