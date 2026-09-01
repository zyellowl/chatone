import { Plus, Trash2 } from 'lucide-react';
import type {
  ProfileEducation,
  ProfileExperience,
  ProfileNote,
  ProfileProject,
  ProfileSource,
  PublicProfile,
} from '~/data-provider/Jojoo';
import { useLocalize } from '~/hooks';

interface ProfileEditorProps {
  profile: PublicProfile;
  section: 'home' | 'chat' | 'thoughts';
  disabled: boolean;
  onChange: (profile: PublicProfile) => void;
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  value,
  onChange,
  rows,
  wide = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={wide ? 'site-field is-wide' : 'site-field'}>
      <span>{label}</span>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="site-editor-card">
      <header>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function EvidenceFields({
  value,
  onChange,
}: {
  value: ProfileSource;
  onChange: (value: ProfileSource) => void;
}) {
  const localize = useLocalize();
  return (
    <div className="site-evidence-fields">
      <Field
        label={localize('com_workspace_site_sources')}
        value={value.sources.join('\n')}
        rows={2}
        onChange={(sources) => onChange({ ...value, sources: splitLines(sources) })}
      />
      <label className="site-attested">
        <input
          type="checkbox"
          checked={value.ownerAttested === true}
          onChange={(event) =>
            onChange({ ...value, ownerAttested: event.target.checked ? true : undefined })
          }
        />
        <span>{localize('com_workspace_site_attested')}</span>
      </label>
    </div>
  );
}

function Repeater({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const localize = useLocalize();
  return (
    <article className="site-repeat-card">
      <div className="site-repeat-heading">
        <strong>{title}</strong>
        <button type="button" onClick={onRemove} aria-label={localize('com_workspace_site_remove')}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>
      {children}
    </article>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="site-add-button" type="button" onClick={onClick}>
      <Plus aria-hidden="true" />
      {label}
    </button>
  );
}

export default function ProfileEditor({
  profile,
  section,
  disabled,
  onChange,
}: ProfileEditorProps) {
  const localize = useLocalize();
  const update = <Key extends keyof PublicProfile>(key: Key, value: PublicProfile[Key]) =>
    onChange({ ...profile, [key]: value });

  if (section === 'chat') {
    const chat = profile.chat ?? {
      welcomeTitle: '',
      welcomeBody: '',
      starterPrompts: [],
      enabledTopics: [],
    };
    const topics = [
      ['overview', localize('com_workspace_site_topic_overview')],
      ['experience', localize('com_workspace_site_topic_experience')],
      ['project', localize('com_workspace_site_topic_projects')],
      ['skill', localize('com_workspace_site_topic_skills')],
      ['education', localize('com_workspace_site_topic_education')],
      ['note', localize('com_workspace_site_topic_thoughts')],
    ] as const;
    return (
      <fieldset className="site-editor-stack" disabled={disabled}>
        <Card
          title={localize('com_workspace_site_chat_opening')}
          description={localize('com_workspace_site_chat_opening_desc')}
        >
          <div className="site-field-grid">
            <Field
              wide
              label={localize('com_workspace_site_welcome_title')}
              value={chat.welcomeTitle}
              onChange={(welcomeTitle) => update('chat', { ...chat, welcomeTitle })}
            />
            <Field
              wide
              rows={4}
              label={localize('com_workspace_site_welcome_body')}
              value={chat.welcomeBody}
              onChange={(welcomeBody) => update('chat', { ...chat, welcomeBody })}
            />
            <Field
              wide
              rows={6}
              label={localize('com_workspace_site_starters')}
              value={chat.starterPrompts.join('\n')}
              onChange={(value) => update('chat', { ...chat, starterPrompts: splitLines(value) })}
            />
          </div>
        </Card>
        <Card
          title={localize('com_workspace_site_knowledge')}
          description={localize('com_workspace_site_knowledge_desc')}
        >
          <div className="site-topic-grid">
            {topics.map(([id, label]) => {
              const checked = chat.enabledTopics.includes(id);
              return (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      update('chat', {
                        ...chat,
                        enabledTopics: checked
                          ? chat.enabledTopics.filter((topic) => topic !== id)
                          : [...chat.enabledTopics, id],
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
          <p className="site-privacy-note">{localize('com_workspace_site_privacy_note')}</p>
        </Card>
      </fieldset>
    );
  }

  if (section === 'thoughts') {
    const notes = profile.notes ?? [];
    return (
      <fieldset className="site-editor-stack" disabled={disabled}>
        <Card
          title={localize('com_workspace_site_thoughts_title')}
          description={localize('com_workspace_site_thoughts_desc')}
        >
          <div className="site-repeat-list">
            {notes.map((note, index) => (
              <Repeater
                key={`${index}-${note.title}`}
                title={note.title || localize('com_workspace_site_untitled_thought')}
                onRemove={() =>
                  update(
                    'notes',
                    notes.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <div className="site-field-grid">
                  <Field
                    wide
                    label={localize('com_workspace_site_title')}
                    value={note.title}
                    onChange={(title) =>
                      update(
                        'notes',
                        notes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title } : item,
                        ),
                      )
                    }
                  />
                  <Field
                    wide
                    rows={4}
                    label={localize('com_workspace_site_summary')}
                    value={note.summary}
                    onChange={(summary) =>
                      update(
                        'notes',
                        notes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, summary } : item,
                        ),
                      )
                    }
                  />
                  <Field
                    wide
                    rows={3}
                    label={localize('com_workspace_site_evidence')}
                    value={note.evidence.join('\n')}
                    onChange={(value) =>
                      update(
                        'notes',
                        notes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, evidence: splitLines(value) } : item,
                        ),
                      )
                    }
                  />
                </div>
                <EvidenceFields
                  value={note}
                  onChange={(source) =>
                    update(
                      'notes',
                      notes.map((item, itemIndex) =>
                        itemIndex === index ? ({ ...item, ...source } as ProfileNote) : item,
                      ),
                    )
                  }
                />
              </Repeater>
            ))}
          </div>
          <AddButton
            label={localize('com_workspace_site_add_thought')}
            onClick={() =>
              update('notes', [
                ...notes,
                { title: '', summary: '', evidence: [], sources: [], ownerAttested: true },
              ])
            }
          />
        </Card>
      </fieldset>
    );
  }

  const skills = profile.skillGroups ?? [];
  const education = profile.education ?? [];
  return (
    <fieldset className="site-editor-stack" disabled={disabled}>
      <Card
        title={localize('com_workspace_site_identity')}
        description={localize('com_workspace_site_identity_desc')}
      >
        <div className="site-field-grid">
          <Field
            label={localize('com_workspace_site_display_name')}
            value={profile.displayName}
            onChange={(value) => update('displayName', value)}
          />
          <Field
            label={localize('com_workspace_site_headline')}
            value={profile.headline}
            onChange={(value) => update('headline', value)}
          />
          <Field
            wide
            rows={4}
            label={localize('com_workspace_site_introduction')}
            value={profile.introduction}
            onChange={(value) => update('introduction', value)}
          />
          <Field
            wide
            label={localize('com_workspace_site_avatar')}
            value={profile.avatarUrl ?? ''}
            placeholder="/assets/avatar.webp"
            onChange={(value) => update('avatarUrl', value || undefined)}
          />
          <Field
            wide
            rows={3}
            label={localize('com_workspace_site_focus')}
            value={profile.focusAreas.join('\n')}
            onChange={(value) => update('focusAreas', splitLines(value))}
          />
        </div>
      </Card>

      <Card title={localize('com_workspace_site_skills')}>
        <div className="site-repeat-list is-compact">
          {skills.map((group, index) => (
            <Repeater
              key={`${index}-${group.label}`}
              title={group.label || localize('com_workspace_site_untitled_group')}
              onRemove={() =>
                update(
                  'skillGroups',
                  skills.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <div className="site-field-grid">
                <Field
                  label={localize('com_workspace_site_group_name')}
                  value={group.label}
                  onChange={(label) =>
                    update(
                      'skillGroups',
                      skills.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label } : item,
                      ),
                    )
                  }
                />
                <Field
                  rows={3}
                  label={localize('com_workspace_site_group_items')}
                  value={group.items.join('\n')}
                  onChange={(value) =>
                    update(
                      'skillGroups',
                      skills.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, items: splitLines(value) } : item,
                      ),
                    )
                  }
                />
              </div>
            </Repeater>
          ))}
        </div>
        <AddButton
          label={localize('com_workspace_site_add_skill_group')}
          onClick={() => update('skillGroups', [...skills, { label: '', items: [] }])}
        />
      </Card>

      <Card title={localize('com_workspace_site_experience')}>
        <div className="site-repeat-list">
          {profile.experience.map((item, index) => (
            <Repeater
              key={`${index}-${item.organization}`}
              title={item.organization || localize('com_workspace_site_untitled_experience')}
              onRemove={() =>
                update(
                  'experience',
                  profile.experience.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <div className="site-field-grid">
                <Field
                  label={localize('com_workspace_site_organization')}
                  value={item.organization}
                  onChange={(organization) =>
                    update(
                      'experience',
                      profile.experience.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, organization } : value,
                      ),
                    )
                  }
                />
                <Field
                  label={localize('com_workspace_site_role')}
                  value={item.role}
                  onChange={(role) =>
                    update(
                      'experience',
                      profile.experience.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, role } : value,
                      ),
                    )
                  }
                />
                <Field
                  label={localize('com_workspace_site_period')}
                  value={item.period}
                  onChange={(period) =>
                    update(
                      'experience',
                      profile.experience.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, period } : value,
                      ),
                    )
                  }
                />
                <Field
                  wide
                  rows={3}
                  label={localize('com_workspace_site_summary')}
                  value={item.summary}
                  onChange={(summary) =>
                    update(
                      'experience',
                      profile.experience.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, summary } : value,
                      ),
                    )
                  }
                />
              </div>
              <EvidenceFields
                value={item}
                onChange={(source) =>
                  update(
                    'experience',
                    profile.experience.map((value, itemIndex) =>
                      itemIndex === index ? ({ ...value, ...source } as ProfileExperience) : value,
                    ),
                  )
                }
              />
            </Repeater>
          ))}
        </div>
        <AddButton
          label={localize('com_workspace_site_add_experience')}
          onClick={() =>
            update('experience', [
              ...profile.experience,
              {
                organization: '',
                role: '',
                period: '',
                summary: '',
                sources: [],
                ownerAttested: true,
              },
            ])
          }
        />
      </Card>

      <Card title={localize('com_workspace_site_projects')}>
        <div className="site-repeat-list">
          {profile.projects.map((item, index) => (
            <Repeater
              key={`${index}-${item.name}`}
              title={item.name || localize('com_workspace_site_untitled_project')}
              onRemove={() =>
                update(
                  'projects',
                  profile.projects.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <div className="site-field-grid">
                <Field
                  label={localize('com_workspace_site_project_name')}
                  value={item.name}
                  onChange={(name) =>
                    update(
                      'projects',
                      profile.projects.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, name } : value,
                      ),
                    )
                  }
                />
                <Field
                  label={localize('com_workspace_site_cover')}
                  value={item.coverImageUrl ?? ''}
                  onChange={(coverImageUrl) =>
                    update(
                      'projects',
                      profile.projects.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, coverImageUrl: coverImageUrl || undefined }
                          : value,
                      ),
                    )
                  }
                />
                <Field
                  wide
                  rows={3}
                  label={localize('com_workspace_site_summary')}
                  value={item.summary}
                  onChange={(summary) =>
                    update(
                      'projects',
                      profile.projects.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, summary } : value,
                      ),
                    )
                  }
                />
                <Field
                  wide
                  rows={3}
                  label={localize('com_workspace_site_evidence')}
                  value={item.evidence.join('\n')}
                  onChange={(value) =>
                    update(
                      'projects',
                      profile.projects.map((project, itemIndex) =>
                        itemIndex === index ? { ...project, evidence: splitLines(value) } : project,
                      ),
                    )
                  }
                />
              </div>
              <EvidenceFields
                value={item}
                onChange={(source) =>
                  update(
                    'projects',
                    profile.projects.map((value, itemIndex) =>
                      itemIndex === index ? ({ ...value, ...source } as ProfileProject) : value,
                    ),
                  )
                }
              />
            </Repeater>
          ))}
        </div>
        <AddButton
          label={localize('com_workspace_site_add_project')}
          onClick={() =>
            update('projects', [
              ...profile.projects,
              { name: '', summary: '', evidence: [], sources: [], ownerAttested: true },
            ])
          }
        />
      </Card>

      <Card title={localize('com_workspace_site_education')}>
        <div className="site-repeat-list">
          {education.map((item, index) => (
            <Repeater
              key={`${index}-${item.institution}`}
              title={item.institution || localize('com_workspace_site_untitled_education')}
              onRemove={() =>
                update(
                  'education',
                  education.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <div className="site-field-grid">
                <Field
                  label={localize('com_workspace_site_institution')}
                  value={item.institution}
                  onChange={(institution) =>
                    update(
                      'education',
                      education.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, institution } : value,
                      ),
                    )
                  }
                />
                <Field
                  label={localize('com_workspace_site_credential')}
                  value={item.credential}
                  onChange={(credential) =>
                    update(
                      'education',
                      education.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, credential } : value,
                      ),
                    )
                  }
                />
                <Field
                  label={localize('com_workspace_site_field')}
                  value={item.field ?? ''}
                  onChange={(field) =>
                    update(
                      'education',
                      education.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, field: field || undefined } : value,
                      ),
                    )
                  }
                />
                <Field
                  label={localize('com_workspace_site_period')}
                  value={item.period}
                  onChange={(period) =>
                    update(
                      'education',
                      education.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, period } : value,
                      ),
                    )
                  }
                />
                <Field
                  wide
                  rows={3}
                  label={localize('com_workspace_site_summary')}
                  value={item.summary ?? ''}
                  onChange={(summary) =>
                    update(
                      'education',
                      education.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, summary: summary || undefined } : value,
                      ),
                    )
                  }
                />
              </div>
              <EvidenceFields
                value={item}
                onChange={(source) =>
                  update(
                    'education',
                    education.map((value, itemIndex) =>
                      itemIndex === index ? ({ ...value, ...source } as ProfileEducation) : value,
                    ),
                  )
                }
              />
            </Repeater>
          ))}
        </div>
        <AddButton
          label={localize('com_workspace_site_add_education')}
          onClick={() =>
            update('education', [
              ...education,
              { institution: '', credential: '', period: '', sources: [], ownerAttested: true },
            ])
          }
        />
      </Card>

      <Card title={localize('com_workspace_site_links')}>
        <div className="site-link-list">
          {profile.links.map((link, index) => (
            <div key={`${index}-${link.label}`}>
              <Field
                label={localize('com_workspace_site_link_label')}
                value={link.label}
                onChange={(label) =>
                  update(
                    'links',
                    profile.links.map((value, itemIndex) =>
                      itemIndex === index ? { ...value, label } : value,
                    ),
                  )
                }
              />
              <Field
                label={localize('com_workspace_site_link_url')}
                value={link.url}
                onChange={(url) =>
                  update(
                    'links',
                    profile.links.map((value, itemIndex) =>
                      itemIndex === index ? { ...value, url } : value,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    'links',
                    profile.links.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                aria-label={localize('com_workspace_site_remove')}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <AddButton
          label={localize('com_workspace_site_add_link')}
          onClick={() => update('links', [...profile.links, { label: '', url: 'https://' }])}
        />
      </Card>
    </fieldset>
  );
}
