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
          game_id: string
          hand: Json | null
          id: string
          points_in_hand: number | null
          position: number
          status: string
          timeout_count: number | null
          user_id: string
        }
        Insert: {
          game_id: string
          hand?: Json | null
          id?: string
          points_in_hand?: number | null
          position: number
          status?: string
          timeout_count?: number | null
          user_id: string
        }
        Update: {
          game_id?: string
          hand?: Json | null
          id?: string
          points_in_hand?: number | null
          position?: number
          status?: string
          timeout_count?: number | null
          user_id?: string
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          created_at: string | null
          current_players: number | null
          id: string
          max_players: number | null
          prize_amount: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_players?: number | null
          id?: string
          max_players?: number | null
          prize_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_players?: number | null
          id?: string
          max_players?: number | null
          prize_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          board_state: Json | null
          created_at: string | null
          current_player_turn: string | null
          id: string
          prize_amount: number
          sleeping_pieces: Json | null
          status: string
          turn_start_time: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          board_state?: Json | null
          created_at?: string | null
          current_player_turn?: string | null
          id?: string
          prize_amount?: number
          sleeping_pieces?: Json | null
          status?: string
          turn_start_time?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          board_state?: Json | null
          created_at?: string | null
          current_player_turn?: string | null
          id?: string
          prize_amount?: number
          sleeping_pieces?: Json | null
          status?: string
          turn_start_time?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_current_player_turn_fkey"
            columns: ["current_player_turn"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          game_id: string | null
          id: number
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          id?: number
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          id?: number
          type?: string
          user_id?: string
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_empty_rooms: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_matchmaking: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_queue_entries: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_domino_pieces: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      create_game_from_matchmaking: {
        Args: { matchmaking_id: number }
        Returns: undefined
      }
      create_game_from_queue: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      create_game_from_queue_debug: {
        Args: Record<PropertyKey, never>
        Returns: {
          selected_player_ids: string[]
          message: string
        }[]
      }
      create_game_when_ready: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      distribute_pieces_to_room: {
        Args: { room_uuid: string }
        Returns: boolean
      }
      finish_game: {
        Args:
          | Record<PropertyKey, never>
          | { p_game_id: string }
          | { p_game_id: string; p_winner_id: string }
        Returns: undefined
      }
      get_users_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          id: string
          email: string
          user_metadata: Json
          created_at: string
        }[]
      }
      join_game_queue: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      join_matchmaking_queue: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      leave_matchmaking_queue: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      play_move: {
        Args:
          | { p_game_id: string; p_piece: Json; p_side: string }
          | { p_game_id: string; p_piece: Json; p_side: string }
        Returns: string
      }
      run_matchmaker: {
        Args: Record<PropertyKey, never>
        Returns: {
          game_id: string
          players_matched: number
          success: boolean
          message: string
        }[]
      }
      shuffle_json_array: {
        Args: { arr: Json }
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
