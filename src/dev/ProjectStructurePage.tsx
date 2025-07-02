my-aprenova/
├── src/
│   ├── app/
│   │   ├── (client)/
│   │   │   ├── en/stories/page.tsx
│   │   │   └── es/stories/page.tsx
│   │   ├── (marketing)/layout.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx
│   ├── components/
│   │   ├── StoryCard.tsx
│   │   ├── StoryModal.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Dropdown.tsx
│   ├── constants/levels.ts
│   ├── hooks/useUserLevel.ts
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── auth/config.ts
│   │   └── stories.ts
│   └── types/story.ts
│
├── prisma/
│   └── prisma/
│       ├── dev.db
│       ├── schema.prisma
│       ├── migrations/
│       │   ├── 20250627225303_init/migration.sql
│       │   ├── 20250630210210_add_quiz_level/migration.sql
│       │   ├── 20250630215831_enable_nextauth/migration.sql
│       │   ├── 20250630220030_add_name_and_image/migration.sql
│       │   └── migration_lock.toml
│
├── scripts/
│   └── scripts/
│       └── testPrisma.ts
│
├── .next/                  # ⚙️ Next.js build artifacts (many files inside)
├── node_modules/           # 📦 Installed dependencies (auto-managed)
├── public/                 # 🌐 Public assets (images, favicon, etc.)
│
├── .env
├── .env.local
├── .gitignore
├── eslint.config.js
├── jsconfig.json
├── next.config.js
├── next-env.d.ts
├── package.json
├── package-lock.json
├── postcss.config.js
├── README.md
├── tailwind.config.js
├── tsconfig.json
├── windi.config.js