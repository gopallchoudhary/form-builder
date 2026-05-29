import { router, publicProcedure } from "../../trpc";
import  {z} from 'zod'


export const formRouter = router({
    createForm: publicProcedure
        .meta({
            openapi: {
                method: 'POST',
                path: '/form/createForm',
                tags: ['Form']
            }
        })
        .input(z.object({
            name: z.string().describe('Name of the form'),
            description: z.string().describe('Description of the form'),
            fields: z.array(z.object({
                name: z.string().describe('Name of the field'),
                type: z.string().describe('Type of the field'),
                required: z.boolean().describe('Required or not'),
                options: z.array(z.object({
                    name: z.string().describe('Name of the option'),
                    value: z.string().describe('Value of the option')
                })).describe('Options of the field')
            })).describe('Fields of the form')
        }))
        .output(z.object({
            id: z.string().describe('Id of the form created')
        }))
        .mutation(async ({input}) => {
            return {
                id: '123'
            }
        })
});