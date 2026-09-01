import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Eye,
  FileText,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import type { BlogStatus, EditableBlogArticle } from '~/data-provider/Jojoo';
import {
  useDeleteJojooArticleMutation,
  useJojooArticleQuery,
  useJojooBlogQuery,
  useSaveJojooArticleMutation,
  useUploadJojooMediaMutation,
} from '~/data-provider/Jojoo';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useLocalize } from '~/hooks';

const EMPTY_ARTICLE: EditableBlogArticle = {
  slug: '',
  title: '',
  summary: '',
  category: 'Notes',
  contentMarkdown: '',
  tags: [],
  status: 'draft',
};

function fingerprint(article: EditableBlogArticle): string {
  return JSON.stringify(article);
}

function articleDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function validation(article: EditableBlogArticle, status: BlogStatus): string | undefined {
  if (!article.title.trim()) return 'TITLE_REQUIRED';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(article.slug.trim())) return 'SLUG_INVALID';
  if (status === 'published' && !article.summary.trim()) return 'SUMMARY_REQUIRED';
  if (status === 'published' && !article.contentMarkdown.trim()) return 'CONTENT_REQUIRED';
  return undefined;
}

const validationKeys = {
  TITLE_REQUIRED: 'com_workspace_site_title_required',
  SLUG_INVALID: 'com_workspace_site_slug_invalid',
  SUMMARY_REQUIRED: 'com_workspace_site_summary_required',
  CONTENT_REQUIRED: 'com_workspace_site_content_required',
} as const;

export default function BlogEditor() {
  const localize = useLocalize();
  const listQuery = useJojooBlogQuery();
  const [selectedId, setSelectedId] = useState<string>();
  const articleQuery = useJojooArticleQuery(selectedId);
  const saveMutation = useSaveJojooArticleMutation();
  const deleteMutation = useDeleteJojooArticleMutation();
  const uploadMutation = useUploadJojooMediaMutation();
  const [draft, setDraft] = useState<EditableBlogArticle>(EMPTY_ARTICLE);
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint(EMPTY_ARTICLE));
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState<string>();
  const [imageAlt, setImageAlt] = useState('');
  const markdownRef = useRef<HTMLTextAreaElement>(null);

  const articles = useMemo(
    () =>
      [...(listQuery.data ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [listQuery.data],
  );
  const dirty = fingerprint(draft) !== savedFingerprint;
  const pending = saveMutation.isLoading || deleteMutation.isLoading || uploadMutation.isLoading;

  useEffect(() => {
    if (!selectedId && articles[0]) setSelectedId(articles[0].id);
  }, [articles, selectedId]);

  useEffect(() => {
    if (!articleQuery.data) return;
    setDraft(articleQuery.data);
    setSavedFingerprint(fingerprint(articleQuery.data));
    setError(undefined);
  }, [articleQuery.data]);

  const startNew = () => {
    if (dirty && !window.confirm(localize('com_workspace_site_discard_confirm'))) return;
    setSelectedId(undefined);
    setDraft(EMPTY_ARTICLE);
    setSavedFingerprint(fingerprint(EMPTY_ARTICLE));
    setMode('write');
    setError(undefined);
  };

  const chooseArticle = (id: string) => {
    if (id === selectedId) return;
    if (dirty && !window.confirm(localize('com_workspace_site_discard_confirm'))) return;
    setSelectedId(id);
  };

  const save = async (status: BlogStatus) => {
    const issue = validation(draft, status);
    if (issue) {
      setError(localize(validationKeys[issue as keyof typeof validationKeys]));
      return;
    }
    setError(undefined);
    try {
      const saved = await saveMutation.mutateAsync({
        id: draft.id,
        article: {
          slug: draft.slug.trim(),
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          category: draft.category.trim(),
          contentMarkdown: draft.contentMarkdown.trim(),
          tags: Array.from(new Set<string>(draft.tags.map((tag) => tag.trim()).filter(Boolean))),
          status,
          version: draft.version,
        },
      });
      setDraft(saved);
      setSelectedId(saved.id);
      setSavedFingerprint(fingerprint(saved));
    } catch {
      setError(localize('com_workspace_site_save_error'));
    }
  };

  const remove = async () => {
    if (!draft.id || !window.confirm(localize('com_workspace_site_delete_confirm'))) return;
    try {
      await deleteMutation.mutateAsync(draft.id);
      setSelectedId(undefined);
      setDraft(EMPTY_ARTICLE);
      setSavedFingerprint(fingerprint(EMPTY_ARTICLE));
      setError(undefined);
    } catch {
      setError(localize('com_workspace_site_save_error'));
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!imageAlt.trim()) {
      setError(localize('com_workspace_site_image_alt_required'));
      return;
    }
    try {
      const uploaded = await uploadMutation.mutateAsync(file);
      const textarea = markdownRef.current;
      const start = textarea?.selectionStart ?? draft.contentMarkdown.length;
      const end = textarea?.selectionEnd ?? start;
      const token = `![${imageAlt.replace(/[\\\]]/gu, '\\$&')}](${uploaded.markdownUrl})`;
      const contentMarkdown = `${draft.contentMarkdown.slice(0, start)}${token}${draft.contentMarkdown.slice(end)}`;
      setDraft((current) => ({ ...current, contentMarkdown }));
      setImageAlt('');
      setError(undefined);
    } catch {
      setError(localize('com_workspace_site_upload_error'));
    }
  };

  const loading = listQuery.isLoading || (Boolean(selectedId) && articleQuery.isLoading);

  return (
    <div className="site-blog-workbench">
      <aside className="site-blog-list">
        <header>
          <div>
            <span>{localize('com_workspace_site_articles')}</span>
            <strong>{articles.length}</strong>
          </div>
          <button
            type="button"
            onClick={startNew}
            disabled={pending}
            aria-label={localize('com_workspace_site_new_article')}
          >
            <Plus aria-hidden="true" />
          </button>
        </header>
        <nav aria-label={localize('com_workspace_site_articles')}>
          {articles.map((article) => (
            <button
              type="button"
              key={article.id}
              className={selectedId === article.id ? 'is-active' : ''}
              onClick={() => chooseArticle(article.id)}
            >
              <span>{article.title || localize('com_workspace_site_untitled_article')}</span>
              <small>
                <em className={article.status === 'published' ? 'is-live' : ''}>
                  {article.status === 'published'
                    ? localize('com_workspace_site_published')
                    : localize('com_workspace_site_draft')}
                </em>
                {articleDate(article.updatedAt)}
              </small>
            </button>
          ))}
        </nav>
        {!loading && articles.length === 0 ? (
          <div className="site-blog-empty">
            <FileText aria-hidden="true" />
            <strong>{localize('com_workspace_site_no_articles')}</strong>
            <span>{localize('com_workspace_site_no_articles_desc')}</span>
          </div>
        ) : null}
      </aside>

      <section className="site-blog-editor">
        <header className="site-blog-toolbar">
          <div className="site-mode-toggle">
            <button
              type="button"
              className={mode === 'write' ? 'is-active' : ''}
              onClick={() => setMode('write')}
            >
              <FileText aria-hidden="true" />
              {localize('com_workspace_site_write')}
            </button>
            <button
              type="button"
              className={mode === 'preview' ? 'is-active' : ''}
              onClick={() => setMode('preview')}
            >
              <Eye aria-hidden="true" />
              {localize('com_workspace_site_preview')}
            </button>
          </div>
          <div className="site-blog-actions">
            <span className={dirty ? 'is-dirty' : ''}>
              {pending ? (
                <LoaderCircle className="site-spin" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {dirty
                ? localize('com_workspace_site_unsaved')
                : localize('com_workspace_site_saved')}
            </span>
            {draft.id ? (
              <button
                className="is-danger"
                type="button"
                onClick={() => void remove()}
                disabled={pending}
                aria-label={localize('com_workspace_site_delete_article')}
              >
                <Trash2 aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save(draft.status)}
              disabled={pending || (!dirty && Boolean(draft.id))}
            >
              <Save aria-hidden="true" />
              {localize('com_workspace_site_save_draft')}
            </button>
            {draft.status === 'draft' ? (
              <button
                className="is-primary"
                type="button"
                onClick={() => void save('published')}
                disabled={pending}
              >
                <Send aria-hidden="true" />
                {localize('com_workspace_site_publish')}
              </button>
            ) : (
              <button type="button" onClick={() => void save('draft')} disabled={pending}>
                <RotateCcw aria-hidden="true" />
                {localize('com_workspace_site_unpublish')}
              </button>
            )}
          </div>
        </header>

        {error ? (
          <div className="site-inline-error" role="alert">
            {error}
          </div>
        ) : null}
        {loading ? <div className="site-blog-loading">{localize('com_ui_loading')}</div> : null}
        {!loading && mode === 'write' ? (
          <fieldset className="site-blog-form" disabled={pending}>
            <label className="site-blog-title">
              <span>{localize('com_workspace_site_article_title')}</span>
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                placeholder={localize('com_workspace_site_article_title_placeholder')}
              />
            </label>
            <div className="site-blog-meta">
              <label>
                <span>{localize('com_workspace_site_slug')}</span>
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, slug: event.target.value.toLowerCase() }))
                  }
                  placeholder="building-a-calm-workspace"
                />
              </label>
              <label>
                <span>{localize('com_workspace_site_category')}</span>
                <input
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>{localize('com_workspace_site_tags')}</span>
                <input
                  value={draft.tags.join(', ')}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, tags: event.target.value.split(',') }))
                  }
                  placeholder="Design, Agent"
                />
              </label>
            </div>
            <label className="site-blog-summary">
              <span>{localize('com_workspace_site_summary')}</span>
              <textarea
                rows={3}
                value={draft.summary}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, summary: event.target.value }))
                }
              />
            </label>
            <div className="site-image-tool">
              <ImagePlus aria-hidden="true" />
              <input
                value={imageAlt}
                onChange={(event) => setImageAlt(event.target.value)}
                placeholder={localize('com_workspace_site_image_alt')}
                aria-label={localize('com_workspace_site_image_alt')}
              />
              <label>
                <span>
                  {uploadMutation.isLoading
                    ? localize('com_workspace_site_uploading')
                    : localize('com_workspace_site_insert_image')}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={(event) => void upload(event.currentTarget.files?.[0])}
                />
              </label>
            </div>
            <label className="site-markdown-field">
              <span>{localize('com_workspace_site_markdown')}</span>
              <textarea
                ref={markdownRef}
                value={draft.contentMarkdown}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, contentMarkdown: event.target.value }))
                }
                placeholder={localize('com_workspace_site_markdown_placeholder')}
                spellCheck
              />
            </label>
          </fieldset>
        ) : null}
        {!loading && mode === 'preview' ? (
          <article className="site-blog-preview">
            <header>
              <span>{draft.category || localize('com_workspace_site_uncategorized')}</span>
              <h2>{draft.title || localize('com_workspace_site_untitled_article')}</h2>
              {draft.summary ? <p>{draft.summary}</p> : null}
            </header>
            <MarkdownLite
              content={draft.contentMarkdown || localize('com_workspace_site_preview_empty')}
            />
          </article>
        ) : null}
      </section>
    </div>
  );
}
