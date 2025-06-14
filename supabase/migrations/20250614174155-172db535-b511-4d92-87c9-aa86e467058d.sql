
-- Esta função substitui a Edge Function 'start-game'.
-- Ela lida com a criação do jogo, distribuição de peças e seleção do jogador inicial,
-- usando uma tabela temporária para maior robustez.
CREATE OR REPLACE FUNCTION public.start_game(p_player_ids uuid[], p_room_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    -- Geração de peças
    all_pieces jsonb[] := '{}';
    shuffled_pieces jsonb[];
    i integer;
    j integer;
    
    -- Gerenciamento de jogadores
    player_count integer;
    
    -- Lógica do jogador inicial
    starting_player_info record;
    starting_piece jsonb;
    
    -- Registros do banco de dados
    new_game record;
    initial_board_state jsonb;
BEGIN
    player_count := array_length(p_player_ids, 1);

    IF player_count < 2 OR player_count > 4 THEN
        RAISE EXCEPTION 'Número de jogadores inválido (deve ser 2-4)';
    END IF;

    -- Usar uma tabela temporária para as mãos para evitar problemas de sintaxe com arrays
    CREATE TEMPORARY TABLE temp_hands (
        player_index integer PRIMARY KEY,
        user_id uuid,
        hand jsonb
    ) ON COMMIT DROP;

    -- Gerar e embaralhar peças
    FOR i IN 0..6 LOOP
        FOR j IN i..6 LOOP
            all_pieces := array_append(all_pieces, jsonb_build_object('l', i, 'r', j));
        END LOOP;
    END LOOP;
    SELECT array_agg(piece) INTO shuffled_pieces FROM (SELECT unnest(all_pieces) as piece ORDER BY random()) as shuffled;

    -- Distribuir 6 peças para cada jogador
    FOR i IN 1..player_count LOOP
        INSERT INTO temp_hands (player_index, user_id, hand)
        VALUES (i, p_player_ids[i], to_jsonb(shuffled_pieces[((i-1)*6)+1 : i*6]));
    END LOOP;

    -- Determinar jogador inicial
    -- 1. Procurar maior carroça (peça dupla)
    SELECT th.player_index, p.piece
    INTO starting_player_info
    FROM temp_hands th, jsonb_array_elements(th.hand) WITH ORDINALITY AS p(piece, ord)
    WHERE (p.piece->>'l')::int = (p.piece->>'r')::int
    ORDER BY (p.piece->>'l')::int DESC, th.player_index
    LIMIT 1;

    -- 2. Se não houver carroça, procurar peça de maior soma
    IF starting_player_info IS NULL THEN
        SELECT th.player_index, p.piece
        INTO starting_player_info
        FROM temp_hands th, jsonb_array_elements(th.hand) WITH ORDINALITY AS p(piece, ord)
        ORDER BY (p.piece->>'l')::int + (p.piece->>'r')::int DESC, th.player_index
        LIMIT 1;
    END IF;

    IF starting_player_info IS NULL THEN
        RAISE EXCEPTION 'Não foi possível determinar a peça inicial';
    END IF;
    
    starting_piece := starting_player_info.piece;

    -- Remover peça inicial da mão do jogador na tabela temporária
    UPDATE temp_hands
    SET hand = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(hand) AS elem
        WHERE elem != starting_piece
    )
    WHERE player_index = starting_player_info.player_index;

    -- Montar estado inicial do tabuleiro
    initial_board_state := jsonb_build_object(
        'pieces', jsonb_build_array(jsonb_build_object(
            'piece', starting_piece,
            'orientation', CASE WHEN (starting_piece->>'l')::int = (starting_piece->>'r')::int THEN 'vertical' ELSE 'horizontal' END
        )),
        'left_end', (starting_piece->>'l')::integer,
        'right_end', (starting_piece->>'r')::integer
    );

    -- Criar o registro do jogo
    INSERT INTO public.games (
        status, prize_pool, current_player_turn, turn_start_time, board_state
    ) VALUES (
        'active', 4.00, p_player_ids[starting_player_info.player_index], now(), initial_board_state
    ) RETURNING * INTO new_game;

    -- Criar os registros dos jogadores a partir da tabela temporária
    INSERT INTO public.game_players (game_id, user_id, hand, position)
    SELECT new_game.id, th.user_id, th.hand, th.player_index
    FROM temp_hands;

    IF p_room_id IS NOT NULL THEN
        DELETE FROM public.game_rooms WHERE id = p_room_id;
    END IF;

    -- A tabela temporária é descartada automaticamente no COMMIT
    
    RETURN to_jsonb(new_game);
END;
$function$;
