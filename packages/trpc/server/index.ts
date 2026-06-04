import { publicProcedure, router } from "./trpc";
import {z} from 'zod'
import { authRouter } from "./routes/auth/route";
import {formRouter} from './routes/form/route'

export const serverRouter = router({
  auth: authRouter,
  form: formRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
