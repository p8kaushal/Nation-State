-- Create Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create Game Saves table
CREATE TABLE public.game_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id text NOT NULL,
  current_turn int4 NOT NULL,
  game_state_json jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT game_saves_user_scenario_unique UNIQUE (user_id, scenario_id)
);

CREATE TABLE public.run_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id text NOT NULL,
  turns_survived int4 NOT NULL,
  result text NOT NULL CHECK (result IN ('win', 'loss')),
  loss_reason text,
  ended_at timestamptz DEFAULT now() NOT NULL,
  grade text,
  performance_title text,
  badges_earned text[],
  final_stats jsonb,
  end_reason text
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_history ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can select their own profile."
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Game Saves Policies
CREATE POLICY "Users can select their own game saves."
  ON public.game_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game saves."
  ON public.game_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own game saves."
  ON public.game_saves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own game saves."
  ON public.game_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Run History Policies
CREATE POLICY "Users can select their own run history."
  ON public.run_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own run history."
  ON public.run_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own run history."
  ON public.run_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own run history."
  ON public.run_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Profile Sync Trigger: Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create User Achievements table
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id)
);

-- Enable Row Level Security (RLS) on user_achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own achievements."
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements."
  ON public.user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Apply before deploying the client that calls save_game_if_unchanged.
ALTER TABLE public.game_saves ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.save_game_if_unchanged(
  p_scenario_id text,
  p_current_turn integer,
  p_game_state jsonb,
  p_expected_revision bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_revision bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_expected_revision IS NULL THEN
    INSERT INTO public.game_saves (user_id, scenario_id, current_turn, game_state_json)
    VALUES (v_user, p_scenario_id, p_current_turn, p_game_state)
    ON CONFLICT (user_id, scenario_id) DO NOTHING
    RETURNING revision INTO v_revision;
  ELSE
    UPDATE public.game_saves
    SET current_turn = p_current_turn, game_state_json = p_game_state,
        revision = revision + 1, updated_at = clock_timestamp()
    WHERE user_id = v_user AND scenario_id = p_scenario_id
      AND revision = p_expected_revision
    RETURNING revision INTO v_revision;
  END IF;
  RETURN jsonb_build_object('saved', v_revision IS NOT NULL, 'revision', v_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.save_game_if_unchanged(text, integer, jsonb, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_game_if_unchanged(text, integer, jsonb, bigint) TO authenticated;
