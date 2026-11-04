# RTL (Right-to-Left) Rules for OrdeX

This document defines the RTL strategy for the OrdeX UI architecture.

## Core Principle

**Use CSS Logical Properties exclusively.** No manual flipping with `ltr:` or `rtl:` class modifiers.

## Why Logical Properties?

CSS Logical Properties automatically adapt to text direction (`dir="rtl"` or `dir="ltr"`), eliminating the need for duplicate classes or manual overrides.

## Logical Properties Mapping

### Margin & Padding

| Physical Property | Logical Property | Tailwind Class | Auto-flips in RTL? |
|-------------------|------------------|----------------|-------------------|
| `margin-left` | `margin-inline-start` | `.ms-{size}` | ✅ Yes |
| `margin-right` | `margin-inline-end` | `.me-{size}` | ✅ Yes |
| `padding-left` | `padding-inline-start` | `.ps-{size}` | ✅ Yes |
| `padding-right` | `padding-inline-end` | `.pe-{size}` | ✅ Yes |
| `margin-top` | `margin-block-start` | `.mt-{size}` | ❌ No (vertical) |
| `margin-bottom` | `margin-block-end` | `.mb-{size}` | ❌ No (vertical) |

### Positioning

| Physical Property | Logical Property | Tailwind Class | Auto-flips in RTL? |
|-------------------|------------------|----------------|-------------------|
| `left: 0` | `inset-inline-start: 0` | `.start-0` | ✅ Yes |
| `right: 0` | `inset-inline-end: 0` | `.end-0` | ✅ Yes |
| `top: 0` | `inset-block-start: 0` | `.top-0` | ❌ No (vertical) |
| `bottom: 0` | `inset-block-end: 0` | `.bottom-0` | ❌ No (vertical) |

### Text Alignment

| Physical Property | Logical Property | Tailwind Class | Auto-flips in RTL? |
|-------------------|------------------|----------------|-------------------|
| `text-align: left` | `text-align: start` | `.text-start` | ✅ Yes |
| `text-align: right` | `text-align: end` | `.text-end` | ✅ Yes |
| `text-align: center` | `text-align: center` | `.text-center` | ❌ No (same) |

### Borders

| Physical Property | Logical Property | Tailwind Class | Auto-flips in RTL? |
|-------------------|------------------|----------------|-------------------|
| `border-left` | `border-inline-start` | `.border-s` | ✅ Yes |
| `border-right` | `border-inline-end` | `.border-e` | ✅ Yes |
| `border-top` | `border-block-start` | `.border-t` | ❌ No (vertical) |
| `border-bottom` | `border-block-end` | `.border-b` | ❌ No (vertical) |

### Border Radius

For complex border-radius scenarios (e.g., rounded only on one side):

| Physical Property | Logical Property |
|-------------------|------------------|
| `border-top-left-radius` | `border-start-start-radius` |
| `border-top-right-radius` | `border-start-end-radius` |
| `border-bottom-left-radius` | `border-end-start-radius` |
| `border-bottom-right-radius` | `border-end-end-radius` |

**Note:** Most cases use symmetric radius (`.rounded-lg`), which doesn't need logical properties.

---

## Usage Examples

### ❌ OLD WAY (Physical Properties + Manual Flip)

```tsx
// Bad: Manual RTL handling
<div className="ml-4 ltr:ml-4 rtl:mr-4">
  <button className="absolute left-0 ltr:left-0 rtl:right-0">
    Click
  </button>
</div>
```

### ✅ NEW WAY (Logical Properties)

```tsx
// Good: Automatic RTL handling
<div className="ms-4">
  <button className="absolute start-0">
    Click
  </button>
</div>
```

---

## Common Patterns

### 1. Icon + Text (with spacing)

```tsx
// ❌ OLD
<button className="flex items-center">
  <Icon className="mr-2 ltr:mr-2 rtl:ml-2" />
  <span>Text</span>
</button>

// ✅ NEW
<button className="flex items-center">
  <Icon className="me-2" />
  <span>Text</span>
</button>
```

### 2. Sidebar Positioning

```tsx
// ❌ OLD
<aside className="fixed right-0 ltr:left-0 rtl:right-0">
  Sidebar
</aside>

// ✅ NEW
<aside className="fixed start-0">
  Sidebar
</aside>
```

### 3. Dropdown Menu

```tsx
// ❌ OLD
<div className="absolute left-0 ltr:left-0 rtl:right-0">
  Dropdown
</div>

// ✅ NEW
<div className="absolute start-0">
  Dropdown
</div>
```

### 4. Card with Padding

```tsx
// ❌ OLD
<div className="pl-4 pr-6">
  Content
</div>

// ✅ NEW
<div className="ps-4 pe-6">
  Content
</div>
```

---

## Root Layout Setup

Ensure the root layout has `dir="rtl"` for Hebrew:

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
```

---

## ESLint Rules

Enforce logical properties with ESLint:

```javascript
// .eslintrc.js
rules: {
  'no-restricted-syntax': [
    'error',
    {
      selector: "MemberExpression[property.name=/^(marginLeft|marginRight|paddingLeft|paddingRight|left|right)$/]",
      message: 'Use logical properties (margin-inline-start, etc.)'
    }
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['**/ml-*', '**/mr-*', '**/pl-*', '**/pr-*'],
          message: 'Use logical properties (ms-*, me-*, ps-*, pe-*)'
        }
      ]
    }
  ]
}
```

---

## Testing RTL

### Manual Testing

1. Toggle `dir` attribute in browser DevTools:
   ```javascript
   document.documentElement.dir = 'rtl' // or 'ltr'
   ```

2. Verify:
   - Sidebar flips to correct side
   - Icons appear on correct side of text
   - Dropdowns open in correct direction
   - Text aligns correctly

### Automated Testing (Playwright)

Store separate snapshots for RTL:

```typescript
// tests/visual/dashboard.spec.ts
test('dashboard renders correctly in RTL', async ({ page }) => {
  await page.goto('/dashboard')
  await page.evaluate(() => document.documentElement.dir = 'rtl')
  await expect(page).toHaveScreenshot('dashboard-rtl.png')
})
```

---

## Components That Don't Need Flipping

Some elements should NOT flip in RTL:

1. **Icons/Logos**: Keep original orientation
   ```css
   [dir="rtl"] .logo {
     transform: none; /* Don't flip */
   }
   ```

2. **Numbers**: Keep LTR format
   ```tsx
   <span className="font-english">1,234</span>
   ```

3. **Images**: Keep original orientation
   ```css
   [dir="rtl"] img {
     transform: none;
   }
   ```

---

## Quick Reference Card

| Use Case | Physical → Logical | Tailwind |
|----------|-------------------|----------|
| Left margin | `ml-4` → `ms-4` | `.ms-4` |
| Right margin | `mr-4` → `me-4` | `.me-4` |
| Left padding | `pl-4` → `ps-4` | `.ps-4` |
| Right padding | `pr-4` → `pe-4` | `.pe-4` |
| Left position | `left-0` → `start-0` | `.start-0` |
| Right position | `right-0` → `end-0` | `.end-0` |
| Align left | `text-left` → `text-start` | `.text-start` |
| Align right | `text-right` → `text-end` | `.text-end` |
| Left border | `border-l` → `border-s` | `.border-s` |
| Right border | `border-r` → `border-e` | `.border-e` |

---

## Resources

- [MDN: CSS Logical Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties)
- [W3C Spec: CSS Logical Properties Level 1](https://www.w3.org/TR/css-logical-1/)

---

**Last Updated:** 2026-02-04
**Version:** 1.0
