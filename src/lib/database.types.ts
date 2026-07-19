export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      shop_state: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shop_state"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          contact_name: string;
          email: string;
          phone: string;
          address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name: string;
          email: string;
          phone: string;
          address: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      parts: {
        Row: {
          id: string;
          part_number: string;
          name: string;
          category: string;
          quantity: number;
          reorder_at: number;
          cost: number;
          price: number;
          compatibility: string[];
          box_number: number | null;
          inside_diameter_mm: string;
          cross_section_mm: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_number: string;
          name: string;
          category: string;
          quantity?: number;
          reorder_at?: number;
          cost?: number;
          price?: number;
          compatibility?: string[];
          box_number?: number | null;
          inside_diameter_mm?: string;
          cross_section_mm?: string;
          notes?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["parts"]["Insert"]>;
        Relationships: [];
      };
      machines: {
        Row: {
          id: string;
          client_id: string;
          make: string;
          model: string;
          serial_number: string;
          year: number;
          hours: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          make: string;
          model: string;
          serial_number: string;
          year: number;
          hours?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["machines"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          client_id: string;
          machine_id: string;
          date: string;
          status: "Paid" | "Pending" | "Quoted";
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          machine_id: string;
          date: string;
          status?: "Paid" | "Pending" | "Quoted";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      order_lines: {
        Row: {
          id: string;
          order_id: string;
          part_id: string;
          qty: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          part_id: string;
          qty: number;
          unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_lines"]["Insert"]>;
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          client_id: string;
          date: string;
          total: number;
          status: "Draft" | "Sent" | "Accepted" | "Rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          date: string;
          total: number;
          status?: "Draft" | "Sent" | "Accepted" | "Rejected";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotations"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          client_id: string;
          date: string;
          total: number;
          status: "Paid" | "Unpaid" | "Overdue";
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          date: string;
          total: number;
          status?: "Paid" | "Unpaid" | "Overdue";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      supplier_inquiries: {
        Row: {
          id: string;
          supplier: string;
          date: string;
          part_numbers: string[];
          status: "Open" | "Answered" | "Closed";
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier: string;
          date: string;
          part_numbers?: string[];
          status?: "Open" | "Answered" | "Closed";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_inquiries"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
