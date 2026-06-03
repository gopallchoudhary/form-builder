import {TypeOf, z} from 'zod'


export const createUserWithEmailAndPasswordInput = z.object({
    fullName: z.string().describe('Fullname is required'),
    email: z.email().describe('email of the user'),
    password: z.string().describe('passwrod of the  user')
})

export type CreateUserWithEmailAndPasswordInputType = z.infer<typeof createUserWithEmailAndPasswordInput>

export const signInUserWithEmailAndPasswordInput = z.object({
    email: z.email().describe('email of the user'),
    password: z.string().describe('passwrod of the  user')
})

export type SignInUserWithEmailAndPasswordInputType = z.infer<typeof signInUserWithEmailAndPasswordInput>



// token

export const generateUserTokenPayload = z.object({
    id: z.string()
})

export type GenerateUserTokenPayloadType = z.infer<typeof generateUserTokenPayload>