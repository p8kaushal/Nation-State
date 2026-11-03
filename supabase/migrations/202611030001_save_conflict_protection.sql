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
