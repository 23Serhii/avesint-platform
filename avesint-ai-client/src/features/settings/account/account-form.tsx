import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import { zodResolver } from '@hookform/resolvers/zod'

import { showSubmittedData } from '@/lib/show-submitted-data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const languages = [
  { label: 'Українська', value: 'uk' },
  { label: 'English', value: 'en' },
] as const

const userSettingsFormSchema = z.object({
  fullName: z
    .string()
    .min(5, 'Введіть повне ПІБ.')
    .max(80, 'ПІБ не має перевищувати 80 символів.'),
  callsign: z
    .string()
    .min(2, 'Позивний має містити щонайменше 2 символи.')
    .max(30, 'Позивний не має перевищувати 30 символів.'),
  email: z
    .string()
    .email('Введіть коректну службову електронну адресу.'),
  language: z
    .string('Оберіть мову інтерфейсу.')
    .min(1, 'Оберіть мову інтерфейсу.'),
})

type UserSettingsFormValues = z.infer<typeof userSettingsFormSchema>

const defaultValues: Partial<UserSettingsFormValues> = {
  language: 'uk',
}

export function AccountForm() {
  const form = useForm<UserSettingsFormValues>({
    resolver: zodResolver(userSettingsFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  function onSubmit(data: UserSettingsFormValues) {
    showSubmittedData(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='fullName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>ПІБ</FormLabel>
              <FormControl>
                <Input
                  placeholder='Прізвище Ім’я По батькові'
                  autoComplete='name'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Повне ПІБ співробітника для внутрішніх журналів та звітів.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='callsign'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Позивний у системі</FormLabel>
              <FormControl>
                <Input
                  placeholder='Наприклад: Орел-21'
                  autoComplete='off'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Внутрішній позивний / нік, який буде відображатися в аналітичній
                панелі та логах подій.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Службова електронна пошта</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder='name@mil.gov.ua'
                  autoComplete='email'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Використовується для службових сповіщень та відновлення доступу.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='language'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Мова інтерфейсу</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      role='combobox'
                      className={cn(
                        'w-[240px] justify-between',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value
                        ? languages.find(
                          (language) => language.value === field.value
                        )?.label
                        : 'Оберіть мову'}
                      <CaretSortIcon className='ms-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-[240px] p-0'>
                  <Command>
                    <CommandInput placeholder='Пошук мови…' />
                    <CommandEmpty>Мову не знайдено.</CommandEmpty>
                    <CommandGroup>
                      <CommandList>
                        {languages.map((language) => (
                          <CommandItem
                            value={language.label}
                            key={language.value}
                            onSelect={() => {
                              form.setValue('language', language.value, {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                'size-4 me-2',
                                language.value === field.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            {language.label}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormDescription>
                Мова, яка буде використана в інтерфейсі ОСINT-панелі.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit'>Зберегти налаштування</Button>
      </form>
    </Form>
  )
}
