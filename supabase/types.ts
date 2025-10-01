export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      invite_codes: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          role: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          role?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          role?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
      };
      items: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          tags: string[] | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          name: string;
          tags?: string[] | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          tags?: string[] | null;
        };
      };
      loot_tables: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          metadata: Json | null;
          name: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
          definition: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          definition: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          definition?: Json;
        };
      };
      loot_table_guaranteed: {
        Row: {
          created_at: string;
          loot_table_id: string;
          payload: Json;
        };
        Insert: {
          created_at?: string;
          loot_table_id: string;
          payload: Json;
        };
        Update: {
          created_at?: string;
          loot_table_id?: string;
          payload?: Json;
        };
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
}
