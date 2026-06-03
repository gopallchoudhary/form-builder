import { createUserWithEmailAndPasswordInput, CreateUserWithEmailAndPasswordInputType, generateUserTokenPayload, GenerateUserTokenPayloadType, signInUserWithEmailAndPasswordInput, SignInUserWithEmailAndPasswordInputType } from "./model";
import {db, eq} from '@repo/database'
import {usersTable} from '@repo/database/models/user'
import {randomBytes, createHmac} from 'node:crypto'
import * as JWT from 'jsonwebtoken'
import { env } from "../env";
class UserService {

    //, get user by email 
    private async getUserByEmail(email: string) {
        const result =  await db.select().from(usersTable).where(eq(usersTable.email, email))

        if(!result || result.length === 0) return null
        return result[0]
    }

    //, generate user token 
    private async generateUserToken(payload: GenerateUserTokenPayloadType) {
        const {id} =  await generateUserTokenPayload.parseAsync(payload)
        const token = JWT.sign({id}, env.JWT_SECRET)
        return {token}

    }

    //, generate hash 
    private async generateHash(salt: string, password: string) {
        return createHmac('sha256', salt).update(password).digest('hex')
    }

    //, verify user token
    private async verifyUserToken(token: string): Promise<GenerateUserTokenPayloadType> {
        try {
            const decoded =  JWT.verify(token, env.JWT_SECRET) as GenerateUserTokenPayloadType
            return decoded
        } catch (error) {
            throw new Error('Invalid token')
        }
    }

    //, get user info by id 
    private async getUserInfoById(id: string) {
        const user = await db.select({
            id: usersTable.id,
            email: usersTable.email,
            fullName: usersTable.fullName,
            profileImageUrl: usersTable.profileImageUrl
        }).from(usersTable).where(eq(usersTable.id, id))

        if(!user || user.length === 0) throw new Error(`User with id ${id} does not exists`)

        return user[0]!
    }

    //. create user with email and password 
    public async createUserWithEmailAndPassword(payload: CreateUserWithEmailAndPasswordInputType) {
        const {fullName, email, password} = await createUserWithEmailAndPasswordInput.parseAsync(payload)

        // Check if user exists or not
        const existingUser = await this.getUserByEmail(email)
        if(existingUser) throw new Error(`User with email ${email} already exists`)

        // Calculate the hash and password
        const salt = randomBytes(32).toString('hex')
        const hash = await this.generateHash(salt, password)

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

    //. sign in user with email and password 
    public async signInUserWithEmailAndPassword(payload: SignInUserWithEmailAndPasswordInputType) {
        const {email, password} = await signInUserWithEmailAndPasswordInput.parseAsync(payload)

        // Check if user exists or not
        const existingUser = await this.getUserByEmail(email)
        if(!existingUser) throw new Error(`User with email ${email} does not exist`)
            
        const salt = existingUser?.salt
        
        if(!existingUser.password || !salt) throw new Error("Invalid authentication method")

        // Check if password is correct
        const hash = await this.generateHash(salt, password)
        if(hash !== existingUser.password) throw new Error('Incorrect password or email address')
        
        const id = existingUser.id
        const {token} = await this.generateUserToken({id})

        // Return the id of the user
        return {
                id,
                token
            }
    }

    //. verify and decode user token
    public async verifyAndDecodeUserToken(token: string) {
        const {id} = await this.verifyUserToken(token)
        const userInfo = await this.getUserInfoById(id)
        return {...userInfo}
    }
}

export default UserService