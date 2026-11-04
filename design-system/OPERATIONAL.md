# OrdeX Operational Design System

This document defines the visual language and component architecture for OrdeX, an operational-first system inspired by Wolt Merchant.

## 1. Design Principles

- **Operational, not marketing**: Focus on utility and quick actions.
- **Minimalist first**: Show details only when needed (Focus on demand).
- **RTL-First**: Designed for Hebrew as the primary language.
- **Fast Scanning**: Optimized for operators who need to process many orders quickly.

## 2. Color System (Semantic Tokens)

All colors must use these tokens. Raw colors are prohibited in component code.

| Token              | Usage                      | Value (Base) |
| ------------------ | -------------------------- | ------------ |
| `--bg-app`         | App background             | `#F3F4F6`    |
| `--bg-card`        | Card background            | `#FFFFFF`    |
| `--border-subtle`  | Borders & Dividers         | `#E5E7EB`    |
| `--text-primary`   | Main text / Headlines      | `#111827`    |
| `--text-secondary` | Metadata / Supporting text | `#6B7280`    |
| `--primary`        | Primary actions            | `#0070F3`    |
| `--success`        | Completed states           | `#10B981`    |
| `--warning`        | Waiting / Attention        | `#F59E0B`    |
| `--danger`         | Urgent / Blocking issues   | `#EF4444`    |

## 3. Typography (Inter)

| Level             | Size | Weight | Line Height | Usage                        |
| ----------------- | ---- | ------ | ----------- | ---------------------------- |
| **Page Title**    | 24px | 600    | 1.2         | Screen headers               |
| **Section Title** | 18px | 600    | 1.25        | Group titles                 |
| **Card Title**    | 15px | 600    | 1.3         | Customer names               |
| **Body**          | 14px | 400    | 1.5         | Main content                 |
| **Meta**          | 12px | 400    | 1.4         | Supporting info (IDs, Times) |

## 4. Component Architecture

### 4.1 OrderCard

The fundamental unit of the system.

- **Collapsed**: Shows Customer Name (Bold), Order # (Secondary), City (Icon+Text), Waiting Time, Lane Pill.
- **Expanded (Drill)**: Reveals Task Checklist, Progress Bar, and Quick Action buttons.

### 4.2 Status Pills

- **LanePill**: Indicates current phase (לטיפול, ממתין, מתוזמן).
- **TaskPill**: Current actionable task.
- **PriorityPill**: Dot or pill that subtly pulses if urgent.

### 4.3 Smart Drill Checklist

- **Contextual Focus**: Always opens with the current task expanded.
- **Auto-Advance**: Completing a task automatically collapses it and opens the next one.
- **Progress Sync**: Updates the `OrderProgress` bar in real-time.

## 5. Global Layout Layout

- **Top Bar**: Search-centric with quick filters.
- **Bottom Navigation (Mobile)**: Tabs for Home, Orders, Catalog, Deliveries, More.
- **Desktop**: Content centered with a maximum width of 1200px.

---

_Handoff: This document serves as the Source of Truth for the UX/UI Implementation phase._
