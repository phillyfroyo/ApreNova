# 📦 Updated Infrastructure (as of July 2, 2025)

---

### 📄 **Development Environment**

**Visual Studio Code**

└── React + Tailwind + Framer Motion (active development stack)

---

### 🎨 **Frontend: React + Tailwind + Framer Motion**

├── UI styling and animations

├── Custom reusable components (`Card`, `Button`, `StoryModal`, etc.)

└── Centralized UI config (`cardPresets.ts`, utility classes in `globals.css` like `glass-card`)

---

### 🚦 **Next.js (App Router)**

├── File-based routing & layouts

├── Internationalization support (`/es`, `/en`)

├── Dynamic routes (e.g. `/stories/[level]/[part]`)

├── Dynamic story selection via `storySlug`

├── Server/client component split

├── Dynamic client components using `next/dynamic`

├── `dynamic = 'force-dynamic'` used to disable prerendering for session-based routes

└── Client-side components marked with `"use client"` as needed

---

### 🔐 **NextAuth.js Authentication**

├── Google OAuth integration

├── Credentials-based login (email + password)

├── JWT-based sessions

├── Custom login/signup pages (`/es/auth/login`, `/es/auth/signup`)

├── Prisma adapter for user persistence

├── Session enriched with `nativeLanguage` from database

└── `nativeLanguage` used to personalize UI (e.g. `miAprendO`, `myAprendO`)

---

### 🧠 **Prisma ORM + SQLite (Dev)**

├── Models: `User`, `Account`, `Session`, `VerificationToken`

├── Fields: `quizLevel`, `password`, `emailVerified`, `image`, `name`, `nativeLanguage`

├── Automatic user creation via OAuth or signup API

└── DB managed via `prisma migrate dev` and `prisma db push`

---

### 📦 **GitHub Repository**

├── Git-based source control

├── Main branch triggers Vercel deploy

└── Feature branches used for experiments (optional)

---

### 🚀 **Vercel Hosting**

├── Deploys the full app (Next.js + serverless APIs)

├── Handles dynamic rendering and static pages

└── Serverless auth/session API routes under `/api`

---

### 🛠️ **Environment Configuration (.env.local / Vercel)**

├── `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

├── `NEXTAUTH_SECRET`, `DATABASE_URL`

└── Environment variables managed for both local and cloud environments

---

### 📱 **Phase 2: Native App Preparedness**

- 🔄 Core logic (auth, story routing, metadata) is modular and portable
- 📦 `/lib/` and `/hooks/` structure supports reuse in React Native
- 🧩 Story selection and routing use dynamic `storySlug`, enabling multi-series expansion
- 🧠 Business logic decoupled from UI — ready to plug into React Native views
- 🛑 Native app will be developed *after MVP* — no “wrapper app” planned