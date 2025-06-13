import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id } = await req.json()

    if (!user_id) {
      throw new Error('user_id é obrigatório')
    }

    console.log('Iniciando processo de criação de jogo para user_id:', user_id)

    // 1. Buscar todos os jogadores na fila (deve ter exatamente 4)
    const { data: queuePlayers, error: queueError } = await supabaseClient
      .from('matchmaking_queue')
      .select('user_id, created_at')
      .eq('status', 'searching')
      .order('created_at', { ascending: true })
      .limit(4)

    if (queueError) {
      console.error('Erro ao buscar fila:', queueError)
      throw new Error(`Erro ao buscar fila: ${queueError.message}`)
    }

    if (!queuePlayers || queuePlayers.length !== 4) {
      throw new Error(`Fila deve ter exatamente 4 jogadores. Encontrados: ${queuePlayers?.length || 0}`)
    }

    console.log('Jogadores encontrados na fila:', queuePlayers.map(p => p.user_id))

    // 2. Atualizar status da fila para "matched"
    const { error: updateQueueError } = await supabaseClient
      .from('matchmaking_queue')
      .update({ status: 'matched' })
      .in('user_id', queuePlayers.map(p => p.user_id))

    if (updateQueueError) {
      console.error('Erro ao atualizar fila:', updateQueueError)
      throw new Error(`Erro ao atualizar fila: ${updateQueueError.message}`)
    }

    console.log('Status da fila atualizado para "matched"')

    // 3. Criar o jogo
    const { data: newGame, error: gameError } = await supabaseClient
      .from('games')
      .insert({
        status: 'waiting',
        entry_fee: 1.10,
        prize_pool: 4.00,
        board_state: {},
        consecutive_passes: 0
      })
      .select()
      .single()

    if (gameError) {
      console.error('Erro ao criar jogo:', gameError)
      throw new Error(`Erro ao criar jogo: ${gameError.message}`)
    }

    console.log('Jogo criado com ID:', newGame.id)

    // 4. Gerar mãos de dominó para cada jogador
    const generateDominoHand = () => {
      // Criar todas as peças de dominó (0-0 até 6-6)
      const allPieces = []
      for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
          allPieces.push({ l: i, r: j })
        }
      }
      
      // Embaralhar as peças
      for (let i = allPieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPieces[i], allPieces[j]] = [allPieces[j], allPieces[i]]
      }
      
      // Distribuir 7 peças para cada jogador
      const hands = []
      for (let player = 0; player < 4; player++) {
        hands.push(allPieces.slice(player * 7, (player + 1) * 7))
      }
      
      return hands
    }

    const playerHands = generateDominoHand()

    // 5. Criar registros na tabela game_players
    const gamePlayersData = queuePlayers.map((queuePlayer, index) => ({
      game_id: newGame.id,
      user_id: queuePlayer.user_id,
      position: index + 1,
      hand: playerHands[index],
      score: 0,
      is_ready: false
    }))

    const { error: playersError } = await supabaseClient
      .from('game_players')
      .insert(gamePlayersData)

    if (playersError) {
      console.error('Erro ao criar jogadores:', playersError)
      throw new Error(`Erro ao criar jogadores: ${playersError.message}`)
    }

    console.log('Jogadores criados no jogo')

    // 6. Atualizar o jogo para status "active"
    const { error: activateGameError } = await supabaseClient
      .from('games')
      .update({ status: 'active' })
      .eq('id', newGame.id)

    if (activateGameError) {
      console.error('Erro ao ativar jogo:', activateGameError)
      throw new Error(`Erro ao ativar jogo: ${activateGameError.message}`)
    }

    console.log('Jogo ativado com sucesso')

    // 7. Limpar a fila (remover jogadores que foram matched)
    const { error: clearQueueError } = await supabaseClient
      .from('matchmaking_queue')
      .delete()
      .in('user_id', queuePlayers.map(p => p.user_id))

    if (clearQueueError) {
      console.error('Erro ao limpar fila:', clearQueueError)
      // Não vamos falhar aqui, apenas logar o erro
    } else {
      console.log('Fila limpa com sucesso')
    }

    return new Response(
      JSON.stringify({
        success: true,
        game_id: newGame.id,
        players: queuePlayers.map(p => p.user_id),
        message: 'Jogo criado com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro na função create-game:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 