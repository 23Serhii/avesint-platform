import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Otp } from '@/features/auth/otp'  // або правильний шлях до компонента

const searchSchema = z.object({
  token: z.string(),          // обов'язковий
  redirect: z.string().optional(), // опційний
})

export const Route = createFileRoute('/(auth)/otp')({
  component: Otp,
  validateSearch: searchSchema,
})
