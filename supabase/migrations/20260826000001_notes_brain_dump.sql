ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_brain_dump boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_analysis jsonb DEFAULT null,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
