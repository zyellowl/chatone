import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import {
  ArrowLeft,
  BookOpenText,
  Check,
  ExternalLink,
  Globe2,
  Home,
  Lightbulb,
  LoaderCircle,
  MessageCircleMore,
  Save,
  Send,
} from 'lucide-react';
import type { JojooSection, PublicProfile } from '~/data-provider/Jojoo';
import {
  JojooHttpError,
  useJojooProfileQuery,
  usePublishJojooProfileMutation,
  useSaveJojooProfileMutation,
} from '~/data-provider/Jojoo';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { useLocalize } from '~/hooks';
import BlogEditor from './BlogEditor';
import ProfileEditor from './ProfileEditor';
import './site-studio.css';

const sections = [
  { id: 'home', icon: Home, title: 'com_workspace_site_home' },
  { id: 'blog', icon: BookOpenText, title: 'com_workspace_site_blog' },
  { id: 'chat', icon: MessageCircleMore, title: 'com_workspace_site_chat' },
  { id: 'thoughts', icon: Lightbulb, title: 'com_workspace_site_thoughts' },
] as const;

const descriptions = {
  home: 'com_workspace_site_home_desc',
  blog: 'com_workspace_site_blog_desc',
  chat: 'com_workspace_site_chat_desc',
  thoughts: 'com_workspace_site_thoughts_page_desc',
} as const;

function errorMessage(error: Error | null, localize: ReturnType<typeof useLocalize>): string {
  if (!error) return '';
  if (!(error instanceof JojooHttpError)) return localize('com_workspace_site_connection_error');
  if (error.status === 409) return localize('com_workspace_site_conflict_error');
  if (error.status === 422) return localize('com_workspace_site_validation_error');
  if (error.status === 401) return localize('com_workspace_site_auth_error');
  if (error.code === 'PAGES_DEPLOYMENT_FAILED') {
    return localize('com_workspace_site_deployment_error');
  }
  return localize('com_workspace_site_connection_error');
}

export default function SiteStudioPage() {
  const localize = useLocalize();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { section: sectionParam = 'home' } = useParams<{ section?: string }>();
  const section = sectionParam as JojooSection;
  const validSection = sections.some((item) => item.id === section);
  const profileQuery = useJojooProfileQuery();
  const saveMutation = useSaveJojooProfileMutation();
  const publishMutation = usePublishJojooProfileMutation();
  const [profile, setProfile] = useState<PublicProfile>();
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const [notice, setNotice] = useState('');
  const [localError, setLocalError] = useState<Error | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    const next = profileQuery.data.profile;
    setProfile(next);
    setSavedFingerprint(JSON.stringify(next));
    setNotice(
      profileQuery.data.publishedVersion === profileQuery.data.version
        ? localize('com_workspace_site_live')
        : localize('com_workspace_site_changes_pending'),
    );
  }, [localize, profileQuery.data]);

  const dirty = Boolean(profile && JSON.stringify(profile) !== savedFingerprint);
  const pending = saveMutation.isLoading || publishMutation.isLoading;
  const snapshot = profileQuery.data;
  const published = snapshot?.publishedVersion === snapshot?.version;
  const counts = useMemo(
    () => ({
      projects: profile?.projects.length ?? 0,
      experience: profile?.experience.length ?? 0,
      thoughts: profile?.notes?.length ?? 0,
    }),
    [profile],
  );

  if (!validSection) return <Navigate to="/workspace/site/home" replace />;

  const save = async (): Promise<number | undefined> => {
    if (!profile || !snapshot || pending) return undefined;
    setLocalError(null);
    setNotice(localize('com_workspace_site_saving'));
    try {
      const saved = await saveMutation.mutateAsync({
        profile,
        expectedVersion: snapshot.version,
      });
      setProfile(saved.profile);
      setSavedFingerprint(JSON.stringify(saved.profile));
      setNotice(localize('com_workspace_site_saved'));
      return saved.version;
    } catch (error) {
      setLocalError(error instanceof Error ? error : new Error('JOJOO_SAVE_FAILED'));
      setNotice(localize('com_workspace_site_save_failed'));
      return undefined;
    }
  };

  const publish = async () => {
    if (!snapshot || pending) return;
    let version = snapshot.version;
    if (dirty) {
      const savedVersion = await save();
      if (!savedVersion) return;
      version = savedVersion;
    }
    setLocalError(null);
    setNotice(localize('com_workspace_site_publishing'));
    try {
      const result = await publishMutation.mutateAsync(version);
      setProfile(result.profile);
      setSavedFingerprint(JSON.stringify(result.profile));
      setNotice(
        result.deployment?.status === 'updating'
          ? localize('com_workspace_site_updating')
          : localize('com_workspace_site_published_to_domain'),
      );
    } catch (error) {
      const requestError = error instanceof Error ? error : new Error('JOJOO_PUBLISH_FAILED');
      setLocalError(requestError);
      setNotice(localize('com_workspace_site_publish_failed'));
      if (requestError instanceof JojooHttpError && requestError.localPublished) {
        await profileQuery.refetch();
      }
    }
  };

  return (
    <main className="site-studio">
      <header className="site-studio-topbar">
        <div className="site-studio-breadcrumb">
          {isSmallScreen ? <OpenSidebar /> : null}
          <Link to="/workspace" aria-label={localize('com_workspace_site_back')}>
            <ArrowLeft aria-hidden="true" />
          </Link>
          <span className="site-studio-mark">
            <Globe2 aria-hidden="true" />
          </span>
          <div>
            <strong>{localize('com_workspace_site_domain')}</strong>
            <small>{localize('com_workspace_site_content_studio')}</small>
          </div>
        </div>
        <div className="site-studio-top-actions">
          {section !== 'blog' ? (
            <span className={dirty ? 'site-save-state is-dirty' : 'site-save-state'}>
              {pending ? (
                <LoaderCircle className="site-spin" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {dirty ? localize('com_workspace_site_unsaved') : notice}
            </span>
          ) : null}
          <a className="site-view-button" href="https://jojoo.cc/" target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            {localize('com_workspace_view_site')}
          </a>
          {section !== 'blog' ? (
            <>
              <button
                className="site-save-button"
                type="button"
                onClick={() => void save()}
                disabled={pending || !dirty}
              >
                <Save aria-hidden="true" />
                {localize('com_workspace_site_save')}
              </button>
              <button
                className="site-publish-button"
                type="button"
                onClick={() => void publish()}
                disabled={pending}
              >
                <Send aria-hidden="true" />
                {localize('com_workspace_site_publish')}
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="site-studio-layout">
        <aside className="site-studio-nav">
          <nav aria-label={localize('com_workspace_site_sections')}>
            {sections.map(({ id, icon: Icon, title }) => (
              <Link
                key={id}
                to={`/workspace/site/${id}`}
                aria-current={section === id ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{localize(title)}</span>
              </Link>
            ))}
          </nav>
          <div className="site-version-card">
            <span className={published ? 'is-live' : ''}>
              <i />
              {published
                ? localize('com_workspace_site_live')
                : localize('com_workspace_site_draft_changes')}
            </span>
            <strong>
              {localize('com_workspace_site_version', { 0: snapshot?.version ?? '—' })}
            </strong>
            <small>
              {localize('com_workspace_site_public_version', {
                0: snapshot?.publishedVersion ?? '—',
              })}
            </small>
          </div>
          <div className="site-counts">
            <span>
              <strong>{counts.projects}</strong>
              {localize('com_workspace_site_projects')}
            </span>
            <span>
              <strong>{counts.experience}</strong>
              {localize('com_workspace_site_experience')}
            </span>
            <span>
              <strong>{counts.thoughts}</strong>
              {localize('com_workspace_site_thoughts')}
            </span>
          </div>
        </aside>

        <section className="site-studio-content">
          <header className="site-content-heading">
            <p>{localize('com_workspace_site_content_label')}</p>
            <h1>{localize(sections.find((item) => item.id === section)!.title)}</h1>
            <span>{localize(descriptions[section])}</span>
          </header>

          {localError || profileQuery.error ? (
            <div className="site-inline-error" role="alert">
              {errorMessage(localError ?? (profileQuery.error as Error), localize)}
            </div>
          ) : null}
          {profileQuery.isLoading ? (
            <div className="site-loading-panel">
              <LoaderCircle className="site-spin" aria-hidden="true" />
              {localize('com_workspace_site_loading')}
            </div>
          ) : null}
          {!profileQuery.isLoading && profile && section !== 'blog' ? (
            <ProfileEditor
              profile={profile}
              section={section}
              disabled={pending}
              onChange={setProfile}
            />
          ) : null}
          {section === 'blog' ? <BlogEditor /> : null}
        </section>
      </div>
    </main>
  );
}
