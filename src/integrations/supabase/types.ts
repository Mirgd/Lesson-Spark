export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      lesson_plans: {
        Row: {
          completion_pct: number;
          content_language: string;
          created_at: string;
          curriculum_ref: string | null;
          date: string | null;
          grade: string | null;
          homework: Json | null;
          id: string;
          local_id: string | null;
          objectives: string | null;
          outcomes: Json | null;
          phases: Json | null;
          presentation_slides: Json | null;
          question_bank: Json | null;
          status: string;
          subject: string | null;
          topic: string | null;
          unit: string | null;
          updated_at: string;
          user_id: string;
          worksheet: Json | null;
        };
        Insert: {
          completion_pct?: number;
          content_language?: string;
          created_at?: string;
          curriculum_ref?: string | null;
          date?: string | null;
          grade?: string | null;
          homework?: Json | null;
          id?: string;
          local_id?: string | null;
          objectives?: string | null;
          outcomes?: Json | null;
          phases?: Json | null;
          presentation_slides?: Json | null;
          question_bank?: Json | null;
          status?: string;
          subject?: string | null;
          topic?: string | null;
          unit?: string | null;
          updated_at?: string;
          user_id: string;
          worksheet?: Json | null;
        };
        Update: {
          completion_pct?: number;
          content_language?: string;
          created_at?: string;
          curriculum_ref?: string | null;
          date?: string | null;
          grade?: string | null;
          homework?: Json | null;
          id?: string;
          local_id?: string | null;
          objectives?: string | null;
          outcomes?: Json | null;
          phases?: Json | null;
          presentation_slides?: Json | null;
          question_bank?: Json | null;
          status?: string;
          subject?: string | null;
          topic?: string | null;
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
          worksheet?: Json | null;
        };
        Relationships: [];
      };
      open_plans: {
        Row: {
          completion_pct: number;
          created_at: string;
          curriculum_ref: string | null;
          date: string | null;
          grade: string | null;
          homework: Json | null;
          id: string;
          local_id: string | null;
          objectives: string | null;
          outcomes: Json | null;
          phases: Json | null;
          presentation_slides: Json | null;
          question_bank: Json | null;
          status: string;
          subject: string | null;
          teacher_name: string;
          topic: string | null;
          unit: string | null;
          updated_at: string;
          worksheet: Json | null;
        };
        Insert: {
          completion_pct?: number;
          created_at?: string;
          curriculum_ref?: string | null;
          date?: string | null;
          grade?: string | null;
          homework?: Json | null;
          id?: string;
          local_id?: string | null;
          objectives?: string | null;
          outcomes?: Json | null;
          phases?: Json | null;
          presentation_slides?: Json | null;
          question_bank?: Json | null;
          status?: string;
          subject?: string | null;
          teacher_name: string;
          topic?: string | null;
          unit?: string | null;
          updated_at?: string;
          worksheet?: Json | null;
        };
        Update: {
          completion_pct?: number;
          created_at?: string;
          curriculum_ref?: string | null;
          date?: string | null;
          grade?: string | null;
          homework?: Json | null;
          id?: string;
          local_id?: string | null;
          objectives?: string | null;
          outcomes?: Json | null;
          phases?: Json | null;
          presentation_slides?: Json | null;
          question_bank?: Json | null;
          status?: string;
          subject?: string | null;
          teacher_name?: string;
          topic?: string | null;
          unit?: string | null;
          updated_at?: string;
          worksheet?: Json | null;
        };
        Relationships: [];
      };
      open_reviews: {
        Row: {
          comment: string;
          created_at: string;
          id: string;
          plan_id: string;
          rating: number;
          reviewer_name: string;
          teacher_name: string;
          updated_at: string;
        };
        Insert: {
          comment?: string;
          created_at?: string;
          id?: string;
          plan_id: string;
          rating?: number;
          reviewer_name?: string;
          teacher_name?: string;
          updated_at?: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          id?: string;
          plan_id?: string;
          rating?: number;
          reviewer_name?: string;
          teacher_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "open_reviews_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "open_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_reviews: {
        Row: {
          comment: string;
          created_at: string;
          id: string;
          plan_id: string;
          rating: number;
          reviewer_id: string;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          comment?: string;
          created_at?: string;
          id?: string;
          plan_id: string;
          rating: number;
          reviewer_id: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          id?: string;
          plan_id?: string;
          rating?: number;
          reviewer_id?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_reviews_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "lesson_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          branch: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_login: string | null;
          school: string | null;
          school_id: string | null;
          stage: string | null;
          subject: string | null;
        };
        Insert: {
          branch?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          last_login?: string | null;
          school?: string | null;
          school_id?: string | null;
          stage?: string | null;
          subject?: string | null;
        };
        Update: {
          branch?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_login?: string | null;
          school?: string | null;
          school_id?: string | null;
          stage?: string | null;
          subject?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          city: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      supervisor_scope: {
        Row: {
          created_at: string;
          id: string;
          supervisor_id: string;
          teacher_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          supervisor_id: string;
          teacher_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          supervisor_id?: string;
          teacher_id?: string;
        };
        Relationships: [];
      };
      teachers: {
        Row: {
          branch: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          role: string;
          school: string | null;
          stage: string | null;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          branch?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          role?: string;
          school?: string | null;
          stage?: string | null;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          branch?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          role?: string;
          school?: string | null;
          stage?: string | null;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "teacher" | "supervisor" | "admin" | "school_admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["teacher", "supervisor", "admin", "school_admin"],
    },
  },
} as const;
