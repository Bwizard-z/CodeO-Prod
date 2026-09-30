-- =============================================================================
-- CODEO SUPABASE DATABASE MIGRATION SCRIPT
-- =============================================================================
-- Project: CODEO - Real-time Collaborative Code Editor
-- Tables: users, rooms, room_members, code_history, room_activity_log
-- Features: Idempotent (IF NOT EXISTS), RLS Enabled, Triggers, Views, Auth Sync
-- =============================================================================

-- Enable pgcrypto extension for gen_random_uuid() if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLE CREATION (Safe & Idempotent)
-- =============================================================================

-- Table 1: users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Table 2: rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  invite_token VARCHAR(32) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  language VARCHAR(50) DEFAULT 'javascript',
  code_content TEXT DEFAULT '',
  is_locked BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

-- Table 3: room_members
CREATE TABLE IF NOT EXISTS public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  anonymous_name VARCHAR(255),
  anonymous_session_id UUID,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
  can_edit BOOLEAN DEFAULT TRUE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  kicked_at TIMESTAMP,
  CONSTRAINT member_must_be_authenticated_or_anonymous CHECK (
    (user_id IS NOT NULL) OR (anonymous_session_id IS NOT NULL)
  )
);

-- Table 4: code_history
CREATE TABLE IF NOT EXISTS public.code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  anonymous_session_id UUID,
  user_name VARCHAR(255) NOT NULL,
  code_content TEXT NOT NULL,
  language VARCHAR(50) NOT NULL,
  stdin TEXT,
  execution_output TEXT,
  execution_status VARCHAR(20) DEFAULT 'pending' CHECK (
    execution_status IN ('pending', 'success', 'error', 'timeout', 'runtime_error')
  ),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: room_activity_log
CREATE TABLE IF NOT EXISTS public.room_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  anonymous_session_id UUID,
  user_name VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_name VARCHAR(255),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: ai_chat_history
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  code_context TEXT,
  language VARCHAR(50),
  is_coding_related BOOLEAN DEFAULT TRUE,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. CREATE INDEXES (Safe & Idempotent)
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_invite_token ON public.rooms(invite_token);
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON public.rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_code_history_room_id ON public.code_history(room_id);
CREATE INDEX IF NOT EXISTS idx_code_history_user_id ON public.code_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_room_id ON public.room_activity_log(room_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.room_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_history_room ON public.ai_chat_history(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_user ON public.ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_created ON public.ai_chat_history(created_at DESC);

-- =============================================================================
-- 3. TIMESTAMP AUTO-UPDATE TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON public.rooms;
CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 4. SUPABASE AUTH TO PUBLIC.USERS SYNC TRIGGER
-- =============================================================================
-- Automatically syncs new Supabase Auth accounts (Email/Password or Google OAuth)
-- into the public.users table so foreign key references work seamlessly.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'user_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (email) DO UPDATE
  SET name = EXCLUDED.name,
      updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- =============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) CONFIGURATION
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_activity_log ENABLE ROW LEVEL SECURITY;

-- --- Policies for public.users ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow all to read user profiles') THEN
    CREATE POLICY "Allow all to read user profiles" ON public.users FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow users to update own profile') THEN
    CREATE POLICY "Allow users to update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow insert via auth trigger or service') THEN
    CREATE POLICY "Allow insert via auth trigger or service" ON public.users FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- --- Policies for public.rooms ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Allow view active rooms') THEN
    CREATE POLICY "Allow view active rooms" ON public.rooms FOR SELECT USING (is_archived = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Allow authenticated users to create rooms') THEN
    CREATE POLICY "Allow authenticated users to create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = created_by OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Allow creator to update room') THEN
    CREATE POLICY "Allow creator to update room" ON public.rooms FOR UPDATE USING (auth.uid() = created_by OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Allow creator to delete room') THEN
    CREATE POLICY "Allow creator to delete room" ON public.rooms FOR DELETE USING (auth.uid() = created_by OR auth.role() = 'service_role');
  END IF;
END $$;

-- --- Policies for public.room_members ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_members' AND policyname = 'Allow read room members') THEN
    CREATE POLICY "Allow read room members" ON public.room_members FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_members' AND policyname = 'Allow join room') THEN
    CREATE POLICY "Allow join room" ON public.room_members FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_members' AND policyname = 'Allow update room member state') THEN
    CREATE POLICY "Allow update room member state" ON public.room_members FOR UPDATE USING (true);
  END IF;
END $$;

-- --- Policies for public.code_history ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'code_history' AND policyname = 'Allow read code history') THEN
    CREATE POLICY "Allow read code history" ON public.code_history FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'code_history' AND policyname = 'Allow insert code history') THEN
    CREATE POLICY "Allow insert code history" ON public.code_history FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- --- Policies for public.room_activity_log ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_activity_log' AND policyname = 'Allow read activity log') THEN
    CREATE POLICY "Allow read activity log" ON public.room_activity_log FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_activity_log' AND policyname = 'Allow insert activity log') THEN
    CREATE POLICY "Allow insert activity log" ON public.room_activity_log FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- 6. VIEWS FOR DASHBOARD & ROOM QUERIES
-- =============================================================================

-- View 1: Active Rooms with host information and member count
CREATE OR REPLACE VIEW public.view_active_rooms AS
SELECT 
  r.id,
  r.code,
  r.invite_token,
  r.title,
  r.description,
  r.language,
  r.is_locked,
  r.created_at,
  r.updated_at,
  u.id AS host_id,
  u.name AS host_name,
  u.email AS host_email,
  COUNT(rm.id) FILTER (WHERE rm.is_active = TRUE) AS active_members_count
FROM public.rooms r
JOIN public.users u ON r.created_by = u.id
LEFT JOIN public.room_members rm ON r.id = rm.room_id
WHERE r.is_archived = FALSE
GROUP BY r.id, u.id;

-- View 2: Room Summary with Creator info
CREATE OR REPLACE VIEW public.view_room_summary AS
SELECT 
  r.id,
  r.code,
  r.invite_token,
  r.title,
  r.description,
  r.language,
  r.is_locked,
  r.is_archived,
  r.created_at,
  r.updated_at,
  u.id AS creator_id,
  u.name AS creator_name,
  u.email AS creator_email
FROM public.rooms r
JOIN public.users u ON r.created_by = u.id;

CREATE TABLE room_ai_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_ai_room ON room_ai_chat(room_id);
CREATE INDEX idx_room_ai_created ON room_ai_chat(created_at DESC);

