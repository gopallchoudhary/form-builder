import { asc, db as defaultDb, eq, type Database } from "@repo/database";
import { formPagesTable } from "@repo/database/models/form-page";

import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors";
import { assertFormOwnership, assertPageOwnership } from "../utils/ownership";
import {
  positionBetween,
  positionForIndex,
  PositionExhaustedError,
  renumberInOrder,
  sequentialPositions,
} from "../utils/ordering";
import {
  createPageInput,
  type CreatePageInputType,
  deletePageInput,
  type DeletePageInputType,
  listPagesInput,
  type ListPagesInputType,
  reorderPagesInput,
  type ReorderPagesInputType,
  updatePageInput,
  type UpdatePageInputType,
} from "./model";

/** The transaction handle drizzle hands to a `db.transaction` callback. */
type TransactionHandle = Parameters<Parameters<Database["transaction"]>[0]>[0];

const PAGE_COLUMNS = {
  id: formPagesTable.id,
  formId: formPagesTable.formId,
  title: formPagesTable.title,
  description: formPagesTable.description,
  position: formPagesTable.position,
  createdAt: formPagesTable.createdAt,
  updatedAt: formPagesTable.updatedAt,
} as const;

class FormPageService {
  constructor(private readonly db: Database = defaultDb) {}

  //. list a form's pages, in order
  public async listPages(userId: string, payload: ListPagesInputType) {
    const { formId } = await listPagesInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    return this.db
      .select(PAGE_COLUMNS)
      .from(formPagesTable)
      .where(eq(formPagesTable.formId, formId))
      .orderBy(asc(formPagesTable.position));
  }

  //. create a page, appending by default or inserting after an existing one
  public async createPage(userId: string, payload: CreatePageInputType) {
    const { formId, title, description, afterPageId } = await createPageInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    return this.db.transaction(async (tx) => {
      const position = await this.resolveInsertPosition(tx, formId, afterPageId);

      const inserted = await tx
        .insert(formPagesTable)
        .values({ formId, title: title ?? null, description: description ?? null, position })
        .returning({ id: formPagesTable.id });

      if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
        throw new Error("Insert of the page returned no rows");
      }

      return { id: inserted[0].id, position };
    });
  }

  //. update a page's title and intro
  public async updatePage(userId: string, payload: UpdatePageInputType) {
    const { pageId, title, description } = await updatePageInput.parseAsync(payload);

    await assertPageOwnership(pageId, userId, this.db);

    const updateData: { title?: string | null; description?: string | null } = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      throw new ConflictError("No fields to update");
    }

    const updated = await this.db
      .update(formPagesTable)
      .set(updateData)
      .where(eq(formPagesTable.id, pageId))
      .returning({ id: formPagesTable.id });

    if (!updated || updated.length === 0) throw new NotFoundError("Page does not exist");

    return { id: pageId };
  }

  /**
   * Delete a page. Its questions survive with `page_id` set to null — the column's
   * `on delete set null` — and the remaining pages are renumbered so positions stay
   * contiguous.
   */
  public async deletePage(userId: string, payload: DeletePageInputType) {
    const { pageId } = await deletePageInput.parseAsync(payload);

    const page = await assertPageOwnership(pageId, userId, this.db);

    return this.db.transaction(async (tx) => {
      await tx.delete(formPagesTable).where(eq(formPagesTable.id, pageId));

      const remaining = await tx
        .select({ id: formPagesTable.id, position: formPagesTable.position })
        .from(formPagesTable)
        .where(eq(formPagesTable.formId, page.formId))
        .orderBy(asc(formPagesTable.position));

      await this.renumber(tx, remaining);

      return { id: pageId };
    });
  }

  //. set the complete page order for a form
  public async reorderPages(userId: string, payload: ReorderPagesInputType) {
    const { formId, orderedPageIds } = await reorderPagesInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    const existing = await this.db
      .select({ id: formPagesTable.id, position: formPagesTable.position })
      .from(formPagesTable)
      .where(eq(formPagesTable.formId, formId))
      .orderBy(asc(formPagesTable.position));

    // A partial or duplicated list would silently drop a page, so require the whole set.
    const existingIds = new Set(existing.map((page) => page.id));
    if (
      orderedPageIds.length !== existing.length ||
      new Set(orderedPageIds).size !== orderedPageIds.length ||
      orderedPageIds.some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestError("orderedPageIds must list every page of this form exactly once");
    }

    return this.db.transaction(async (tx) => {
      await renumberInOrder(orderedPageIds, async (pageId, position) => {
        await tx
          .update(formPagesTable)
          .set({ position })
          .where(eq(formPagesTable.id, pageId));
      });

      return { orderedPageIds };
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /**
   * Where a new page goes: after `afterPageId`, or at the end. When the gap between
   * two neighbours is exhausted, the list is renumbered first and the insert retried.
   */
  private async resolveInsertPosition(
    tx: TransactionHandle,
    formId: string,
    afterPageId: string | undefined,
  ): Promise<string> {
    const pages = await tx
      .select({ id: formPagesTable.id, position: formPagesTable.position })
      .from(formPagesTable)
      .where(eq(formPagesTable.formId, formId))
      .orderBy(asc(formPagesTable.position));

    if (pages.length === 0) return positionForIndex(0);

    if (!afterPageId) {
      // Append: one past the last page.
      return positionBetween(pages[pages.length - 1]!.position, null);
    }

    const index = pages.findIndex((page) => page.id === afterPageId);
    if (index === -1) throw new NotFoundError("The page to insert after does not exist");

    const before = pages[index]!.position;
    const after = pages[index + 1]?.position ?? null;

    try {
      return positionBetween(before, after);
    } catch (error) {
      if (!(error instanceof PositionExhaustedError)) throw error;

      // No room between the neighbours: renumber, then take the gap that just opened.
      const renumbered = pages.map((page, at) => ({
        id: page.id,
        position: sequentialPositions(pages.length)[at]!,
      }));
      await this.renumber(tx, renumbered);

      return positionBetween(
        renumbered[index]!.position,
        renumbered[index + 1]?.position ?? null,
      );
    }
  }

  /** Rewrites positions to 1.00, 2.00, ... in the order given. */
  private async renumber(
    tx: TransactionHandle,
    pages: { id: string; position: string }[],
  ): Promise<void> {
    const positions = sequentialPositions(pages.length);

    for (const [index, page] of pages.entries()) {
      if (page.position === positions[index]) continue;
      await tx
        .update(formPagesTable)
        .set({ position: positions[index]! })
        .where(eq(formPagesTable.id, page.id));
    }
  }
}

export default FormPageService;
