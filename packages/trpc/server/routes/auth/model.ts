import {z} from 'zod'

export const createUserWithEmailAndPasswordInputModel = z.object({
    fullName: z.string().describe('Fullname is required'),
    email: z.email().describe('email of the user'),
    password: z.string().describe('passwrod of the  user')
})


export const createUserWithEmailAndPasswordOutputModel = z.object({
    id: z.string().describe('Id of the user created')
})

export const signinUserWithEmailAndPasswordInputModel = z.object({
    email: z.email().describe('email of the user'),
    password: z.string().describe('passwrod of the  user')
})

export const signinUserWithEmailAndPasswordOutputModel = z.object({
    id: z.string().describe('Id of the user created')
})