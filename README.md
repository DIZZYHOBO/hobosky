# HoboSky v0.1.0

A modern Bluesky web client built with Ionic React, served via Deno Deploy.

## Features (Phase 1)

- 🏠 Home timeline with pull-to-refresh & infinite scroll
- ✍️ Post creation with image uploads (up to 4)
- 💬 Full thread view with parent chain & replies
- ❤️ Like, repost, quote post interactions
- 👤 Profile pages with feed filters (Posts / No Replies / Media / Likes)
- 🔔 Notifications with unread badge & auto-polling
- 🔍 Search (people & posts)
- ➕ Follow / unfollow users
- 🎨 Deep navy/black dark theme with sky-blue accents
- 📱 Mobile-first Ionic UI with native iOS feel

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Deno](https://deno.land/) (for deployment, optional for dev)

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Authentication

HoboSky uses **App Passwords** for authentication. Users generate an App Password at:

**bsky.app → Settings → App Passwords**

This is the standard approach for third-party Bluesky clients. Your main account password is never used.

## Deployment (Deno Deploy)

1. Build the project: `npm run build`
2. Deploy to Deno Deploy with the `server.ts` entry point
3. The `dist/` folder contains the static SPA that gets served

## Tech Stack

- **Frontend:** Ionic 8 + React 18
- **Routing:** React Router v5 (via Ionic)
- **API:** Direct AT Protocol / Bluesky API calls
- **Build:** Vite 6 + TypeScript 5
- **Hosting:** Deno Deploy (serverless edge)
- **Fonts:** Outfit (headings) + DM Sans (body)

## Project Structure

```
hobosky/
├── src/
│   ├── components/    # Reusable UI components
│   │   ├── PostCard.tsx
│   │   └── ComposeModal.tsx
│   ├── context/       # React context providers
│   │   └── AuthContext.tsx
│   ├── pages/         # Route pages
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Notifications.tsx
│   │   ├── PostThread.tsx
│   │   ├── Profile.tsx
│   │   └── Search.tsx
│   ├── services/      # API service layer
│   │   └── api.ts
│   ├── styles/        # Global CSS
│   │   └── global.css
│   ├── theme/         # Ionic theme variables
│   │   └── variables.css
│   ├── types.ts       # TypeScript type definitions
│   ├── utils.ts       # Utility helpers
│   ├── App.tsx        # Main app with routing
│   └── main.tsx       # Entry point
├── server.ts          # Deno Deploy server
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## License

Private project.
