// Em supabase/functions/play-move/index.ts

// ... (início da função, busca de dados do jogo e validações)

// 5. Atualizar o banco de dados para o jogador
const { error: updatePlayerError } = await supabaseAdmin
    .from('game_players').update({ hand: newHand }).eq('id', player.id);
if (updatePlayerError) throw updatePlayerError;

// LÓGICA DE VITÓRIA
if (newHand.length === 0) {
    // O jogador ganhou!
    const { error: endGameError } = await supabaseAdmin.from('games').update({ 
        status: 'finished',
        winner_id: userId,
        current_player_turn: null
    }).eq('id', gameId);
    if (endGameError) throw endGameError;

    // TODO: Adicionar lógica de distribuição do prêmio

    return new Response(JSON.stringify({ success: true, winner: userId }));
} else {
    // O JOGO CONTINUA: Passa a vez e reseta o contador de passes
    const { error: updateGameError } = await supabaseAdmin.from('games').update({ 
        board_state: newBoardState,
        current_player_turn: nextPlayer.user_id,
        turn_start_time: new Date().toISOString(),
        consecutive_passes: 0 // << IMPORTANTE: reseta os passes
    }).eq('id', gameId);
    if(updateGameError) throw updateGameError;
}

return new Response(JSON.stringify({ success: true }));