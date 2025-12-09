'use client'

import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import { roles } from '../data/data'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

const formSchema = z
  .object({
    firstName: z.string().min(1, "Ім'я є обовʼязковим."),
    lastName: z.string().min(1, 'Прізвище є обовʼязковим.'),
    username: z.string().min(1, 'Username є обовʼязковим.'),
    phoneNumber: z.string().min(1, 'Номер телефону є обовʼязковим.'),
    email: z.email({
      error: (iss) => (iss.input === '' ? 'Email є обовʼязковим.' : undefined),
    }),
    callsign: z.string().min(1, 'Позивний є обовʼязковим.'),
    rank: z.string().min(1, 'Звання є обовʼязковим.'),
    unit: z.string().min(1, 'Підрозділ є обовʼязковим.'),
    password: z.string().transform((pwd) => pwd.trim()),
    role: z.string().min(1, 'Роль є обовʼязковою.'),
    confirmPassword: z.string().transform((pwd) => pwd.trim()),
    isEdit: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return data.password.length > 0
    },
    {
      message: 'Пароль є обовʼязковим.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return password.length >= 8
    },
    {
      message: 'Пароль має містити щонайменше 8 символів.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return /[a-z]/.test(password)
    },
    {
      message: 'Пароль має містити хоча б одну маленьку літеру.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return /\d/.test(password)
    },
    {
      message: 'Пароль має містити хоча б одну цифру.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password, confirmPassword }) => {
      if (isEdit && !password) return true
      return password === confirmPassword
    },
    {
      message: 'Паролі не співпадають.',
      path: ['confirmPassword'],
    }
  )

type UserForm = z.infer<typeof formSchema>

type UserActionDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

const emptyFormValues: UserForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  role: '',
  phoneNumber: '',
  callsign: '',
  rank: '',
  unit: '',
  password: '',
  confirmPassword: '',
  isEdit: false,
}

export function UsersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const isEdit = !!currentRow
  const { setItems } = useUsers()
  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyFormValues,
  })

  // 🔥 Ось тут ми реально підтягуємо дані в форму при відкритті
  useEffect(() => {
    if (!open) return

    if (currentRow) {
      form.reset({
        firstName: currentRow.firstName,
        lastName: currentRow.lastName,
        username: currentRow.username,
        email: currentRow.email,
        phoneNumber: currentRow.phoneNumber,
        callsign: currentRow.callsign,
        rank: currentRow.rank,
        unit: currentRow.unit,
        role: currentRow.role,
        password: '',
        confirmPassword: '',
        isEdit: true,
      })
    } else {
      form.reset(emptyFormValues)
    }
  }, [currentRow, open, form])

  const onSubmit = (values: UserForm) => {
    const now = new Date()

    if (isEdit && currentRow) {
      // ✏️ ОНОВЛЕННЯ ІСНУЮЧОГО КОРИСТУВАЧА
      setItems((prev) =>
        prev.map((user) =>
          user.id === currentRow.id
            ? {
                ...user,
                firstName: values.firstName,
                lastName: values.lastName,
                username: values.username,
                email: values.email,
                phoneNumber: values.phoneNumber,
                callsign: values.callsign,
                rank: values.rank,
                unit: values.unit,
                role: values.role as User['role'],
                // status залишаємо як був
                updatedAt: now,
              }
            : user
        )
      )
      showSubmittedData(
        { ...values, id: currentRow.id },
        'Оновлено користувача:'
      )
    } else {
      // ➕ СТВОРЕННЯ НОВОГО КОРИСТУВАЧА
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          // eslint-disable-next-line react-hooks/purity
          : String(Date.now())

      setItems((prev) => [
        ...prev,
        {
          id,
          firstName: values.firstName,
          lastName: values.lastName,
          username: values.username,
          email: values.email,
          phoneNumber: values.phoneNumber,
          callsign: values.callsign,
          rank: values.rank,
          unit: values.unit,
          role: values.role as User['role'],
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ])

      showSubmittedData({ ...values, id }, 'Створено нового користувача:')
    }

    form.reset(emptyFormValues)
    onOpenChange(false)
  }

  const isPasswordTouched = !!form.formState.dirtyFields.password

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) {
          form.reset(emptyFormValues)
        }
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit
              ? 'Редагування користувача'
              : 'Додавання нового користувача'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Оновіть дані користувача та натисніть «Зберегти».'
              : 'Заповніть форму, щоб створити нового користувача системи штабу.'}
          </DialogDescription>
        </DialogHeader>
        <div className='h-[26.25rem] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              {/* Імʼя */}
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Ім&apos;я
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Іван'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Прізвище */}
              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Прізвище
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Петренко'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Username */}
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='ivan_petrenko'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Позивний */}
              <FormField
                control={form.control}
                name='callsign'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Позивний
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='напр. БЕРКУТ'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Звання */}
              <FormField
                control={form.control}
                name='rank'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Звання
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='ст. лейтенант'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Підрозділ */}
              <FormField
                control={form.control}
                name='unit'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Підрозділ
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Аналітичний відділ'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Email */}
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='ivan.petrenko@example.com'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Телефон */}
              <FormField
                control={form.control}
                name='phoneNumber'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Телефон
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='+380...'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Роль */}
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Роль</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='Оберіть роль'
                      className='col-span-4'
                      items={roles.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Пароль */}
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Пароль
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder={
                          isEdit
                            ? 'Залиште порожнім, щоб не змінювати'
                            : 'S3cur3P@ssw0rd'
                        }
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {/* Підтвердження паролю */}
              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Повторіть пароль
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        disabled={!isPasswordTouched}
                        placeholder='ще раз той самий пароль'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form'>
            Зберегти зміни
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
