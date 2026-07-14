import { FormEvent, useMemo, useState } from "react";
import type { EmployeeStaticPageRow } from "@repo/shared-types";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useGroups, useWorksites } from "../../master-data/hooks/useMasterData";
import { mutationErrorMessage } from "../../master-data/master-data-shared";
import type { CreateStaticPagePayload } from "../api/platform-admin.api";
import {
  useCreateStaticPage,
  useDeleteStaticPage,
  useStaticPages,
  useUpdateStaticPage
} from "../hooks/usePlatformAdmin";
import { STATIC_AUDIENCE_OPTIONS } from "../platform-admin-shared";

const EMPTY_FORM: CreateStaticPagePayload = {
  slug: "",
  title: "",
  bodyMarkdown: "",
  audienceType: "ALL",
  audienceRefId: null,
  sortOrder: 0,
  published: false
};

export function StaticPagesPanel() {
  const pagination = usePagination();
  const pagesQuery = useStaticPages(pagination.params);
  const paged = paginationFromResult(pagesQuery.data, pagination.page, pagination.pageSize);
  const worksitesQuery = useWorksites({ page: 1, pageSize: 100 });
  const groupsQuery = useGroups({ page: 1, pageSize: 100 });

  const createPage = useCreateStaticPage();
  const updatePage = useUpdateStaticPage();
  const deletePage = useDeleteStaticPage();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmployeeStaticPageRow | null>(null);
  const [form, setForm] = useState<CreateStaticPagePayload>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const audienceRefOptions = useMemo(() => {
    if (form.audienceType === "WORKSITE") {
      return (worksitesQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.code} — ${item.name}`
      }));
    }
    if (form.audienceType === "EMPLOYEE_GROUP") {
      return (groupsQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.name
      }));
    }
    return [];
  }, [form.audienceType, worksitesQuery.data?.items, groupsQuery.data?.items]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setFeedback(null);
  };

  const openEdit = (page: EmployeeStaticPageRow) => {
    setEditing(page);
    setForm({
      slug: page.slug,
      title: page.title,
      bodyMarkdown: page.bodyMarkdown,
      audienceType: page.audienceType as CreateStaticPagePayload["audienceType"],
      audienceRefId: page.audienceRefId,
      sortOrder: page.sortOrder,
      published: page.published,
      attachmentName: page.attachmentName,
      attachmentPath: page.attachmentPath,
      attachmentMime: page.attachmentMime,
      attachmentSize: page.attachmentSize
    });
    setShowForm(true);
    setFeedback(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const payload = {
      ...form,
      audienceRefId: form.audienceType === "ALL" ? null : form.audienceRefId
    };

    if (editing) {
      updatePage.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            setFeedback({ type: "success", message: "Pagină actualizată." });
            setShowForm(false);
          },
          onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
        }
      );
      return;
    }

    createPage.mutate(payload, {
      onSuccess: () => {
        setFeedback({ type: "success", message: "Pagină creată." });
        setShowForm(false);
        setForm(EMPTY_FORM);
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  return (
    <div className="form-stack">
      <div className="toolbar-row">
        <button type="button" className="btn-primary" onClick={openCreate}>
          Pagină nouă
        </button>
      </div>

      {showForm ? (
        <form className="card form-stack" onSubmit={onSubmit}>
          <h2 className="card-title">{editing ? "Editează pagină" : "Pagină statică nouă"}</h2>

          <div className="field">
            <label htmlFor="static-slug">Slug (URL)</label>
            <input
              id="static-slug"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="ex: politica-interna"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="static-title">Titlu</label>
            <input
              id="static-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="static-body">Conținut (Markdown)</label>
            <textarea
              id="static-body"
              rows={10}
              value={form.bodyMarkdown}
              onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
              required
            />
          </div>

          <FieldSelect
            id="static-audience"
            label="Audiență"
            value={form.audienceType ?? "ALL"}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                audienceType: value as CreateStaticPagePayload["audienceType"],
                audienceRefId: value === "ALL" ? null : current.audienceRefId
              }))
            }
            options={STATIC_AUDIENCE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          />

          {form.audienceType !== "ALL" ? (
            <FieldSelect
              id="static-audience-ref"
              label="Referință audiență"
              value={form.audienceRefId ?? ""}
              onChange={(value) => setForm((current) => ({ ...current, audienceRefId: value || null }))}
              options={audienceRefOptions}
              required
              allowEmpty
              emptyLabel="Selectează"
            />
          ) : null}

          <div className="field">
            <label htmlFor="static-sort">Ordine sortare</label>
            <input
              id="static-sort"
              type="number"
              min={0}
              value={form.sortOrder ?? 0}
              onChange={(event) =>
                setForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))
              }
            />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(form.published)}
              onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
            />
            Publicată pentru angajați
          </label>

          <div className="toolbar-row">
            <button type="submit" className="btn-primary" disabled={createPage.isPending || updatePage.isPending}>
              {createPage.isPending || updatePage.isPending ? "Se salvează..." : "Salvează"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Anulează
            </button>
          </div>
        </form>
      ) : null}

      {feedback ? (
        <p className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}

      <section className="card form-stack">
        <h3 className="card-title">Pagini existente</h3>
        {pagesQuery.isLoading ? <p>Se încarcă...</p> : null}
        <ul className="list-plain">
          {paged.items.map((page) => (
            <li key={page.id} className="list-row">
              <div>
                <strong>{page.title}</strong>
                <span className="muted">
                  {" "}
                  — /informatii/{page.slug} · {page.published ? "publicată" : "draft"}
                </span>
              </div>
              <div className="toolbar-row">
                <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(page)}>
                  Editează
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={deletePage.isPending}
                  onClick={() =>
                    deletePage.mutate(page.id, {
                      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
                    })
                  }
                >
                  Șterge
                </button>
              </div>
            </li>
          ))}
        </ul>
        <PaginationBar
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          disabled={pagesQuery.isFetching}
        />
      </section>
    </div>
  );
}
