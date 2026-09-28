import { db, desc, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";

import { ConflictError, NotFoundError } from "../utils/errors";
import { assertFormOwnership } from "../utils/ownership";
import { generateSlug } from "../utils/slug";
import {
  createFormInput,
  type CreateFormInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
} from "./model";

/** How many times to retry a colliding slug before giving up. */
const SLUG_ATTEMPTS = 5;

class FormService {
  //. create form
  public async createForm(userId: string, payload: CreateFormInputType) {
    const { title, description } = await createFormInput.parseAsync(payload);

    // `forms.slug` is globally unique because it is the public share URL, so retry
    // on the (very unlikely) collision rather than surfacing a raw constraint error.
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = generateSlug(title);
      try {
        const inserted = await db
          .insert(formsTable)
          .values({ title, description, createdBy: userId, slug })
          .returning({ id: formsTable.id });

        if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
          throw new Error("Insert of the form returned no rows");
        }

        return { id: inserted[0].id, slug };
      } catch (error) {
        const isUniqueViolation =
          error instanceof Error &&
          "code" in error &&
          (error as { code?: string }).code === "23505";

        if (!isUniqueViolation || attempt === SLUG_ATTEMPTS - 1) throw error;
      }
    }

    throw new ConflictError("Could not allocate a unique link for this form");
  }

  //. get a form the user created
  public async getFormById(userId: string, formId: string) {
    await assertFormOwnership(formId, userId);

    const rows = await db
      .select({
        id: formsTable.id,
        slug: formsTable.slug,
        title: formsTable.title,
        description: formsTable.description,
        layoutMode: formsTable.layoutMode,
        themeKey: formsTable.themeKey,
        status: formsTable.status,
        showProgress: formsTable.showProgress,
        allowBack: formsTable.allowBack,
        oneResponsePerDevice: formsTable.oneResponsePerDevice,
        maxResponses: formsTable.maxResponses,
        closesAt: formsTable.closesAt,
        thankYouTitle: formsTable.thankYouTitle,
        thankYouMessage: formsTable.thankYouMessage,
        thankYouRedirectUrl: formsTable.thankYouRedirectUrl,
        version: formsTable.version,
        publishedAt: formsTable.publishedAt,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,
      })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    const form = rows[0];
    if (!form) throw new NotFoundError("Form does not exist");

    return form;
  }

  //. list forms by user id
  public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
    const { userId } = await listFormsByUserIdInput.parseAsync(payload);

    return db
      .select({
        id: formsTable.id,
        slug: formsTable.slug,
        title: formsTable.title,
        description: formsTable.description,
        status: formsTable.status,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,
      })
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId))
      .orderBy(desc(formsTable.createdAt));
  }
}

export default FormService;
