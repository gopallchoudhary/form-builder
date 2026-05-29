
import { string } from "zod";
import { z, zodUndefinedModel } from "../../schema";
import { userService } from "../../services";
import { publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { createUserWithEmailAndPasswordInputModel, createUserWithEmailAndPasswordOutputModel, signinUserWithEmailAndPasswordInputModel, signinUserWithEmailAndPasswordOutputModel } from "./model";
import { setAuthenticationCookie } from "../../utils/cookie";
import { createNextApiHandler } from "@trpc/server/adapters/next";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

export const authRouter = router({
  // create User
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

  // signin User
    signinUserWithEmailAndPassword: publicProcedure
        .meta({openapi: {
            method: 'POST',
            path: getPath('/signinUserWithEmailAndPassword'),
            tags: TAGS
        }})
        .input(signinUserWithEmailAndPasswordInputModel)
        .output(signinUserWithEmailAndPasswordOutputModel)
        .mutation( async ({input, ctx}) => {
            const {email, password} = input
            const {id} = await userService.signinUserWithEmailAndPassword({
                email, password
            })
            
            
            return {
                id,
                
            }
        })
});
