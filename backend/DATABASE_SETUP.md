# Prisma Database Setup Instructions

## Current Status
✅ Prisma schema is valid
❌ Database migration failing - need correct DATABASE_URL

## Steps to Fix

### 1. Get Your Supabase Connection String

1. Go to: https://supabase.com/dashboard/project/rtidvkiggnitcgqayvik/settings/database
2. Scroll to **Connection string**
3. Select **Connection pooling** → **Transaction mode**
4. Copy the connection string (it will show `[YOUR-PASSWORD]`)

### 2. Add DATABASE_URL to backend/.env

Add this line to your `backend/.env` file:

```env
DATABASE_URL="postgresql://postgres.rtidvkiggnitcgqayvik:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**Replace `[YOUR-PASSWORD]`** with your actual Supabase database password.

### 3. Run Migration

```bash
cd backend
npx prisma migrate dev --name init
```

This will create all the tables:
- `User` - User accounts
- `Room` - Session rooms
- `Participant` - Users in rooms
- `SessionLog` - Connection logs

## Alternative: Use Supabase Directly

If you prefer to skip Prisma and use Supabase's SQL editor:

1. Go to SQL Editor in Supabase Dashboard
2. Run the SQL from `backend/create_login_logs_table.sql`
3. This will at least create the `login_logs` table for authentication logging
