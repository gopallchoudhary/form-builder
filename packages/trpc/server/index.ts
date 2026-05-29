import { publicProcedure, router } from "./trpc";
import {z} from 'zod'
import { authRouter } from "./routes/auth/route";


export const serverRouter = router({
  auth: authRouter
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
