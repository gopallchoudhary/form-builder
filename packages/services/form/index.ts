import { createFormInput, CreateFormInputType } from "./model";
import { db } from '@repo/database'
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
}

export default FormService
