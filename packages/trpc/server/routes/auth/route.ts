
import { string } from "zod";
import { z, zodUndefinedModel } from "../../schema";
import { userService } from "../../services";
import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { createUserWithEmailAndPasswordInputModel, createUserWithEmailAndPasswordOutputModel, getLoggedInUserInfoInputModel, getLoggedInUserInfoOutputModel, signInUserWithEmailAndPasswordInputModel, signInUserWithEmailAndPasswordOutputModel } from "./model";
import { getAuthenticationCookie, setAuthenticationCookie } from "../../utils/cookie";
import { createNextApiHandler } from "@trpc/server/adapters/next";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

export const authRouter = router({
  //. create User
  createUserWithEmailAndPassword: publicProcedure
    .meta({openapi: {
      method: 'POST',
      path: getPath('/createUserWithEmailAndPassword'),
      tags: TAGS
    }})
    .input(createUserWithEmailAndPasswordInputModel)
    .output(createUserWithEmailAndPasswordOutputModel)
    .mutation( async ({input, ctx}) => {
      const {email, fullName, password} = input
      const {id, token} = await userService.createUserWithEmailAndPassword({
        fullName, email, password
      })

      setAuthenticationCookie(ctx, token)
      
    
      return {
        id
      }
    }),

  //. signin User
    signinUserWithEmailAndPassword: publicProcedure
        .meta({openapi: {
            method: 'POST',
            path: getPath('/signinUserWithEmailAndPassword'),
            tags: TAGS
        }})
        .input(signInUserWithEmailAndPasswordInputModel)
        .output(signInUserWithEmailAndPasswordOutputModel)
        .mutation( async ({input, ctx}) => {
            const {email, password} = input
            const {id, token} = await userService.signInUserWithEmailAndPassword({
                email, password
            })
            
            setAuthenticationCookie(ctx, token)
            
            return {
                id
            }
        }),

  //. get logged in user info 
    getLoggedInUserInfo: authenticatedProcedure
        .meta({openapi: {
            method: 'GET',
            path: getPath('/getLoggedInUserInfo'),
            tags: TAGS
        }})
        .input(getLoggedInUserInfoInputModel)
        .output(getLoggedInUserInfoOutputModel)
        .query(async({ctx}) => {
            
            
            const {id, email, fullName, profileImageUrl} =  await userService.getUserInfoById(ctx.user.id)

            return {
              id,
              email,
              fullName,
              profileImageUrl
            }
        })
});
