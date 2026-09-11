# PA3 Admin Panel

React admin panel converted from the original HTML prototype, built with **Vite**, **React**, **Tailwind CSS**, and **React Router**. Data comes from the Node API (`/api/v1`) via Vite proxy — no mock dataset.

## Structure

```
src/
├── api/                      # API clients
├── components/
│   ├── layout/
│   │   ├── AdminLayout.jsx   # Wrapper layout (Header + Sidebar + Outlet)
│   │   ├── Header.jsx        # Top bar: brand, search, language, user
│   │   └── Sidebar.jsx       # Navigation menu
│   ├── Icon.jsx
│   ├── Modals.jsx
│   └── ToastContainer.jsx
├── context/
│   ├── AppContext.jsx        # Modals, toasts, data refresh
│   ├── AuthContext.jsx
│   └── I18nContext.jsx       # vi / en / ja
├── data/
│   ├── i18n.js
│   └── images.js             # placeholder thumbnails only
└── pages/                    # Route pages
```

## Getting started

```bash
pnpm install
pnpm dev
```

Requires backend on `http://localhost:3001` (Vite proxies `/api`).

Open http://localhost:5173

## Scripts

- `pnpm dev` — development server
- `pnpm build` — production build
- `pnpm preview` — preview production build
