import type { JSONValue } from "@/lib/types";

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, JSONValue>;
        Insert: Record<string, JSONValue>;
        Update: Record<string, JSONValue>;
        Relationships: never[];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
