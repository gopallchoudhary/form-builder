import { db, desc, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";

import { NotFoundError } from "../utils/errors";
import { assertFormOwnership } from "../utils/ownership";
import {
  createFormInput,
  type CreateFormInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
} from "./model";

class FormService {
  //. create form
  public async createForm(userId: string, payload: CreateFormInputType) {
    const { title, description } = await createFormInput.parseAsync(payload);

    const inserted = await db
      .insert(formsTable)
      .values({ title, description, createdBy: userId })
      .returning({ id: formsTable.id });

    if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
      throw new Error("Insert of the form returned no rows");
    }

    return { id: inserted[0].id };
  }

  //. get a form the user created
  public async getFormById(userId: string, formId: string) {
    await assertFormOwnership(formId, userId);

    const rows = await db
      .select({
        id: formsTable.id,
        title: formsTable.title,
        description: formsTable.description,
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
        title: formsTable.title,
        description: formsTable.description,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,
      })
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId))
      .orderBy(desc(formsTable.createdAt));
  }
}

export default FormService;
