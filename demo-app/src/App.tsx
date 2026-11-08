import React, { useEffect, useRef, useState } from 'react';
import { OrderStatus as S } from '@/lib/order-status-type';
import { getStatusLabel } from '@/lib/orderStatus';
import {
  blockers,
  createOrder,
  initialOrders,
  money,
  record,
  targets,
  transition,
  type DemoOrder,
} from './demo';
import {
  canDispatch,
  departureBlockers,
  GUIDE_ORDER_ID,
  guideIndex,
  guideSteps,
  nextStatus,
} from './journey';
import { Bench } from './Bench';

type Route = '/' | '/guided' | '/demo';
const routeOf = (): Route =>
  location.hash === '#/guided' ? '/guided' : location.hash === '#/demo' ? '/demo' : '/';
const labelFor = (status: S) =>
  status === S.IN_TRANSIT
    ? 'יציאה למשלוח'
    : status === S.COMPLETED
      ? 'השלמת המסירה'
      : status === S.READY
        ? 'מעבר למוכן'
        : status === S.PROCESSING
          ? 'מעבר לטיפול'
          : `מעבר ל${getStatusLabel(status)}`;

export default function App() {
  const [route, setRoute] = useState<Route>(routeOf);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedId, setSelectedId] = useState(GUIDE_ORDER_ID);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [reasonAction, setReasonAction] = useState<S>();
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileView, setMobileView] = useState<'detail' | 'queue'>('detail');
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const actionsTrigger = useRef<HTMLElement | null>(null);
  const guided = route === '/guided';
  const selected = orders.find((order) => order.id === (guided ? GUIDE_ORDER_ID : selectedId))!;
  const index = guideIndex(selected);
  const guide = guideSteps[index]!;
  const next = nextStatus(selected);
  const terminal = selected.status === S.COMPLETED || selected.status === S.CANCELLED;
  const nextErrors = next ? blockers(selected, next, '') : [];
  const active = orders.filter(
    (order) => order.status !== S.COMPLETED && order.status !== S.CANCELLED,
  );
  const shown = orders.filter(
    (order) =>
      `${order.customerName} ${order.product} ${order.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'all' || order.status === filter),
  );

  useEffect(() => {
    const change = () => {
      setRoute(routeOf());
      setMobileView('detail');
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    pageTitle.current?.focus();
  }, [route]);

  function reset() {
    setOrders(initialOrders());
    setSelectedId(GUIDE_ORDER_ID);
    setQuery('');
    setFilter('all');
    setReasonAction(undefined);
    setReason('');
    setNotice('נתוני ההדגמה אופסו');
    setMobileView('detail');
  }
  function startGuide() {
    reset();
    location.hash = '/guided';
  }
  function update(order: DemoOrder) {
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)));
  }
  function edit(patch: Partial<DemoOrder>, label: string) {
    update({ ...selected, ...patch, history: [...selected.history, record(label)] });
    setNotice(label);
  }
  function changeStatus(status: S, explanation = '') {
    update(transition(selected, status, explanation));
    setReasonAction(undefined);
    setReason('');
    setNotice(`הסטטוס עודכן: ${getStatusLabel(status)}`);
  }
  function closeCreate() {
    setCreating(false);
    requestAnimationFrame(() => createTrigger.current?.focus());
  }
  function closeReason() {
    setReasonAction(undefined);
    setReason('');
    requestAnimationFrame(() => (actionsTrigger.current || pageTitle.current)?.focus());
  }
  function exploreAndCreate() {
    setSelectedId(GUIDE_ORDER_ID);
    location.hash = '/demo';
    setCreating(true);
  }

  const paymentButton = (
    <button
      className={guided && guide.field === 'payment' ? 'primary' : 'secondary'}
      disabled={terminal || selected.paymentStatus === 'PAID'}
      onClick={() =>
        edit(
          { paidAmountCents: selected.totalCents, paymentStatus: 'PAID' },
          'סומן תשלום מלא בדמו בלבד',
        )
      }
    >
      סימון תשלום בדמו
    </button>
  );

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        דלגו לתוכן
      </a>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="רצף מבית OrdeX — דף הבית">
          <img src="./resources/logo.png" width="108" height="30" alt="רצף" />
          <span>מבית OrdeX</span>
        </a>
        <nav aria-label="ניווט ראשי">
          {route === '/' ? (
            <a className="text-link" href="#/demo">
              התנסות חופשית
            </a>
          ) : (
            <>
              <a className="text-link" href={guided ? '#/demo' : '#/guided'}>
                {guided ? 'לצאת להתנסות חופשית' : 'הדגמה מודרכת'}
              </a>
              <button className="quiet" onClick={reset}>
                איפוס הדמו
              </button>
            </>
          )}
        </nav>
      </header>
      <div className="demo-note">סביבת הדגמה · נתונים פיקטיביים בלבד · השינויים מתאפסים ברענון</div>

      {route === '/' ? (
        <main id="main-content" tabIndex={-1} className="landing">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">פחות חוסר ודאות. יותר רצף בעבודה.</p>
              <h1 ref={pageTitle} tabIndex={-1}>
                כל הזמנה.
                <br />
                מהתחלה עד הסוף.
              </h1>
              <p className="hero-description">
                רואים מה מוכן, מבינים מה חסר ומתקדמים למסירה. הזמנה לא יוצאת לפני שהפריטים, המועד
                והתשלום במקום.
              </p>
              <div className="hero-actions">
                <button className="primary" onClick={startGuide}>
                  להדגמה המודרכת
                </button>
                <a href="#/demo" className="secondary">
                  לנסות בעצמי
                </a>
              </div>
              <p className="microcopy">כמה פעולות קצרות · בלי הרשמה · בלי חיוב</p>
            </div>
            <div className="hero-figure">
              <p className="figure-kicker">ככה הזמנה עוברת ברצף</p>
              <Bench order={orders.find((order) => order.id === GUIDE_ORDER_ID)!} />
              <p className="figure-footnote">בהדגמה, כל פעולה שתעשו תופיע גם על המסוע.</p>
            </div>
          </section>
          <section className="benefits" aria-label="מה תנסו בהדגמה">
            <article>
              <span className="step-number">01</span>
              <h2>יודעים מה חסר</h2>
              <p>פריטים שטרם הוכנו? תאריך שלא נקבע? כל חסם מקבל הסבר ברור.</p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h2>מתקדמים בזמן הנכון</h2>
              <p>תשלום ומועד נבדקים לפני היציאה, כדי שהשלב הבא יהיה החלטה ברורה.</p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h2>שומרים את התמונה המלאה</h2>
              <p>מההכנה ועד המסירה — היסטוריית הפעולות מציגה את הדרך שעברה ההזמנה.</p>
            </article>
          </section>
          <section className="landing-end">
            <div>
              <h2>נסו את התהליך על הזמנה אחת.</h2>
              <p>תכינו פריטים, תקבעו אספקה ותראו מתי המחסום נפתח.</p>
            </div>
            <button className="primary" onClick={startGuide}>
              מתחילים בהזמנה
            </button>
          </section>
        </main>
      ) : (
        <main id="main-content" tabIndex={-1} className={`workspace ${guided ? 'guided' : 'free'}`}>
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">{guided ? 'הדגמה מודרכת' : 'התנסות חופשית'}</p>
              <h1 ref={pageTitle} tabIndex={-1}>
                {guided ? 'מהזמנה חדשה למסירה' : 'כל ההזמנות, בתמונה אחת.'}
              </h1>
            </div>
            {!guided && (
              <button ref={createTrigger} className="primary" onClick={() => setCreating(true)}>
                הזמנת הדגמה חדשה
              </button>
            )}
          </div>
          <div className="metrics" aria-label="סיכום הזמנות">
            <span>
              <strong>{active.length}</strong> פעילות
            </span>
            <span data-testid="dispatch-count">
              <strong>{orders.filter(canDispatch).length}</strong> מוכנות ליציאה
            </span>
            <span>
              <strong>
                {money(
                  active.reduce((sum, order) => sum + order.totalCents - order.paidAmountCents, 0),
                )}
              </strong>{' '}
              יתרה בדמו
            </span>
          </div>
          {guided && (
            <section
              className={`coach ${index === 6 ? 'coach-done' : ''}`}
              aria-label="הנחיות ההדגמה"
            >
              <div className="coach-meta">
                <span>
                  שלב {index + 1} מתוך {guideSteps.length}
                </span>
                <span>כל פעולה מעדכנת גם את המסוע</span>
              </div>
              <h2 aria-live="polite">{guide.title}</h2>
              <p>{guide.body}</p>
              <div
                className="guide-progress"
                role="progressbar"
                aria-label="התקדמות בהדרכה"
                aria-valuemin={0}
                aria-valuemax={7}
                aria-valuenow={index + 1}
              >
                {guideSteps.map((step, n) => (
                  <span key={step.key} data-complete={n <= index} />
                ))}
              </div>
            </section>
          )}
          {!guided && (
            <div className="mobile-tabs" role="group" aria-label="תצוגת הזמנות">
              <button
                aria-pressed={mobileView === 'detail'}
                onClick={() => setMobileView('detail')}
              >
                ההזמנה הנבחרת
              </button>
              <button aria-pressed={mobileView === 'queue'} onClick={() => setMobileView('queue')}>
                כל ההזמנות ({orders.length})
              </button>
            </div>
          )}
          <div className="workspace-grid">
            {!guided && (
              <aside
                className={`queue ${mobileView === 'queue' ? 'mobile-visible' : ''}`}
                aria-label="תור ההזמנות"
              >
                <h2>תור ההזמנות</h2>
                <label>
                  חיפוש
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="לקוח, מוצר או מספר הזמנה"
                  />
                </label>
                <label>
                  סטטוס
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option value="all">הכול</option>
                    {[
                      S.RECEIVED,
                      S.PROCESSING,
                      S.READY,
                      S.IN_TRANSIT,
                      S.INSTALLATION,
                      S.COMPLETED,
                      S.ON_HOLD,
                      S.CANCELLED,
                    ].map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="order-list">
                  {shown.map((order) => (
                    <button
                      className="order-row"
                      aria-pressed={selectedId === order.id}
                      key={order.id}
                      onClick={() => {
                        setSelectedId(order.id);
                        setMobileView('detail');
                        setReasonAction(undefined);
                        setReason('');
                        setNotice('');
                      }}
                    >
                      <span className="order-row-heading">
                        <strong>{order.customerName}</strong>
                        <span className={`status status-${order.status}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </span>
                      <span>{order.product}</span>
                      <span className="order-row-heading">
                        <bdi>{order.id}</bdi>
                        <strong>{money(order.totalCents)}</strong>
                      </span>
                      {order.status !== S.COMPLETED && order.status !== S.CANCELLED && (
                        <small>
                          {canDispatch(order)
                            ? 'כל תנאי היציאה הושלמו'
                            : order.status === S.ON_HOLD
                              ? 'ממתינה לחידוש טיפול'
                              : order.items.some((item) => item.allocationStatus !== 'ALLOCATED')
                                ? 'הפריטים טרם הוכנו'
                                : !order.scheduledAt
                                  ? 'ללא מועד אספקה'
                                  : departureBlockers(order).length
                                    ? 'חסר תשלום מלא'
                                    : 'אפשר להתקדם לשלב הבא'}
                        </small>
                      )}
                    </button>
                  ))}
                  {!shown.length && (
                    <p className="empty">לא נמצאו הזמנות. נסו חיפוש או סטטוס אחר.</p>
                  )}
                </div>
              </aside>
            )}
            <div
              className={`order-work ${!guided && mobileView === 'queue' ? 'mobile-hidden' : ''}`}
            >
              <div className="order-top">
                <div>
                  <p className="eyebrow">
                    <bdi>{selected.id}</bdi> · {selected.product}
                  </p>
                  <h2>{selected.customerName}</h2>
                </div>
                <span className={`status status-${selected.status}`}>
                  {getStatusLabel(selected.status)}
                </span>
              </div>
              <div className="order-grid">
                <div className="bench-panel">
                  <Bench order={selected} compact />
                  <p className="bench-hint">
                    המחשה מסונכרנת להזמנה · משלוח יכול להסתיים ישירות במסירה, ללא שלב התקנה.
                  </p>
                </div>
                <section className="order-controls" aria-label="פעולות על ההזמנה">
                  <div
                    className={`control-row ${guided && guide.field === 'items' ? 'highlight' : ''}`}
                  >
                    <div>
                      <h3>הכנת הפריטים</h3>
                      <p>
                        {selected.items[0]!.allocationStatus === 'ALLOCATED'
                          ? 'כל הפריטים מוכנים'
                          : 'לפני המעבר למוכן'}
                      </p>
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        disabled={
                          selected.status !== S.RECEIVED && selected.status !== S.PROCESSING
                        }
                        checked={selected.items[0]!.allocationStatus === 'ALLOCATED'}
                        onChange={(event) =>
                          edit(
                            {
                              items: [
                                {
                                  allocationStatus: event.target.checked ? 'ALLOCATED' : 'PENDING',
                                },
                              ],
                            },
                            event.target.checked ? 'הפריטים סומנו כמוכנים' : 'הפריטים הוחזרו להכנה',
                          )
                        }
                      />
                      הפריטים מוכנים
                    </label>
                  </div>
                  <div
                    className={`control-row ${guided && guide.field === 'schedule' ? 'highlight' : ''}`}
                  >
                    <label>
                      <span className="control-title">מועד אספקה</span>
                      <input
                        type="date"
                        disabled={terminal}
                        value={selected.scheduledAt}
                        onChange={(event) =>
                          edit(
                            { scheduledAt: event.target.value },
                            event.target.value
                              ? `מועד האספקה נקבע: ${event.target.value}`
                              : 'מועד האספקה הוסר',
                          )
                        }
                      />
                    </label>
                    <p>
                      כתובת פיקטיבית:
                      <br />
                      עיר הדגמה, רחוב הדגמה 1
                    </p>
                  </div>
                  <div
                    className={`control-row ${guided && guide.field === 'payment' ? 'highlight' : ''}`}
                  >
                    <div>
                      <h3>תשלום בהדגמה</h3>
                      <p>
                        {selected.paymentStatus === 'PAID'
                          ? 'סומן תשלום מלא בדמו'
                          : `יתרה: ${money(selected.totalCents - selected.paidAmountCents)}`}
                      </p>
                    </div>
                    {!(guided && guide.field === 'payment') && paymentButton}
                  </div>
                  {terminal ? (
                    <div className="completion">
                      <h3>{selected.status === S.COMPLETED ? 'המסירה הושלמה' : 'ההזמנה בוטלה'}</h3>
                      <p>היסטוריית הפעולות נשארת זמינה לעיון.</p>
                      {guided && (
                        <button ref={createTrigger} className="primary" onClick={exploreAndCreate}>
                          עכשיו נסו הזמנה משלכם
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="next-action">
                      <p className="eyebrow">הפעולה הבאה</p>
                      {guided && guide.field === 'payment'
                        ? paymentButton
                        : next && (
                            <button
                              className="primary"
                              disabled={nextErrors.length > 0}
                              aria-describedby="next-blockers"
                              onClick={() => changeStatus(next)}
                            >
                              {labelFor(next)}
                            </button>
                          )}
                      <p id="next-blockers" className="blockers">
                        {guided && guide.field === 'payment'
                          ? 'אין חיוב אמיתי. הסימון נועד להדגמה בלבד.'
                          : nextErrors.length
                            ? nextErrors.join(' · ')
                            : 'אפשר להתקדם'}
                      </p>
                    </div>
                  )}
                  {!guided && !terminal && (
                    <details className="other-actions">
                      <summary
                        ref={(node) => {
                          actionsTrigger.current = node;
                        }}
                      >
                        פעולות נוספות
                      </summary>
                      <div>
                        {targets(selected)
                          .filter((status) => status !== next)
                          .map((status) =>
                            status === S.ON_HOLD || status === S.CANCELLED ? (
                              <button
                                key={status}
                                className={status === S.CANCELLED ? 'danger' : 'secondary'}
                                onClick={() => {
                                  setReasonAction(status);
                                  setReason('');
                                }}
                              >
                                {status === S.ON_HOLD ? 'השהיה' : 'ביטול הזמנה'}
                              </button>
                            ) : (
                              <button
                                key={status}
                                className="secondary"
                                disabled={blockers(selected, status, '').length > 0}
                                onClick={() => changeStatus(status)}
                              >
                                {labelFor(status)}
                              </button>
                            ),
                          )}
                      </div>
                    </details>
                  )}
                </section>
              </div>
              <section className="history">
                <h3>היסטוריית הפעולות</h3>
                <ol>
                  {[...selected.history].reverse().map((entry, n) => (
                    <li key={`${entry.at}-${n}`}>
                      <span>{entry.label}</span>
                      <time dateTime={entry.at}>
                        {new Date(entry.at).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        </main>
      )}
      <footer>
        רצף מבית OrdeX · הדמו מדגים ניהול הזמנות עם נתונים פיקטיביים. אין סליקה, חיבור לחנות או
        משלוח הודעות.
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
      {creating && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={closeCreate}
          aria-labelledby="create-title"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const order = createOrder(
                `DEMO-${1001 + orders.length}`,
                String(data.get('customer')).trim(),
                String(data.get('product')).trim(),
                Math.round(Number(data.get('total')) * 100),
              );
              setOrders((current) => [...current, order]);
              setSelectedId(order.id);
              setQuery('');
              setFilter('all');
              setMobileView('detail');
              setNotice('הזמנת ההדגמה נוצרה');
              closeCreate();
            }}
          >
            <p className="eyebrow">עכשיו תורכם</p>
            <h2 id="create-title">הזמנת הדגמה חדשה</h2>
            <p>פרטים פיקטיביים בלבד. כתובת וטלפון לדוגמה יתווספו אוטומטית.</p>
            <label>
              שם לקוח פיקטיבי
              <input
                name="customer"
                autoFocus
                required
                pattern=".*\S.*"
                maxLength={60}
                defaultValue="לקוח הדגמה חדש"
              />
            </label>
            <label>
              מוצר
              <input
                name="product"
                required
                pattern=".*\S.*"
                maxLength={80}
                defaultValue="שולחן צד"
              />
            </label>
            <label>
              סכום בשקלים
              <input
                name="total"
                type="number"
                min="1"
                max="1000000"
                step="0.01"
                required
                defaultValue="450"
              />
            </label>
            <div className="dialog-actions">
              <button className="primary" type="submit">
                יצירת הזמנה
              </button>
              <button type="button" className="secondary" onClick={closeCreate}>
                סגירה
              </button>
            </div>
          </form>
        </dialog>
      )}
      {reasonAction && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={closeReason}
          aria-labelledby="reason-title"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              changeStatus(reasonAction, reason.trim());
              requestAnimationFrame(() => (actionsTrigger.current || pageTitle.current)?.focus());
            }}
          >
            <h2 id="reason-title">
              {reasonAction === S.ON_HOLD ? 'השהיית ההזמנה' : 'ביטול ההזמנה'}
            </h2>
            <p>
              {reasonAction === S.ON_HOLD
                ? 'אפשר יהיה להמשיך מאותו שלב. הסיבה תופיע בהיסטוריה.'
                : 'לאחר הביטול לא ניתן להמשיך בטיפול בהזמנה זו. הסיבה תופיע בהיסטוריה.'}
            </p>
            <label>
              סיבת הפעולה
              <input
                autoFocus
                required
                pattern=".*\S.*"
                maxLength={250}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="submit"
                className={reasonAction === S.CANCELLED ? 'danger' : 'primary'}
                disabled={!reason.trim()}
              >
                אישור {reasonAction === S.ON_HOLD ? 'השהיה' : 'ביטול'}
              </button>
              <button className="secondary" type="button" onClick={closeReason}>
                חזרה להזמנה
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
