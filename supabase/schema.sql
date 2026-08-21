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

-- Create Run History table
CREATE TABLE public.run_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id text NOT NULL,
  turns_survived int4 NOT NULL,
  result text NOT NULL CHECK (result IN ('win', 'loss')),
  loss_reason text,
  ended_at timestamptz DEFAULT now() NOT NULL
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

