
-- Create the play_move function
CREATE OR REPLACE FUNCTION public.play_move(p_game_id uuid, p_piece jsonb, p_side text)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    current_board jsonb;
    updated_pieces jsonb;
    new_left_end integer;
    new_right_end integer;
    player_hand jsonb;
    updated_hand jsonb;
    current_user_id uuid;
    next_player_id uuid;
    current_position integer;
    total_players integer;
    piece_left integer;
    piece_right integer;
BEGIN
    -- Get current user
    current_user_id := auth.uid();
    
    -- Verify it's the player's turn
    IF NOT EXISTS (
        SELECT 1 FROM games 
        WHERE id = p_game_id 
        AND current_player_turn = current_user_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Not your turn or game not active';
    END IF;
    
    -- Extract piece values
    IF p_piece ? 'l' AND p_piece ? 'r' THEN
        piece_left := (p_piece->>'l')::integer;
        piece_right := (p_piece->>'r')::integer;
    ELSE
        RAISE EXCEPTION 'Invalid piece format';
    END IF;
    
    -- Get current board state
    SELECT board_state INTO current_board FROM games WHERE id = p_game_id;
    
    -- Initialize board if empty
    IF current_board IS NULL OR NOT (current_board ? 'pieces') THEN
        current_board := jsonb_build_object(
            'pieces', jsonb_build_array(p_piece),
            'left_end', piece_left,
            'right_end', piece_right
        );
    ELSE
        -- Validate the move
        IF p_side = 'left' THEN
            IF (current_board->>'left_end')::integer != piece_right AND (current_board->>'left_end')::integer != piece_left THEN
                RAISE EXCEPTION 'Invalid move: piece does not match left end';
            END IF;
            new_left_end := CASE WHEN (current_board->>'left_end')::integer = piece_right THEN piece_left ELSE piece_right END;
            new_right_end := (current_board->>'right_end')::integer;
        ELSE
            IF (current_board->>'right_end')::integer != piece_left AND (current_board->>'right_end')::integer != piece_right THEN
                RAISE EXCEPTION 'Invalid move: piece does not match right end';
            END IF;
            new_left_end := (current_board->>'left_end')::integer;
            new_right_end := CASE WHEN (current_board->>'right_end')::integer = piece_left THEN piece_right ELSE piece_left END;
        END IF;
        
        -- Add piece to board
        updated_pieces := current_board->'pieces' || jsonb_build_array(p_piece);
        current_board := jsonb_build_object(
            'pieces', updated_pieces,
            'left_end', new_left_end,
            'right_end', new_right_end
        );
    END IF;
    
    -- Remove piece from player's hand
    SELECT hand, position INTO player_hand, current_position 
    FROM game_players 
    WHERE game_id = p_game_id AND user_id = current_user_id;
    
    SELECT jsonb_agg(piece) INTO updated_hand
    FROM (
        SELECT piece
        FROM jsonb_array_elements(player_hand) AS piece
        WHERE piece != p_piece
        LIMIT (jsonb_array_length(player_hand) - 1)
    ) AS remaining_pieces;
    
    -- Update player's hand
    UPDATE game_players 
    SET hand = COALESCE(updated_hand, '[]'::jsonb)
    WHERE game_id = p_game_id AND user_id = current_user_id;
    
    -- Get next player
    SELECT COUNT(*) INTO total_players FROM game_players WHERE game_id = p_game_id;
    SELECT user_id INTO next_player_id 
    FROM game_players 
    WHERE game_id = p_game_id 
    AND position = (current_position % total_players) + 1;
    
    -- Update game state
    UPDATE games 
    SET 
        board_state = current_board,
        current_player_turn = next_player_id,
        turn_start_time = NOW(),
        consecutive_passes = 0,
        updated_at = NOW()
    WHERE id = p_game_id;
END;
$function$;

-- Create the pass_turn function
CREATE OR REPLACE FUNCTION public.pass_turn(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    current_user_id uuid;
    next_player_id uuid;
    current_position integer;
    total_players integer;
    current_passes integer;
BEGIN
    -- Get current user
    current_user_id := auth.uid();
    
    -- Verify it's the player's turn
    IF NOT EXISTS (
        SELECT 1 FROM games 
        WHERE id = p_game_id 
        AND current_player_turn = current_user_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Not your turn or game not active';
    END IF;
    
    -- Get current consecutive passes
    SELECT consecutive_passes INTO current_passes FROM games WHERE id = p_game_id;
    
    -- Get player position
    SELECT position INTO current_position 
    FROM game_players 
    WHERE game_id = p_game_id AND user_id = current_user_id;
    
    -- Get next player
    SELECT COUNT(*) INTO total_players FROM game_players WHERE game_id = p_game_id;
    SELECT user_id INTO next_player_id 
    FROM game_players 
    WHERE game_id = p_game_id 
    AND position = (current_position % total_players) + 1;
    
    -- Update game state
    UPDATE games 
    SET 
        current_player_turn = next_player_id,
        turn_start_time = NOW(),
        consecutive_passes = current_passes + 1,
        updated_at = NOW()
    WHERE id = p_game_id;
    
    -- Check if game should end (all players passed)
    IF current_passes + 1 >= total_players THEN
        UPDATE games 
        SET status = 'finished'
        WHERE id = p_game_id;
    END IF;
END;
$function$;

-- Create matchmaking functions
CREATE OR REPLACE FUNCTION public.join_matchmaking_queue()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    current_user_id uuid;
    queue_count integer;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- Check if already in queue
    IF EXISTS (SELECT 1 FROM matchmaking_queue WHERE user_id = current_user_id AND status = 'searching') THEN
        SELECT COUNT(*) INTO queue_count FROM matchmaking_queue WHERE status = 'searching';
        RETURN jsonb_build_object('success', true, 'message', 'Already in queue', 'queue_count', queue_count);
    END IF;
    
    -- Add to queue
    INSERT INTO matchmaking_queue (user_id, status) 
    VALUES (current_user_id, 'searching')
    ON CONFLICT (user_id) DO UPDATE SET status = 'searching', updated_at = NOW();
    
    SELECT COUNT(*) INTO queue_count FROM matchmaking_queue WHERE status = 'searching';
    
    RETURN jsonb_build_object('success', true, 'message', 'Added to queue', 'queue_count', queue_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_matchmaking_queue()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    DELETE FROM matchmaking_queue WHERE user_id = current_user_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Removed from queue');
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_game_when_ready()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    queue_users uuid[];
    new_game_id uuid;
    user_id uuid;
    pos integer;
BEGIN
    -- Get users from queue (limit to 4 for domino game)
    SELECT ARRAY(
        SELECT mq.user_id 
        FROM matchmaking_queue mq 
        WHERE mq.status = 'searching' 
        ORDER BY mq.created_at 
        LIMIT 4
    ) INTO queue_users;
    
    -- Need at least 2 players
    IF array_length(queue_users, 1) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough players');
    END IF;
    
    -- Create new game
    INSERT INTO games (status, prize_pool) 
    VALUES ('waiting', 4.0) 
    RETURNING id INTO new_game_id;
    
    -- Add players to game
    pos := 1;
    FOREACH user_id IN ARRAY queue_users LOOP
        INSERT INTO game_players (game_id, user_id, position) 
        VALUES (new_game_id, user_id, pos);
        pos := pos + 1;
    END LOOP;
    
    -- Remove players from queue
    DELETE FROM matchmaking_queue WHERE user_id = ANY(queue_users);
    
    -- Start the game
    UPDATE games SET status = 'active', current_player_turn = queue_users[1] WHERE id = new_game_id;
    
    RETURN jsonb_build_object('success', true, 'game_id', new_game_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.play_piece_periodically(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    current_user_id uuid;
    player_hand jsonb;
    piece_to_play jsonb;
    board_state jsonb;
    left_end integer;
    right_end integer;
    can_play boolean := false;
    piece jsonb;
BEGIN
    current_user_id := auth.uid();
    
    -- Get player's hand
    SELECT hand INTO player_hand 
    FROM game_players 
    WHERE game_id = p_game_id AND user_id = current_user_id;
    
    -- Get board state
    SELECT games.board_state INTO board_state FROM games WHERE id = p_game_id;
    
    -- Get open ends
    IF board_state IS NULL OR NOT (board_state ? 'pieces') OR jsonb_array_length(board_state->'pieces') = 0 THEN
        -- First move, play any piece
        piece_to_play := player_hand->0;
        can_play := true;
    ELSE
        left_end := (board_state->>'left_end')::integer;
        right_end := (board_state->>'right_end')::integer;
        
        -- Find a playable piece
        FOR i IN 0..jsonb_array_length(player_hand)-1 LOOP
            piece := player_hand->i;
            IF (piece->>'l')::integer IN (left_end, right_end) OR (piece->>'r')::integer IN (left_end, right_end) THEN
                piece_to_play := piece;
                can_play := true;
                EXIT;
            END IF;
        END LOOP;
    END IF;
    
    -- Play the piece or pass
    IF can_play THEN
        -- Determine which side to play
        IF board_state IS NULL OR NOT (board_state ? 'pieces') OR jsonb_array_length(board_state->'pieces') = 0 THEN
            PERFORM play_move(p_game_id, piece_to_play, 'left');
        ELSE
            IF (piece_to_play->>'l')::integer IN (left_end) OR (piece_to_play->>'r')::integer IN (left_end) THEN
                PERFORM play_move(p_game_id, piece_to_play, 'left');
            ELSE
                PERFORM play_move(p_game_id, piece_to_play, 'right');
            END IF;
        END IF;
    ELSE
        PERFORM pass_turn(p_game_id);
    END IF;
END;
$function$;
