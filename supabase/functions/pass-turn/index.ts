// Em supabase/functions/pass-turn/index.ts
// ... (início da função, busca de dados e validações)

// Validação principal: o jogador não pode ter uma peça jogável
const { left_end, right_end } = game.board_state;
const canPlay = player.hand.some(p => p.includes(left_end) || p.includes(right_end));
if (canPlay) throw new Error('Você tem uma peça jogável, não pode passar.');

// Lógica de Jogo Fechado
const newConsecutivePasses = game.consecutive_passes + 1;

if (newConsecutivePasses >= players.length) {
    // JOGO FECHADO! Todos passaram.
    // Calcular pontos e encontrar o vencedor (quem tem menos pontos).
    let winnerId = null;
    let minPoints = Infinity;

    for (const p of players) {
        const pointsInHand = p.hand.reduce((sum, piece) => sum + piece[0] + piece[1], 0);
        if (pointsInHand < minPoints) {
            minPoints = pointsInHand;
            winnerId = p.user_id;
        }
    }

    const { error: endGameError } = await supabaseAdmin.from('games').update({
        status: 'finished',
        winner_id: winnerId,
        current_player_turn: null
    }).eq('id', gameId);
    if (endGameError) throw endGameError;

    return new Response(JSON.stringify({ success: true, game_over: 'blocked', winner: winnerId }));

} else {
    // O jogo continua, apenas passa a vez e atualiza o contador de passes.
    const nextPlayer = getNextPlayer(players, userId);
    const { error: updateGameError } = await supabaseAdmin.from('games').update({ 
        current_player_turn: nextPlayer.user_id,
        turn_start_time: new Date().toISOString(),
        consecutive_passes: newConsecutivePasses
    }).eq('id', gameId);
    if(updateGameError) throw updateGameError;
}

return new Response(JSON.stringify({ success: true }));
