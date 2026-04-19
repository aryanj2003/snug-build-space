export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          case_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["audit_event_type"]
          hash: string
          id: string
          payload: Json
          prev_hash: string | null
          seq: number
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["audit_event_type"]
          hash: string
          id?: string
          payload?: Json
          prev_hash?: string | null
          seq: number
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["audit_event_type"]
          hash?: string
          id?: string
          payload?: Json
          prev_hash?: string | null
          seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          amount_cents: number | null
          classification_confidence: number | null
          completeness_score: number | null
          created_at: string
          currency: string | null
          customer_contact_masked: string | null
          customer_name: string | null
          description: string | null
          dispute_reason: Database["public"]["Enums"]["dispute_reason"] | null
          id: string
          last4: string | null
          merchant: string | null
          missing_fields: string[] | null
          network: Database["public"]["Enums"]["network_type"] | null
          priority: Database["public"]["Enums"]["case_priority"]
          raw_transcript: string | null
          routed_reason_code: string | null
          routed_rule_id: string | null
          routed_vendor_id: string | null
          scored_alternatives: Json | null
          status: Database["public"]["Enums"]["case_status"]
          transaction_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          classification_confidence?: number | null
          completeness_score?: number | null
          created_at?: string
          currency?: string | null
          customer_contact_masked?: string | null
          customer_name?: string | null
          description?: string | null
          dispute_reason?: Database["public"]["Enums"]["dispute_reason"] | null
          id?: string
          last4?: string | null
          merchant?: string | null
          missing_fields?: string[] | null
          network?: Database["public"]["Enums"]["network_type"] | null
          priority?: Database["public"]["Enums"]["case_priority"]
          raw_transcript?: string | null
          routed_reason_code?: string | null
          routed_rule_id?: string | null
          routed_vendor_id?: string | null
          scored_alternatives?: Json | null
          status?: Database["public"]["Enums"]["case_status"]
          transaction_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          classification_confidence?: number | null
          completeness_score?: number | null
          created_at?: string
          currency?: string | null
          customer_contact_masked?: string | null
          customer_name?: string | null
          description?: string | null
          dispute_reason?: Database["public"]["Enums"]["dispute_reason"] | null
          id?: string
          last4?: string | null
          merchant?: string | null
          missing_fields?: string[] | null
          network?: Database["public"]["Enums"]["network_type"] | null
          priority?: Database["public"]["Enums"]["case_priority"]
          raw_transcript?: string | null
          routed_reason_code?: string | null
          routed_rule_id?: string | null
          routed_vendor_id?: string | null
          scored_alternatives?: Json | null
          status?: Database["public"]["Enums"]["case_status"]
          transaction_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_routed_rule_id_fkey"
            columns: ["routed_rule_id"]
            isOneToOne: false
            referencedRelation: "routing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_routed_vendor_id_fkey"
            columns: ["routed_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          max_amount_cents: number | null
          min_amount_cents: number | null
          network: Database["public"]["Enums"]["network_type"] | null
          priority: number
          reason: Database["public"]["Enums"]["dispute_reason"] | null
          reason_code: string | null
          vendor_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id: string
          max_amount_cents?: number | null
          min_amount_cents?: number | null
          network?: Database["public"]["Enums"]["network_type"] | null
          priority: number
          reason?: Database["public"]["Enums"]["dispute_reason"] | null
          reason_code?: string | null
          vendor_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          max_amount_cents?: number | null
          min_amount_cents?: number | null
          network?: Database["public"]["Enums"]["network_type"] | null
          priority?: number
          reason?: Database["public"]["Enums"]["dispute_reason"] | null
          reason_code?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_registry: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          reason_code_map: Json
          supports_networks: Database["public"]["Enums"]["network_type"][]
          supports_reasons: Database["public"]["Enums"]["dispute_reason"][]
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id: string
          name: string
          reason_code_map?: Json
          supports_networks?: Database["public"]["Enums"]["network_type"][]
          supports_reasons?: Database["public"]["Enums"]["dispute_reason"][]
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          reason_code_map?: Json
          supports_networks?: Database["public"]["Enums"]["network_type"][]
          supports_reasons?: Database["public"]["Enums"]["dispute_reason"][]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_event_type:
        | "session_started"
        | "field_captured"
        | "classified"
        | "completeness_scored"
        | "routed"
        | "committed"
        | "verified"
      case_priority: "low" | "normal" | "high" | "urgent"
      case_status: "intake" | "classified" | "routed" | "committed" | "failed"
      dispute_reason:
        | "unauthorized"
        | "product_not_received"
        | "product_not_as_described"
        | "duplicate_charge"
        | "cancelled_recurring"
        | "credit_not_processed"
        | "other"
      network_type: "VISA" | "MC" | "AMEX" | "DISCOVER" | "OTHER"
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
  public: {
    Enums: {
      audit_event_type: [
        "session_started",
        "field_captured",
        "classified",
        "completeness_scored",
        "routed",
        "committed",
        "verified",
      ],
      case_priority: ["low", "normal", "high", "urgent"],
      case_status: ["intake", "classified", "routed", "committed", "failed"],
      dispute_reason: [
        "unauthorized",
        "product_not_received",
        "product_not_as_described",
        "duplicate_charge",
        "cancelled_recurring",
        "credit_not_processed",
        "other",
      ],
      network_type: ["VISA", "MC", "AMEX", "DISCOVER", "OTHER"],
    },
  },
} as const
