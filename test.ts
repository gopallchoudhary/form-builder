import { db } from '@repo/database';
import FormFieldService from './packages/services/form-field/index';

async function main() {
  const service = new FormFieldService();
  try {
    const res = await service.createField({
      formId: '855b128a-da4d-440d-a663-ce1340ccbc39',
      label: 'Mobile No.',
      placeholder: 'Enter your mobile no.',
      description: '+91 9999999999',
      isRequired: true,
      type: 'NUMBER',
      index: '1.00',
    });
    console.log("Success", res);
  } catch (e: any) {
    console.error("Error message:", e.message);
    if (e.cause) {
      console.error("Error cause:", e.cause);
    }
    if (e.stack) {
      console.error("Error stack:", e.stack);
    }
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
