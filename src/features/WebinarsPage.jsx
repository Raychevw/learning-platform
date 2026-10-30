import { useState } from 'react';

function statusLabel(status) {
  if (status === 'LIVE') return { label: 'В ефірі', cls: 'done' };
  if (status === 'FINISHED') return { label: 'Завершено', cls: 'pending' };
  return { label: 'Заплановано', cls: 'pending' };
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WebinarsPage({
  webinars,
  userRole,
  courses,
  newWebinarForm,
  setNewWebinarForm,
  onCreate,
  onChangeStatus,
  onDelete,
  onUpdateMeeting,
}) {
  const [linkDrafts, setLinkDrafts] = useState({});
  const isTeacher = userRole === 'teacher' || userRole === 'admin';
  const list = [...webinars].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  );

  const draftFor = (webinar) => linkDrafts[webinar.id] ?? webinar.meetingUrl ?? '';

  const saveLink = (webinar) => {
    onUpdateMeeting(webinar.id, draftFor(webinar));
  };

  return (
    <div>
      <div className="section-header-row">
        <h2 className="section-title">Онлайн-заняття</h2>
        <span className="dash-hint">Посилання на Google Meet / Zoom / Teams</span>
      </div>

      {isTeacher && (
        <div className="studevo-card" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
            Запланувати заняття
          </h3>
          <form onSubmit={onCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 1fr', gap: '12px' }}>
              <div className="form-group-field">
                <label>Дисципліна</label>
                <select
                  className="input-studevo-control"
                  value={newWebinarForm.courseId}
                  onChange={(e) => setNewWebinarForm({ ...newWebinarForm, courseId: e.target.value })}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-field">
                <label>Назва заняття</label>
                <input
                  type="text"
                  className="input-studevo-control"
                  value={newWebinarForm.title}
                  onChange={(e) => setNewWebinarForm({ ...newWebinarForm, title: e.target.value })}
                  placeholder="напр. Онлайн-консультація до лабораторної"
                  required
                />
              </div>
              <div className="form-group-field">
                <label>Дата й час</label>
                <input
                  type="datetime-local"
                  className="input-studevo-control"
                  value={newWebinarForm.scheduledAt}
                  onChange={(e) => setNewWebinarForm({ ...newWebinarForm, scheduledAt: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-group-field" style={{ marginTop: '12px' }}>
              <label>Посилання на конференцію</label>
              <input
                type="url"
                className="input-studevo-control"
                value={newWebinarForm.meetingUrl || ''}
                onChange={(e) => setNewWebinarForm({ ...newWebinarForm, meetingUrl: e.target.value })}
                placeholder="https://meet.google.com/... або https://zoom.us/j/..."
              />
            </div>
            <button type="submit" className="btn-studevo-primary" style={{ marginTop: '12px' }}>
              Додати до розкладу
            </button>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="studevo-card">
          <p className="dash-empty">Занять ще немає.</p>
        </div>
      ) : (
        <div className="webinar-list">
          {list.map((webinar) => {
            const status = statusLabel(webinar.status);
            const hasLink = Boolean(webinar.meetingUrl);
            return (
              <div key={webinar.id} className="webinar-card">
                <div className="webinar-card-head">
                  <span className={`dash-status ${status.cls}`}>{status.label}</span>
                  <span className="dash-hint">{formatDate(webinar.scheduledAt)}</span>
                </div>

                <div className="webinar-card-title">{webinar.title}</div>
                <div className="dash-hint">
                  {webinar.courseTitle} • {webinar.instructor || 'викладач'}
                </div>

                {hasLink ? (
                  <a
                    className="btn-studevo-primary webinar-join"
                    href={webinar.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Приєднатися
                  </a>
                ) : (
                  <div className="dash-hint" style={{ marginTop: '10px' }}>
                    Посилання на конференцію ще не додано.
                  </div>
                )}

                {webinar.recordingAvailable && (
                  <div className="dash-hint" style={{ marginTop: '6px' }}>
                    Доступний запис лекції.
                  </div>
                )}

                {isTeacher && (
                  <div className="webinar-teacher-tools">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        className="input-studevo-control"
                        placeholder="https://meet.google.com/..."
                        value={draftFor(webinar)}
                        onChange={(e) =>
                          setLinkDrafts((prev) => ({ ...prev, [webinar.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-studevo-outline"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={() => saveLink(webinar)}
                      >
                        Зберегти посилання
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {webinar.status !== 'LIVE' ? (
                        <button
                          type="button"
                          className="btn-studevo-primary"
                          style={{ padding: '5px 10px', fontSize: '11.5px' }}
                          onClick={() => onChangeStatus(webinar.id, 'LIVE')}
                        >
                          Почати
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-studevo-secondary"
                          style={{ padding: '5px 10px', fontSize: '11.5px' }}
                          onClick={() => onChangeStatus(webinar.id, 'FINISHED')}
                        >
                          Завершити
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-studevo-outline"
                        style={{ padding: '5px 10px', fontSize: '11.5px' }}
                        onClick={() => onDelete(webinar.id)}
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
