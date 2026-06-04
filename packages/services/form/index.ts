import { createFormInput, CreateFormInputType, listFormsByUserIdInput, ListFormsByUserIdInputType } from "./model";
import { db, eq, desc } from '@repo/database'
import { formsTable } from '@repo/database/models/form'

class FormService {

    //. create form
    public async createForm(userId: string, payload: CreateFormInputType) {
        const { title, description } = await createFormInput.parseAsync(payload)

        // Insert form into DB with the authenticated user as creator
        const formInsertResult = await db.insert(formsTable).values({
            title,
            description,
            createdBy: userId,
        }).returning({ id: formsTable.id })

        // Check if form creation failed
        if (!formInsertResult || formInsertResult.length === 0 || !formInsertResult[0]?.id) {
            throw new Error('Something went wrong while creating the form')
        }

        const formId = formInsertResult[0].id

        // Return the id of the created form
        return {
            id: formId,
        }
    }

    //. list forms by user id
    public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
        const { userId } = await listFormsByUserIdInput.parseAsync(payload)
        const forms = await db
            .select({
                id: formsTable.id,
                title: formsTable.title,
                description: formsTable.description,
                createdAt: formsTable.createdAt,
                updatedAt: formsTable.updatedAt,
            })
            .from(formsTable)
            .where(eq(formsTable.createdBy, userId))
            .orderBy(desc(formsTable.createdAt))

        return forms
    }
}

export default FormService
