
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PlayMoveRequest {
  gameId: string;
  piece: { l: number; r: number } | { top: number; bottom: number };
  side?: 'left' | 'right';
}

interface GameState {
  id: string;
  status: string;
  current_player_turn: string;
  board_state: any;
  consecutive_passes: number;
  version?: number;
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

    const { gameId, piece, side }: PlayMoveRequest = await req.json()

    console.log(`🎯 PLAY MOVE: User ${user.id} playing piece`, piece, 'on side', side, 'in game', gameId)

    // Normalize piece format to backend format
    const normalizedPiece = 'l' in piece && 'r' in piece 
      ? piece 
      : { l: (piece as any).top, r: (piece as any).bottom }

    console.log('📦 Normalized piece format:', normalizedPiece)

    // STEP 1: Acquire optimistic lock and get current game state
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

    // STEP 3: Get current player data
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

    // STEP 4: Validate player has the piece
    const playerHand = player.hand || []
    const hasPiece = playerHand.some((p: any) => {
      if ('l' in p && 'r' in p) {
        return (p.l === normalizedPiece.l && p.r === normalizedPiece.r) ||
               (p.l === normalizedPiece.r && p.r === normalizedPiece.l)
      }
      return false
    })

    if (!hasPiece) {
      throw new Error('Player does not have this piece')
    }

    console.log('✅ Player has piece, proceeding with move validation')

    // STEP 5: Validate move against board state
    let newBoardState = game.board_state || { pieces: [], left_end: null, right_end: null }
    let determinedSide = side

    // If board is empty, this is the first move
    if (!newBoardState.pieces || newBoardState.pieces.length === 0) {
      newBoardState = {
        pieces: [{ piece: normalizedPiece, side: 'initial' }],
        left_end: normalizedPiece.l,
        right_end: normalizedPiece.r
      }
      determinedSide = 'left'
      console.log('🎯 First move on empty board')
    } else {
      // Validate connection to existing board
      const leftEnd = newBoardState.left_end
      const rightEnd = newBoardState.right_end

      console.log(`🎲 Board ends: left=${leftEnd}, right=${rightEnd}`)
      console.log(`🎲 Piece values: l=${normalizedPiece.l}, r=${normalizedPiece.r}`)

      const canConnectLeft = normalizedPiece.l === leftEnd || normalizedPiece.r === leftEnd
      const canConnectRight = normalizedPiece.l === rightEnd || normalizedPiece.r === rightEnd

      if (!canConnectLeft && !canConnectRight) {
        throw new Error(`Piece [${normalizedPiece.l}|${normalizedPiece.r}] cannot connect to board ends [${leftEnd}|${rightEnd}]`)
      }

      // Determine side if not provided
      if (!determinedSide) {
        determinedSide = canConnectLeft ? 'left' : 'right'
      }

      // Validate chosen side
      if (determinedSide === 'left' && !canConnectLeft) {
        throw new Error('Cannot connect piece to left side')
      }
      if (determinedSide === 'right' && !canConnectRight) {
        throw new Error('Cannot connect piece to right side')
      }

      // Update board state
      const newPieces = [...newBoardState.pieces]
      
      if (determinedSide === 'left') {
        newPieces.unshift({ piece: normalizedPiece, side: 'left' })
        newBoardState.left_end = normalizedPiece.l === leftEnd ? normalizedPiece.r : normalizedPiece.l
      } else {
        newPieces.push({ piece: normalizedPiece, side: 'right' })
        newBoardState.right_end = normalizedPiece.l === rightEnd ? normalizedPiece.r : normalizedPiece.l
      }

      newBoardState.pieces = newPieces
      console.log(`✅ Move validated, playing on ${determinedSide} side`)
    }

    // STEP 6: Update player's hand (remove played piece)
    const newHand = playerHand.filter((p: any) => {
      if ('l' in p && 'r' in p) {
        return !((p.l === normalizedPiece.l && p.r === normalizedPiece.r) ||
                (p.l === normalizedPiece.r && p.r === normalizedPiece.l))
      }
      return true
    })

    console.log(`🎯 Hand updated: ${playerHand.length} -> ${newHand.length} pieces`)

    // STEP 7: Get next player
    const { data: allPlayers, error: playersError } = await supabaseClient
      .from('game_players')
      .select('user_id, position')
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

    console.log(`🔄 Next player: position ${currentPosition} -> ${nextPosition} (${nextPlayer.user_id})`)

    // STEP 8: Check for win condition
    if (newHand.length === 0) {
      console.log('🏆 VICTORY! Player has no more pieces')
      
      // Update game as finished with winner
      const { error: winUpdateError } = await supabaseClient
        .from('games')
        .update({
          status: 'finished',
          winner_id: user.id,
          current_player_turn: null,
          board_state: newBoardState,
          updated_at: new Date().toISOString()
        })
        .eq('id', gameId)

      if (winUpdateError) {
        throw new Error(`Failed to update game for win: ${winUpdateError.message}`)
      }

      // Update player's hand
      const { error: handUpdateError } = await supabaseClient
        .from('game_players')
        .update({ hand: newHand })
        .eq('id', player.id)

      if (handUpdateError) {
        throw new Error(`Failed to update player hand: ${handUpdateError.message}`)
      }

      console.log('✅ Game finished, winner recorded')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          winner: user.id, 
          gameFinished: true,
          message: 'Congratulations! You won!' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // STEP 9: Continue game - update all states atomically
    const { error: gameUpdateError } = await supabaseClient
      .from('games')
      .update({
        board_state: newBoardState,
        current_player_turn: nextPlayer.user_id,
        turn_start_time: new Date().toISOString(),
        consecutive_passes: 0, // Reset passes when a piece is played
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId)

    if (gameUpdateError) {
      throw new Error(`Failed to update game: ${gameUpdateError.message}`)
    }

    // Update player's hand
    const { error: handUpdateError } = await supabaseClient
      .from('game_players')
      .update({ hand: newHand })
      .eq('id', player.id)

    if (handUpdateError) {
      throw new Error(`Failed to update player hand: ${handUpdateError.message}`)
    }

    console.log('✅ PLAY MOVE completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Move played successfully',
        nextPlayer: nextPlayer.user_id,
        piecesRemaining: newHand.length,
        boardState: newBoardState
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ PLAY MOVE ERROR:', error)
    
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
