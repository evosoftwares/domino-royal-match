export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      game_players: {
        Row: {
          game_id: string | null
          hand: Json | null
          id: string
          is_ready: boolean | null
          joined_at: string | null
          position: number
          score: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          game_id?: string | null
          hand?: Json | null
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          position: number
          score?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          game_id?: string | null
          hand?: Json | null
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          position?: number
          score?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          board_state: Json | null
          created_at: string | null
          current_players: number | null
          current_turn: string | null
          entry_fee: number | null
          id: string
          max_players: number | null
          name: string
          prize_pool: number | null
          status: string | null
          turn_start_time: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          board_state?: Json | null
          created_at?: string | null
          current_players?: number | null
          current_turn?: string | null
          entry_fee?: number | null
          id?: string
          max_players?: number | null
          name: string
          prize_pool?: number | null
          status?: string | null
          turn_start_time?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          board_state?: Json | null
          created_at?: string | null
          current_players?: number | null
          current_turn?: string | null
          entry_fee?: number | null
          id?: string
          max_players?: number | null
          name?: string
          prize_pool?: number | null
          status?: string | null
          turn_start_time?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          board_state: Json | null
          consecutive_passes: number | null
          created_at: string | null
          current_player_turn: string | null
          entry_fee: number | null
          id: string
          prize_pool: number | null
          status: string | null
          turn_start_time: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          board_state?: Json | null
          consecutive_passes?: number | null
          created_at?: string | null
          current_player_turn?: string | null
          entry_fee?: number | null
          id?: string
          prize_pool?: number | null
          status?: string | null
          turn_start_time?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          board_state?: Json | null
          consecutive_passes?: number | null
          created_at?: string | null
          current_player_turn?: string | null
          entry_fee?: number | null
          id?: string
          prize_pool?: number | null
          status?: string | null
          turn_start_time?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: []
      }
      matchmaking_queue: {
        Row: {
          created_at: string | null
          id: string
          idjogopleiteado: number
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          idjogopleiteado: number
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          idjogopleiteado?: number
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_presence: {
        Row: {
          last_seen: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      solicitacoes: {
        Row: {
          created_at: string
          error_message: string | null
          game_id: string
          id: string
          processed_at: string | null
          status: string
          timeout_duration: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          game_id: string
          id?: string
          processed_at?: string | null
          status?: string
          timeout_duration?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          game_id?: string
          id?: string
          processed_at?: string | null
          status?: string
          timeout_duration?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          game_id: string | null
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_play_for_offline_player: {
        Args: { game_id_param: string }
        Returns: boolean
      }
      check_user_in_active_game: {
        Args: { p_user_id: string }
        Returns: {
          game_id: string
        }[]
      }
      cleanup_malformed_games: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_offline_player_games: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_solicitacoes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_timed_out_games: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_matchmaking_queue: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          status: string
          created_at: string
        }[]
      }
      is_player_online: {
        Args: { player_user_id: string }
        Returns: boolean
      }
      join_matchmaking_queue: {
        Args: Record<PropertyKey, never> | { p_id_jogo_pleiteado: number }
        Returns: Json
      }
      leave_matchmaking_queue: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      pass_turn: {
        Args: { p_game_id: string }
        Returns: undefined
      }
      play_move: {
        Args: { p_game_id: string; p_piece: Json; p_side: string }
        Returns: undefined
      }
      play_piece_periodically: {
        Args: { p_game_id: string }
        Returns: undefined
      }
      process_auto_play_request: {
        Args: { request_id: string }
        Returns: boolean
      }
      start_game: {
        Args: { p_player_ids: string[]; p_room_id?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
