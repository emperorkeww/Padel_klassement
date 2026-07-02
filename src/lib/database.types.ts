export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      attendance: {
        Row: {
          date: string
          group_id: string
          player_id: string
          status: string
          updated_at: string
        }
        Insert: {
          date: string
          group_id: string
          player_id: string
          status: string
          updated_at?: string
        }
        Update: {
          date?: string
          group_id?: string
          player_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          player_id: string
          role: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          player_id: string
          role?: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          player_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_points: {
        Row: {
          created_at: string
          game_number: number
          id: string
          is_golden_point: boolean
          match_id: string
          point_number: number
          set_number: number
          won_by_team_id: string
        }
        Insert: {
          created_at?: string
          game_number: number
          id?: string
          is_golden_point?: boolean
          match_id: string
          point_number: number
          set_number: number
          won_by_team_id: string
        }
        Update: {
          created_at?: string
          game_number?: number
          id?: string
          is_golden_point?: boolean
          match_id?: string
          point_number?: number
          set_number?: number
          won_by_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_points_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_points_won_by_team_id_fkey"
            columns: ["won_by_team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_points_won_by_team_id_fkey"
            columns: ["won_by_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string | null
          id: string
          played_at: string | null
          round_number: number | null
          score_a: number | null
          score_b: number | null
          status: Database["public"]["Enums"]["match_status"]
          team_a_id: string
          team_b_id: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          played_at?: string | null
          round_number?: number | null
          score_a?: number | null
          score_b?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          team_a_id: string
          team_b_id: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          played_at?: string | null
          round_number?: number | null
          score_a?: number | null
          score_b?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          team_a_id?: string
          team_b_id?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          games: number
          player_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          games?: number
          player_id: string
          rating?: number
          updated_at?: string
        }
        Update: {
          games?: number
          player_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_history: {
        Row: {
          delta: number
          id: string
          match_id: string
          played_at: string
          player_id: string
          rating_after: number
          rating_before: number
        }
        Insert: {
          delta: number
          id?: string
          match_id: string
          played_at: string
          player_id: string
          rating_after: number
          rating_before: number
        }
        Update: {
          delta?: number
          id?: string
          match_id?: string
          played_at?: string
          player_id?: string
          rating_after?: number
          rating_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "rating_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "rating_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string | null
          player1_id: string
          player2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          player1_id: string
          player2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          player1_id?: string
          player2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "group_player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      group_player_standings: {
        Row: {
          drawn: number | null
          full_name: string | null
          goal_diff: number | null
          group_id: string | null
          lost: number | null
          played: number | null
          player_id: string | null
          points: number | null
          username: string | null
          won: number | null
        }
        Relationships: []
      }
      player_standings: {
        Row: {
          drawn: number | null
          full_name: string | null
          goal_diff: number | null
          lost: number | null
          played: number | null
          player_id: string | null
          points: number | null
          username: string | null
          won: number | null
        }
        Relationships: []
      }
      standings: {
        Row: {
          drawn: number | null
          goal_diff: number | null
          lost: number | null
          played: number | null
          points: number | null
          team_id: string | null
          team_name: string | null
          won: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_rating: {
        Args: {
          p_delta: number
          p_match: string
          p_player: string
          p_ts: string
        }
        Returns: undefined
      }
      _ensure_team: { Args: { p_a: string; p_b: string }; Returns: string }
      are_friends: { Args: { p_a: string; p_b: string }; Returns: boolean }
      create_completed_match: {
        Args: {
          p_a1: string
          p_a2: string
          p_b1: string
          p_b2: string
          p_group_id?: string
          p_score_a?: number
          p_score_b?: number
          p_winner: string
        }
        Returns: string
      }
      generate_americano_round: {
        Args: { p_group_id: string }
        Returns: string[]
      }
      generate_mexicano_round: {
        Args: { p_group_id: string }
        Returns: string[]
      }
      is_group_member: {
        Args: { p_group_id: string; p_uid: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { p_group_id: string; p_uid: string }
        Returns: boolean
      }
      recompute_ratings: { Args: never; Returns: undefined }
    }
    Enums: {
      match_status: "scheduled" | "in_progress" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      match_status: ["scheduled", "in_progress", "completed", "cancelled"],
    },
  },
} as const

