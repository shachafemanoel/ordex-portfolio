import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { getStatusLabel } from "@/lib/orderStatus";
import { OrderStatus } from "@/lib/order-status-type";
import {
  blockers,
  createOrder,
  initialOrders,
  money,
  record,
  targets,
  transition,
  type DemoOrder,
} from "./demo";
import "./style.css";

const progress = [
  "RECEIVED",
  "PROCESSING",
  "READY",
  "IN_TRANSIT",
  "COMPLETED",
] as OrderStatus[];
function App() {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedId, setSelectedId] = useState("DEMO-1001");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [reason, setReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = orders.find((order) => order.id === selectedId)!;
  const active = orders.filter(
    (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
  );
  const shown = orders.filter(
    (order) =>
      `${order.id} ${order.customerName} ${order.product}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" || order.status === filter),
  );
  function update(order: DemoOrder) {
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? order : item)),
    );
  }
  function edit(patch: Partial<DemoOrder>, label: string) {
    update({
      ...selected,
      ...patch,
      history: [...selected.history, record(label)],
    });
    setNotice(label);
  }
  function changeStatus(target: OrderStatus) {
    update(transition(selected, target, reason));
    setReason("");
    setNotice(`הסטטוס עודכן: ${getStatusLabel(target)}`);
  }
  return (
    <>
      <div className="demo-banner">
        סביבת הדגמה עצמאית · כל הנתונים פיקטיביים · הפעולות נשמרות בזיכרון עד
        לרענון
      </div>
      <header className="topbar">
        <a className="brand" href="./" aria-label="OrdeX דף הבית">
          Orde<span>X</span>
          <small>ניהול הזמנות</small>
        </a>
        <div className="workspace">
          <span className="workspace-dot" />
          סטודיו הדגמה <span className="tag">דמו</span>
        </div>
        <button
          onClick={() => {
            setOrders(initialOrders());
            setSelectedId("DEMO-1001");
            setReason("");
            setQuery("");
            setFilter("all");
            setNotice("נתוני ההדגמה אופסו");
          }}
        >
          איפוס הדמו
        </button>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <p className="subtitle">מרכז התפעול</p>
            <h1>כל הזמנה. עד למסירה.</h1>
            <p>עקבו אחר ההכנה, פתרו חסמים והתקדמו לשלב הבא.</p>
          </div>
          <button className="primary" onClick={() => setCreating(true)}>
            ＋ הזמנת הדגמה
          </button>
        </section>
        <section className="summary" aria-label="סיכום הזמנות">
          <div>
            <span>הזמנות פעילות</span>
            <strong>{active.length}</strong>
          </div>
          <div>
            <span>מוכנות ליציאה</span>
            <strong>
              {orders.filter((order) => order.status === "READY").length}
            </strong>
          </div>
          <div>
            <span>יתרה בהזמנות פעילות</span>
            <strong>
              {money(
                active.reduce(
                  (sum, order) =>
                    sum + order.totalCents - order.paidAmountCents,
                  0,
                ),
              )}
            </strong>
          </div>
          <p>
            מתחילים בהזמנה, מכינים את הפריטים וקובעים אספקה. יציאה דורשת תשלום
            מלא.
          </p>
        </section>
        <div className="workbench">
          <section className="queue" aria-labelledby="queue-title">
            <div className="section-heading">
              <h2 id="queue-title">תור ההזמנות</h2>
              <span>{shown.length} הזמנות</span>
            </div>
            <div className="filters">
              <label className="search">
                <span>חיפוש</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="לקוח, מוצר או מספר הזמנה"
                />
              </label>
              <label>
                <span>סטטוס</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">הכל</option>
                  {[
                    ...progress,
                    OrderStatus.INSTALLATION,
                    OrderStatus.ON_HOLD,
                    OrderStatus.CANCELLED,
                  ].map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="order-list">
              {shown.map((order) => (
                <button
                  className={`order-row ${selectedId === order.id ? "selected" : ""}`}
                  key={order.id}
                  onClick={() => {
                    setSelectedId(order.id);
                    setReason("");
                    setNotice("");
                  }}
                  aria-pressed={selectedId === order.id}
                >
                  <div className="order-row-top">
                    <b>{order.customerName}</b>
                    <span className={`status status-${order.status}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p>{order.product}</p>
                  <div className="order-row-bottom">
                    <span dir="ltr">{order.id}</span>
                    <strong>{money(order.totalCents)}</strong>
                  </div>
                </button>
              ))}
              {!shown.length && (
                <div className="empty">
                  לא נמצאו הזמנות. נסו חיפוש אחר או צרו הזמנת הדגמה.
                </div>
              )}
            </div>
          </section>
          <section className="detail" aria-labelledby="detail-title">
            <div className="detail-heading">
              <div>
                <span className="order-number" dir="ltr">
                  {selected.id}
                </span>
                <h2 id="detail-title">{selected.customerName}</h2>
                <p>{selected.product}</p>
              </div>
              <span className={`status status-${selected.status}`}>
                {getStatusLabel(selected.status)}
              </span>
            </div>
            <ol className="flow" aria-label="שלבי ההזמנה">
              {progress.map((status, index) => (
                <li
                  key={status}
                  aria-current={selected.status === status ? "step" : undefined}
                  className={
                    selected.status === status ||
                    (selected.status === "INSTALLATION" &&
                      status === "IN_TRANSIT")
                      ? "current"
                      : ""
                  }
                >
                  <span>{index + 1}</span>
                  {getStatusLabel(status)}
                </li>
              ))}
            </ol>
            <div className="detail-body">
              <div className="section-heading">
                <h3>מוכנות ההזמנה</h3>
                <strong>{money(selected.totalCents)}</strong>
              </div>
              <div className="check-row">
                <div>
                  <b>הכנת הפריטים</b>
                  <small>
                    {selected.items[0].allocationStatus === "ALLOCATED"
                      ? "כל הפריטים מוכנים"
                      : "ממתין להכנת הפריטים"}
                  </small>
                </div>
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={selected.items[0].allocationStatus === "ALLOCATED"}
                    disabled={["COMPLETED", "CANCELLED"].includes(
                      selected.status,
                    )}
                    onChange={(event) =>
                      edit(
                        {
                          items: [
                            {
                              allocationStatus: event.target.checked
                                ? "ALLOCATED"
                                : "PENDING",
                            },
                          ],
                        },
                        event.target.checked
                          ? "הפריטים סומנו כמוכנים"
                          : "הפריטים הוחזרו להכנה",
                      )
                    }
                  />
                  הפריטים מוכנים
                </label>
              </div>
              <div className="check-row">
                <div>
                  <b>מועד אספקה</b>
                  <small>כתובת פיקטיבית: עיר הדגמה, רחוב הדגמה 1</small>
                </div>
                <label>
                  <span className="sr-only">מועד אספקה</span>
                  <input
                    type="date"
                    value={selected.scheduledAt}
                    disabled={["COMPLETED", "CANCELLED"].includes(
                      selected.status,
                    )}
                    onChange={(event) =>
                      edit(
                        { scheduledAt: event.target.value },
                        event.target.value
                          ? `מועד האספקה נקבע: ${event.target.value}`
                          : "מועד האספקה הוסר",
                      )
                    }
                  />
                </label>
              </div>
              <div className="check-row">
                <div>
                  <b>תשלום בהדגמה</b>
                  <small>
                    {selected.paymentStatus === "PAID"
                      ? "סומן תשלום מלא בדמו"
                      : `יתרה: ${money(selected.totalCents - selected.paidAmountCents)}`}
                  </small>
                </div>
                <button
                  disabled={
                    selected.paymentStatus === "PAID" ||
                    ["COMPLETED", "CANCELLED"].includes(selected.status)
                  }
                  onClick={() =>
                    edit(
                      {
                        paidAmountCents: selected.totalCents,
                        paymentStatus: "PAID",
                      },
                      "סומן תשלום מלא בדמו בלבד",
                    )
                  }
                >
                  סימון תשלום בדמו
                </button>
              </div>
              <section className="next-step">
                <h3>השלב הבא</h3>
                {targets(selected).length > 0 ? (
                  <>
                    <label className="reason">
                      <span>סיבה / הערה (חובה בהשהיה וביטול)</span>
                      <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={250}
                        placeholder="לדוגמה: נמסר ללקוח ההדגמה"
                      />
                    </label>
                    <div className="actions">
                      {targets(selected).map((target) => {
                        const errors = blockers(selected, target, reason);
                        return (
                          <div className="action" key={target}>
                            <button
                              className={
                                target === "CANCELLED"
                                  ? "danger"
                                  : "action-button"
                              }
                              disabled={!!errors.length}
                              aria-describedby={`blocker-${target}`}
                              onClick={() => changeStatus(target)}
                            >
                              {target === "ON_HOLD"
                                ? "השהיה"
                                : target === "CANCELLED"
                                  ? "ביטול"
                                  : `מעבר ל${getStatusLabel(target)}`}
                            </button>
                            <small id={`blocker-${target}`}>
                              {errors.join(" · ") || "אפשר להתקדם"}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p>
                    הטיפול בהזמנה הסתיים. אפשר לעיין בהיסטוריה או לבחור הזמנה
                    אחרת.
                  </p>
                )}
              </section>
              <section className="history">
                <h3>היסטוריית הפעולות</h3>
                <ol>
                  {[...selected.history].reverse().map((entry, index) => (
                    <li key={`${entry.at}-${index}`}>
                      <span>{entry.label}</span>
                      <time dateTime={entry.at}>
                        {new Date(entry.at).toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </section>
        </div>
        <p className="footer-note">
          הדמו מדגים חוקי זרימה שחולצו מ־OrdeX. אין כאן סליקת תשלום, הרשאות שרת,
          משלוח הודעות או חיבור לחנות.
        </p>
      </main>
      <div className="sr-only" role="status">
        {notice}
      </div>
      {creating && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          onCancel={() => setCreating(false)}
          aria-modal="true"
          aria-labelledby="create-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") setCreating(false);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const id = `DEMO-${1001 + orders.length}`;
              const order = createOrder(
                id,
                String(data.get("customer")).trim(),
                String(data.get("product")),
                Math.round(Number(data.get("total")) * 100),
              );
              setOrders((current) => [...current, order]);
              setSelectedId(id);
              setCreating(false);
              setReason("");
              setQuery("");
              setFilter("all");
              setNotice("הזמנת ההדגמה נוצרה");
            }}
          >
            <h2 id="create-title">הזמנת הדגמה חדשה</h2>
            <p>
              השתמשו בפרטים פיקטיביים בלבד. כתובת וטלפון פיקטיביים יתווספו
              אוטומטית.
            </p>
            <label>
              שם לקוח פיקטיבי
              <input
                name="customer"
                required
                pattern=".*\S.*"
                maxLength={60}
                autoFocus
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
                required
                min="1"
                max="1000000"
                step="0.01"
                defaultValue="450"
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setCreating(false)}>
                סגירה
              </button>
              <button className="primary" type="submit">
                יצירת הזמנה
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
