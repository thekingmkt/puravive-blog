"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import RichTextEditor from "./RichTextEditor";
import ImageUploadField from "./ImageUploadField";
import type { Category, PostWithCategory, PostStatus } from "@/lib/types";
import type { PostFormState } from "@/app/admin/actions";

type Props = {
  categories: Category[];
  post?: PostWithCategory;
  action: (
    prevState: PostFormState,
    formData: FormData
  ) => Promise<PostFormState>;
};

const initialState: PostFormState = { error: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-store" type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </button>
  );
}

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function PostForm({ categories, post, action }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [contentHtml, setContentHtml] = useState(post?.content_html ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    post?.cover_image_url ?? ""
  );
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "rascunho");
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeLocal(post?.published_at ?? null)
  );
  const [showSeo, setShowSeo] = useState(false);
  const [showProduct, setShowProduct] = useState(
    Boolean(post?.product_name)
  );
  const [productName, setProductName] = useState(post?.product_name ?? "");
  const [productImageUrl, setProductImageUrl] = useState(
    post?.product_image_url ?? ""
  );
  const [productDescription, setProductDescription] = useState(
    post?.product_description ?? ""
  );
  const [productUrl, setProductUrl] = useState(post?.product_url ?? "");

  const hasProduct = Boolean(
    productName || productImageUrl || productDescription || productUrl
  );

  function removeProduct() {
    setProductName("");
    setProductImageUrl("");
    setProductDescription("");
    setProductUrl("");
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(
        value
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
      );
    }
  }

  return (
    <form action={formAction} className="post-form">
      <input type="hidden" name="content_html" value={contentHtml} />
      <input type="hidden" name="cover_image_url" value={coverImageUrl} />
      <input type="hidden" name="product_image_url" value={productImageUrl} />

      <div className="field">
        <label className="field-label" htmlFor="title">
          Título
        </label>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="slug">
          Link (URL)
        </label>
        <div className="field-slug">
          <span>blog.puravive.com.br/</span>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="category_id">
          Categoria
        </label>
        <select
          id="category_id"
          name="category_id"
          defaultValue={post?.category_id ?? ""}
        >
          <option value="">Selecione</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <ImageUploadField
        label="Imagem de capa"
        value={coverImageUrl}
        onChange={setCoverImageUrl}
        hint="Tamanho ideal: 1600 x 900px (formato paisagem, 16:9). Outros tamanhos funcionam, mas essa proporção evita corte estranho."
      />

      <div className="field">
        <label className="field-label" htmlFor="excerpt">
          Resumo
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={post?.excerpt ?? ""}
          placeholder="Aparece nos cards da home e da categoria"
        />
      </div>

      <div className="field">
        <label className="field-label">Conteúdo</label>
        <RichTextEditor content={contentHtml} onChange={setContentHtml} />
      </div>

      <div className="field">
        <label className="field-label">Status</label>
        <div className="status-options">
          <label className="status-option">
            <input
              type="radio"
              name="status"
              value="rascunho"
              checked={status === "rascunho"}
              onChange={() => setStatus("rascunho")}
            />
            Rascunho
          </label>
          <label className="status-option">
            <input
              type="radio"
              name="status"
              value="publicado"
              checked={status === "publicado"}
              onChange={() => setStatus("publicado")}
            />
            Publicar agora
          </label>
          <label className="status-option">
            <input
              type="radio"
              name="status"
              value="agendado"
              checked={status === "agendado"}
              onChange={() => setStatus("agendado")}
            />
            Agendar
          </label>
        </div>
        {status === "agendado" && (
          <>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="scheduled-input"
            />
            {/* O datetime-local não carrega fuso nenhum: mandar o valor cru
                faria o banco ler a hora como UTC e o post sairia 3h adiantado.
                Aqui no navegador o fuso é o seu, então a conversão é correta. */}
            <input
              type="hidden"
              name="scheduled_at"
              value={scheduledAt ? new Date(scheduledAt).toISOString() : ""}
            />
          </>
        )}
        <p className="field-hint">
          Escolher aqui só marca a opção. Clica no botão no final da página
          pra confirmar.
        </p>
      </div>

      <details
        className="field-section"
        open={showProduct}
        onToggle={(e) => setShowProduct(e.currentTarget.open)}
      >
        <summary>
          Produto relacionado (opcional)
          {hasProduct && <span className="section-badge">ativo</span>}
        </summary>
        <div className="field-section-body">
          <div className="field">
            <label className="field-label" htmlFor="product_name">
              Nome do produto
            </label>
            <input
              id="product_name"
              name="product_name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <ImageUploadField
            label="Imagem do produto"
            value={productImageUrl}
            onChange={setProductImageUrl}
            hint="Tamanho ideal: 800 x 800px (quadrada), fundo branco ou transparente."
          />
          <div className="field">
            <label className="field-label" htmlFor="product_description">
              Frase curta
            </label>
            <input
              id="product_description"
              name="product_description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="O que o produto faz, em uma frase"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="product_url">
              Link do produto
            </label>
            <input
              id="product_url"
              name="product_url"
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://www.puravive.com.br/products/..."
            />
          </div>

          <div className="field-section-foot">
            <button
              type="button"
              className="btn-danger"
              onClick={removeProduct}
              disabled={!hasProduct}
            >
              Remover produto do post
            </button>
            <p className="field-hint">
              Limpa os campos acima. O bloco do produto some do post quando
              você salvar.
            </p>
          </div>
        </div>
      </details>

      <details
        className="field-section"
        open={showSeo}
        onToggle={(e) => setShowSeo(e.currentTarget.open)}
      >
        <summary>SEO (opcional)</summary>
        <div className="field-section-body">
          <div className="field">
            <label className="field-label" htmlFor="meta_title">
              Título para o Google
            </label>
            <input
              id="meta_title"
              name="meta_title"
              defaultValue={post?.meta_title ?? ""}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="meta_description">
              Descrição para o Google
            </label>
            <textarea
              id="meta_description"
              name="meta_description"
              rows={2}
              defaultValue={post?.meta_description ?? ""}
            />
          </div>
        </div>
      </details>

      {state.error && <p className="field-error">{state.error}</p>}
      {!state.error && state.savedAt && (
        <p className="field-success">Salvo com sucesso.</p>
      )}

      <SubmitButton
        label={
          status === "publicado"
            ? "Publicar"
            : status === "agendado"
              ? "Agendar post"
              : "Salvar rascunho"
        }
      />
    </form>
  );
}
