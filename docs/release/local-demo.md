# Local pilot demo

The pilot demo runs on one Mac, at no cost and with no cloud services. It is for guided demos with
fictional data only. Each customer later gets a dedicated cloud environment of their own;
`render.demo.yaml` is the draft template for that and is not used here.

## What runs

- A dedicated PostgreSQL cluster on `127.0.0.1:55433` (database `retzef_demo`), separate from the
  development and acceptance databases.
- Retzef on `http://localhost:3100` with production protections: business separation
  (`TENANT_ENFORCEMENT=true`), the restricted runtime role, no authentication fallback.
- The WooCommerce worker.
- A WooCommerce test store on `http://localhost:9400`, run by WordPress Playground (PHP inside
  Node, SQLite; no Docker or PHP install). Its plugins turn off email and leave only offline
  payment methods (`infra/wordpress/retzef-demo.php`), and allow the three local exceptions the
  store and Retzef need on one Mac (`infra/wordpress/local/retzef-local-store.php`).

Everything is kept in `~/.retzef-demo` (override with `RETZEF_DEMO_HOME`): database files, the
store, the generated secrets (`env`), the demo logins (`credentials.txt`), both baseline snapshots
and logs. Nothing in it is committed. It needs Node 22 (`RETZEF_NODE_BIN`) and PostgreSQL
(`brew install postgresql`).

## Commands

```bash
npm run demo setup    # first time: database, demo data, test store, build, baseline snapshots
npm run demo start    # before a demo
npm run demo reset    # back to the starting point after a demo (Retzef and the store)
npm run demo stop
npm run demo tunnel   # optional: a temporary public HTTPS link (brew install cloudflared)
```

`reset` refuses to touch a database that does not carry this environment's marker
(`retzef_demo_environment`). To start over completely, stop the demo and delete `~/.retzef-demo`.

## Demo data

Two fictional businesses, each with an admin and an operations employee (one shared password,
in `credentials.txt`):

- **רהיטי הדגמה**: three customers, five products and three new orders. This is the business the
  test store connects to.
- **מטבחי הדגמה**: one customer, one product with the same SKU, one order. Shows that businesses
  never see each other's records.

The store has three products. The store is not connected at the starting point; connecting it is
the first step of the demo.

## Demo script

1. Sign in as `admin.main`. Show the order queue and the three existing orders.
2. הגדרות › אינטגרציות: connect the store with the address and keys from `credentials.txt`.
   Reload the page if the card still says "לא מחוברת".
3. In the store admin (`/wp-admin`, WooCommerce › הזמנות › הוספת הזמנה), create an order with a
   customer name, phone, billing and shipping address, a product and the payment method
   "העברה בנקאית", status "בהשהייה", and press "יצירה". It appears in Retzef as a new, unpaid
   order. A phone number and shipping address are required; without them the order waits on the
   sync screen as "דורש טיפול".
4. In Retzef, schedule it and try to send it out: it is blocked because it is unpaid.
5. In the store, change the order to "בטיפול" (the transfer arrived) and press "עדכן". Retzef
   shows it as paid, and the departure is allowed. Local schedule, notes and an edited address
   stay as they are.
6. Sign in as `staff.main` to show the employee's narrower permissions, and as `admin.second` to
   show the second business sees none of this.
7. `npm run demo reset` afterwards.

Cash on delivery gets its payment date in WooCommerce only when the order is completed, so with
the full-payment rule it cannot leave for delivery. Use bank transfer in the demo.

## Outbound traffic

No email, push notifications or payments leave the demo. In business mode, order addresses are
validated locally and are not sent to external geocoders. The store and Retzef only talk to each
other on this Mac.
