-- =============================================================================
-- CODEO FEEDBACK SYSTEM SCHEMA MIGRATION
-- =============================================================================
-- Database: Supabase PostgreSQL (public schema)
-- Table: feedback
-- Features: RLS enabled, indexes, triggers, validation constraints, summary view
-- =============================================================================

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category VARCHAR(100) NOT NULL DEFAULT 'General Experience',
  feedback TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'archived')),
  admin_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT feedback_text_length CHECK (char_length(trim(feedback)) >= 5)
);

-- Comments for documentation
COMMENT ON TABLE public.feedback IS 'User reviews, ratings, bug reports, and feature requests';
COMMENT ON COLUMN public.feedback.rating IS 'Numeric rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN public.feedback.category IS 'Feedback classification: General Experience, Feature Request, UI & Dark Theme, Code Editor & Sandbox, Bug Report';
COMMENT ON COLUMN public.feedback.status IS 'Triage status: new, reviewed, in_progress, resolved, archived';

-- Indexes for performance & dashboard filtering
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_email ON public.feedback(email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running migration
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Service role full access on feedback" ON public.feedback;

-- RLS Policy 1: Anyone (authenticated or guest/anon) can submit feedback
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback
  FOR INSERT
  TO public, anon, authenticated
  WITH CHECK (true);

-- RLS Policy 2: Users can view their own feedback submissions
CREATE POLICY "Users can view their own feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy 3: Service role (backend API) has unrestricted access
CREATE POLICY "Service role full access on feedback"
  ON public.feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function & Trigger: Automatically keep updated_at in sync
CREATE OR REPLACE FUNCTION public.handle_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_feedback_updated_at ON public.feedback;
CREATE TRIGGER tr_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_feedback_updated_at();

-- Analytics view: Summary of feedback metrics for quick inspection
CREATE OR REPLACE VIEW public.view_feedback_summary AS
SELECT
  COUNT(*) AS total_feedbacks,
  ROUND(AVG(rating)::numeric, 2) AS average_rating,
  COUNT(*) FILTER (WHERE rating = 5) AS five_star_count,
  COUNT(*) FILTER (WHERE rating = 4) AS four_star_count,
  COUNT(*) FILTER (WHERE rating = 3) AS three_star_count,
  COUNT(*) FILTER (WHERE rating = 2) AS two_star_count,
  COUNT(*) FILTER (WHERE rating = 1) AS one_star_count,
  COUNT(*) FILTER (WHERE status = 'new') AS unreviewed_count,
  MAX(created_at) AS latest_feedback_at
FROM public.feedback;
