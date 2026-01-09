# Component Documentation

## Core Components

### MapPicker

Interactive map component for selecting home location during SPMB registration.

**Location:** `components/spmb/map-picker.tsx`

**Features:**

- Draggable home marker
- Real-time distance calculation (Turf.js)
- Zone circle visualization
- Polyline between school and home

**Props:**

```typescript
interface MapPickerProps {
  schoolPosition: [number, number];
  initialPosition?: [number, number];
  maxDistance: number;
  onLocationChange: (lat: number, lng: number, distance: number) => void;
}
```

---

### RegistrationWizard

Multi-step form wizard for SPMB registration.

**Location:** `components/spmb/registration-wizard.tsx`

**Steps:**

1. StudentForm - Student data
2. ParentForm - Parent/guardian data
3. LocationForm - Home location (MapPicker)
4. DocumentForm - Document upload
5. ReviewStep - Review and submit

---

### ThemeToggle

Dark/light mode toggle with system preference detection.

**Location:** `components/ui/theme-toggle.tsx`

**Usage:**

```tsx
import { ThemeToggle } from "@/components/ui/theme-toggle";

<ThemeToggle />;
```

---

## Layout Components

### Navbar

Responsive navbar with scroll-aware glassmorphism.

**Location:** `components/layout/navbar.tsx`

**Features:**

- Dropdown menus
- Mobile sheet navigation
- Theme toggle
- Login button

### Footer

Modern "mega footer" with newsletter input.

**Location:** `components/layout/footer.tsx`

---

## Providers

### ThemeProvider

Provides dark mode context to the entire app.

**Location:** `components/providers/theme-provider.tsx`

**Usage (in layout.tsx):**

```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";

<ThemeProvider>{children}</ThemeProvider>;
```

---

## UI Components (Shadcn)

All Shadcn components are in `components/ui/`:

- `button.tsx`
- `card.tsx`
- `input.tsx`
- `dialog.tsx`
- `dropdown-menu.tsx`
- `select.tsx`
- `tabs.tsx`
- `table.tsx`
- `badge.tsx`
- `skeleton.tsx`
- `switch.tsx`
- `textarea.tsx`
- `avatar.tsx`
- `separator.tsx`
- `alert.tsx`
- `sheet.tsx`
- `form.tsx`
- `label.tsx`
