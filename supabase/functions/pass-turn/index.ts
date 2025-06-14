
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PassTurnRequest {
  gameId: string;
}

interface GameState {
  id: string;
  status: string;
  current_player_turn: string;
  board_state: any;
  consecutive_passes: number;
}

interface PlayerData {
  id: string;
  user_id: string;
  hand: any[];
  position: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get JWT token from request
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      throw new Error('No authorization token provided')
    }

    // Verify and get user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Invalid authorization token')
    }

    const { gameId }: PassTurnRequest = await req.json()

    console.log(`🔄 PASS TURN: User ${user.id} passing turn in game ${gameId}`)

    // STEP 1: Get current game state
    const { data: gameData, error: gameError } = await supabaseClient
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !gameData) {
      throw new Error(`Game not found: ${gameError?.message}`)
    }

    const game = gameData as GameState

    // STEP 2: Validate game state and player turn
    if (game.status !== 'active') {
      throw new Error(`Game is not active (status: ${game.status})`)
    }

    if (game.current_player_turn !== user.id) {
      throw new Error('Not your turn')
    }

    // STEP 3: Get current player data and validate they cannot play
    const { data: playerData, error: playerError } = await supabaseClient
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .single()

    if (playerError || !playerData) {
      throw new Error(`Player not found: ${playerError?.message}`)
    }

    const player = playerData as PlayerData

    // STEP 4: Check if player has playable pieces
    const playerHand = player.hand || []
    const boardState = game.board_state

    // If board is not empty, check for playable pieces
    if (boardState && boardState.pieces && boardState.pieces.length > 0) {
      const leftEnd = boardState.left_end
      const rightEnd = boardState.right_end
      
      const hasPlayablePiece = playerHand.some((piece: any) => {
        if ('l' in piece && 'r' in piece) {
          return piece.l === leftEnd || piece.r === leftEnd || 
                 piece.l === rightEnd || piece.r === rightEnd
        }
        return false
      })

      if (hasPlayablePiece) {
        throw new Error('You have playable pieces and cannot pass turn')
      }
    }

    console.log('✅ Player has no playable pieces, pass is valid')

    // STEP 5: Get all players to determine next player and check for game end
    const { data: allPlayers, error: playersError } = await supabaseClient
      .from('game_players')
      .select('user_id, position, hand')
      .eq('game_id', gameId)
      .order('position')

    if (playersError || !allPlayers) {
      throw new Error(`Cannot get players: ${playersError?.message}`)
    }

    const totalPlayers = allPlayers.length
    const currentPosition = player.position
    const nextPosition = (currentPosition % totalPlayers) + 1
    const nextPlayer = allPlayers.find(p => p.position === nextPosition)

    if (!nextPlayer) {
      throw new Error('Cannot determine next player')
    }

    const newConsecutivePasses = (game.consecutive_passes || 0) + 1

    console.log(`🔄 Pass count: ${game.consecutive_passes} -> ${newConsecutivePasses}`)
    console.log(`🔄 Next player: position ${currentPosition} -> ${nextPosition} (${nextPlayer.user_id})`)

    // STEP 6: Check if game should end (all players passed)
    if (newConsecutivePasses >= totalPlayers) {
      console.log('🚫 GAME BLOCKED! All players passed consecutively')

      // Calculate points for each player (sum of values in hand)
      let winnerId = null
      let minPoints = Infinity

      for (const p of allPlayers) {
        const hand = p.hand || []
        const points = hand.reduce((sum: number, piece: any) => {
          if ('l' in piece && 'r' in piece) {
            return sum + piece.l + piece.r
          }
          return sum
        }, 0)

        console.log(`🎯 Player ${p.user_id}: ${points} points`)

        if (points < minPoints) {
          minPoints = points
          winnerId = p.user_id
        }
      }

      // Update game as finished due to block
      const { error: blockUpdateError } = await supabaseClient
        .from('games')
        .update({
          status: 'finished',
          winner_id: winnerId,
          current_player_turn: null,
          consecutive_passes: newConsecutivePasses,
          updated_at: new Date().toISOString()
        })
        .eq('id', gameId)

      if (blockUpdateError) {
        throw new Error(`Failed to update game for block: ${blockUpdateError.message}`)
      }

      console.log(`🏆 Game ended by block, winner: ${winnerId} with ${minPoints} points`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          gameFinished: true,
          winner: winnerId,
          reason: 'blocked',
          winnerPoints: minPoints,
          message: 'Game ended - all players passed. Winner has lowest points.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // STEP 7: Continue game - pass to next player
    const { error: passUpdateError } = await supabaseClient
      .from('games')
      .update({
        current_player_turn: nextPlayer.user_id,
        turn_start_time: new Date().toISOString(),
        consecutive_passes: newConsecutivePasses,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId)

    if (passUpdateError) {
      throw new Error(`Failed to update game for pass: ${passUpdateError.message}`)
    }

    console.log('✅ PASS TURN completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Turn passed successfully',
        nextPlayer: nextPlayer.user_id,
        consecutivePasses: newConsecutivePasses,
        remainingPasses: totalPlayers - newConsecutivePasses
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ PASS TURN ERROR:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
