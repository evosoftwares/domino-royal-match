// Copie e cole este código inteiro no seu arquivo:
// supabase/functions/start-game/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Função auxiliar para gerar o conjunto de peças de dominó
const generateDominoes = () => {
  const dominoes: number[][] = []
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      dominoes.push([i, j])
    }
  }
  return dominoes
}

// Função auxiliar para embaralhar um array
const shuffleArray = (array: any[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { players: playerIds, room_id } = await req.json()

    if (!playerIds || playerIds.length < 2 || playerIds.length > 4) {
      return new Response(JSON.stringify({ error: 'Número de jogadores inválido.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // --- LÓGICA DE DISTRIBUIÇÃO E INÍCIO ---

    // 1. Gera e embaralha as 28 peças
    let allPieces = shuffleArray(generateDominoes())

    // 2. Distribui 6 peças para cada jogador (conforme a regra do seu jogo)
    const hands = playerIds.map(() => allPieces.splice(0, 6));

    // 3. Determina o jogador inicial (quem tem a maior carroça ou a peça de maior valor)
    let startingPlayerIndex = -1;
    let highestDouble = -1;
    let startingPiece: number[] | null = null;
    
    // Procura pela maior carroça
    for (let i = 6; i >= 0; i--) {
        for (let pIdx = 0; pIdx < hands.length; pIdx++) {
            const hand = hands[pIdx];
            const doubleIndex = hand.findIndex(p => p[0] === i && p[1] === i);
            if (doubleIndex !== -1) {
                highestDouble = i;
                startingPlayerIndex = pIdx;
                startingPiece = hand[pIdx][doubleIndex];
                break;
            }
        }
        if (startingPlayerIndex !== -1) break;
    }
    
    // Se ninguém tiver carroça, encontra a peça de maior soma
    if (startingPlayerIndex === -1) {
        let maxPieceValue = -1;
        for (let pIdx = 0; pIdx < hands.length; pIdx++) {
            for (const piece of hands[pIdx]) {
                const value = piece[0] + piece[1];
                if (value > maxPieceValue) {
                    maxPieceValue = value;
                    startingPlayerIndex = pIdx;
                    startingPiece = piece;
                }
            }
        }
    }

    if (!startingPiece || startingPlayerIndex === -1) {
      throw new Error("Não foi possível determinar a peça inicial.");
    }

    // *** CORREÇÃO PRINCIPAL ***
    // 4. Remove a peça inicial da mão do jogador e define o estado inicial do tabuleiro
    const startingHand = hands[startingPlayerIndex];
    const pieceIndexInHand = startingHand.findIndex(p => p.toString() === startingPiece!.toString());
    startingHand.splice(pieceIndexInHand, 1);
    
    const initialBoardState = {
      pieces: [{ piece: startingPiece, orientation: startingPiece[0] === startingPiece[1] ? 'vertical' : 'horizontal' }],
      left_end: startingPiece[0],
      right_end: startingPiece[1],
    };

    const currentPlayerTurnId = playerIds[startingPlayerIndex];
    
    // --- OPERAÇÕES NO BANCO DE DADOS ---

    // 5. Cria o registro do jogo com o estado inicial correto
    const { data: gameData, error: gameError } = await supabaseAdmin
      .from('games')
      .insert({ 
        status: 'active', // O jogo já começa ativo
        prize_amount: 4.00,
        current_player_turn: currentPlayerTurnId, // O próximo jogador já é definido
        turn_start_time: new Date().toISOString(),
        board_state: initialBoardState,
        sleeping_pieces: allPieces, // As 4 peças que sobraram
      })
      .select()
      .single();

    if (gameError) throw gameError;
    const gameId = gameData.id;

    // 6. Define a ordem de jogo e cria os registros dos jogadores
    const playerOrderMap = playerIds.map((_, index) => (index - startingPlayerIndex + playerIds.length) % playerIds.length);

    const gamePlayersData = playerIds.map((userId, index) => ({
      game_id: gameId,
      user_id: userId,
      hand: hands[index],
      position: index + 1, // Posição na mesa (1 a 4)
      player_order: playerOrderMap[index] // Ordem de jogada (0 a 3)
    }));

    const { error: playersError } = await supabaseAdmin.from('game_players').insert(gamePlayersData);
    if (playersError) throw playersError;
    
    // 7. (Opcional) Remove a sala de matchmaking se existir
    if (room_id) {
        await supabaseAdmin.from('game_rooms').delete().eq('id', room_id);
    }

    return new Response(JSON.stringify(gameData), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
