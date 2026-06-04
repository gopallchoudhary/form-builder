import { z } from 'zod'

export const createFormInput = z.object({
    title: z.string().min(1).max(55).describe('Title of the form'),
    description: z.string().max(300).optional().describe('Optional description of the form')
})

export type CreateFormInputType = z.infer<typeof createFormInput>
