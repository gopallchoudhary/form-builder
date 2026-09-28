import { z } from "zod";

export {
  deleteResponseInput as deleteResponseInputModel,
  listResponsesInput as listResponsesInputModel,
} from "@repo/services/response/model";

export {
  listResponsesOutputSchema,
  responseAnswerSchema,
} from "@repo/services/response/model";

export const deleteResponseOutputSchema = z.object({ sessionId: z.string() });
