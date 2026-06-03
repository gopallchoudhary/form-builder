import {z} from 'zod'

export const createUserWithEmailAndPasswordInputModel = z.object({
    fullName: z.string().describe('Fullname is required'),
    email: z.email().describe('email of the user'),
    password: z.string().describe('passwrod of the  user')
})


export const createUserWithEmailAndPasswordOutputModel = z.object({
    id: z.string().describe('Id of the user created')
})

export const signInUserWithEmailAndPasswordInputModel = z.object({
    email: z.email().describe('email of the user'),
    password: z.string().describe('passwrod of the  user')
})

export const signInUserWithEmailAndPasswordOutputModel = z.object({
    id: z.string().describe('Id of the user created')
})

export const getLoggedInUserInfoInputModel = z.undefined()

export const getLoggedInUserInfoOutputModel = z.object({
    id: z.string().describe('Id of the user'),
    email: z.email().describe('email of the user'),
    fullName: z.string().describe('Fullname is required'),
    profileImageUrl: z.string().describe('URL of the profile image').optional().nullable()
})