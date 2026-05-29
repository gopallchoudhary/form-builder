import { createUserWithEmailAndPasswordInput, CreateUserWithEmailAndPasswordInputType, generateUserTokenPayload, GenerateUserTokenPayloadType, signinUserWithEmailAndPasswordInput, SigninUserWithEmailAndPasswordInputType } from "./model";
import {db, eq} from '@repo/database'
import {usersTable} from '@repo/database/models/user'
import {randomBytes, createHmac} from 'node:crypto'
import * as JWT from 'jsonwebtoken'
import { env } from "../env";
class UserService {

    private async getUserByEmail(email: string) {
        const result =  await db.select().from(usersTable).where(eq(usersTable.email, email))

        if(!result || result.length === 0) return null
        return result[0]
    }

    private async generateUserToken(payload: GenerateUserTokenPayloadType) {
        const {id} =  await generateUserTokenPayload.parseAsync(payload)
        const token = JWT.sign({id}, env.JWT_SECRET)
        return {token}

    }

    public async createUserWithEmailAndPassword(payload: CreateUserWithEmailAndPasswordInputType) {
        const {fullName, email, password} = await createUserWithEmailAndPasswordInput.parseAsync(payload)

        // Check if user exists or not
        const existingUser = await this.getUserByEmail(email)
        if(existingUser) throw new Error(`User with email ${email} already exists`)

        // Calculate the hash and password
        const salt = randomBytes(32).toString('hex')
        const hash = createHmac('sha256', salt).update(password).digest('hex')

        // Create user in DB
        const userInsertResult = await db.insert(usersTable).values({email, fullName, password: hash, salt}).returning({id: usersTable.id})

        // Check if user creatin fails
        if(!userInsertResult || userInsertResult.length === 0 || !userInsertResult[0]?.id) throw new Error('something went wrong while creating a user')

        const userId = userInsertResult[0]?.id
        const {token} = await this.generateUserToken({id: userId})

        // Return the id of the user
        return {
                id: userId,
                token
            }
    }

    public async signinUserWithEmailAndPassword(payload: SigninUserWithEmailAndPasswordInputType) {
        const {email, password} = await signinUserWithEmailAndPasswordInput.parseAsync(payload)

        // Check if user exists or not
        const existingUser = await this.getUserByEmail(email)
        if(!existingUser) throw new Error(`User with email ${email} does not exist`)

        // Check if password is correct
        const salt = existingUser?.salt
        const hash = createHmac('sha256', salt).update(password).digest('hex')
        if(hash !== existingUser.password) throw new Error('Incorrect password or email')

        // Return the id of the user
        return {
                id: existingUser.id
            }
    }
}

export default UserService