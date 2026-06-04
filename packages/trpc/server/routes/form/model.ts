import { z } from 'zod'

export const createFormInputModel = z.object({
    title: z.string().min(1).max(55).describe('Title of the form'),
    description: z.string().max(300).optional().describe('Optional description of the form'),
})

export const createFormOutputModel = z.object({
    id: z.string().describe('Id of the created form'),
})

export const listFormsInputModel = z.undefined()

export const listFormsOutputModel = z.array(
    z.object({
        id: z.string().describe('Id of the form'),
        title: z.string().describe('Title of the form'),
        description: z.string().nullable().optional().describe('Description of the form'),
        createdAt: z.date().nullable().describe('When the form was created'),
        updatedAt: z.date().nullable().describe('When the form was last updated'),
    })
)
