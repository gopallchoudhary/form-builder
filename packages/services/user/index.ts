import * as JWT from "jsonwebtoken";
import { db, eq } from "@repo/database";
import { usersTable, type SelectUser } from "@repo/database/models/user";

import { env } from "../env";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  createUserWithEmailAndPasswordInput,
  type CreateUserWithEmailAndPasswordInputType,
  generateUserTokenPayload,
  type GenerateUserTokenPayloadType,
  signInUserWithEmailAndPasswordInput,
  type SignInUserWithEmailAndPasswordInputType,
} from "./model";

/** One message for every failed sign-in so accounts cannot be enumerated. */
const INVALID_CREDENTIALS = "Incorrect email or password";

const TOKEN_TTL = "7d";

class UserService {
  private async getUserByEmail(email: string): Promise<SelectUser | null> {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return rows[0] ?? null;
  }

  private async generateUserToken(payload: GenerateUserTokenPayloadType) {
    const { id } = await generateUserTokenPayload.parseAsync(payload);
    const token = JWT.sign({ id }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
    return { token };
  }

  private verifyUserToken(token: string): GenerateUserTokenPayloadType {
    try {
      const decoded = JWT.verify(token, env.JWT_SECRET) as GenerateUserTokenPayloadType;
      return generateUserTokenPayload.parse(decoded);
    } catch (error) {
      throw new UnauthorizedError("Your session is invalid or has expired", { cause: error });
    }
  }

  //. get user info by id
  public async getUserInfoById(id: string) {
    const user = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        profileImageUrl: usersTable.profileImageUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!user || user.length === 0) throw new NotFoundError(`User ${id} does not exist`);

    return user[0]!;
  }

  //. create user with email and password
  public async createUserWithEmailAndPassword(payload: CreateUserWithEmailAndPasswordInputType) {
    const { fullName, email, password } = await createUserWithEmailAndPasswordInput.parseAsync(
      payload,
    );

    if (await this.getUserByEmail(email)) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await hashPassword(password);

    const inserted = await db
      .insert(usersTable)
      .values({ email, fullName, passwordHash })
      .returning({ id: usersTable.id });

    if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
      throw new Error("Insert of the user returned no rows");
    }

    const id = inserted[0].id;
    const { token } = await this.generateUserToken({ id });

    return { id, token };
  }

  //. sign in user with email and password
  public async signInUserWithEmailAndPassword(payload: SignInUserWithEmailAndPasswordInputType) {
    const { email, password } = await signInUserWithEmailAndPasswordInput.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);
    if (!existingUser) throw new UnauthorizedError(INVALID_CREDENTIALS);
    if (!existingUser.passwordHash) {
      throw new BadRequestError("This account cannot sign in with a password");
    }

    if (!(await verifyPassword(password, existingUser.passwordHash))) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const id = existingUser.id;
    const { token } = await this.generateUserToken({ id });

    return { id, token };
  }

  //. verify and decode user token
  public async verifyAndDecodeUserToken(token: string) {
    const { id } = this.verifyUserToken(token);
    return { id };
  }
}

export default UserService;
