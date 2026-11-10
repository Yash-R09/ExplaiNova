
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "planning_requests": {
                  Row: {
                    "attempt_id": string | null,"base_storyboard_id": string | null,"base_storyboard_revision": number | null,"created_at": string,"failure_code": string | null,"id": string,"input_snapshot": NonNullable<Json>,"lease_until": string | null,"message": string,"mode": string,"owner_id": string,"project_id": string,"project_revision": number,"reply": string | null,"status": string,"storyboard": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id"?: string | null,"base_storyboard_id"?: string | null,"base_storyboard_revision"?: number | null,"created_at"?: string,"failure_code"?: string | null,"id"?: string,"input_snapshot": NonNullable<Json>,"lease_until"?: string | null,"message": string,"mode"?: string,"owner_id": string,"project_id": string,"project_revision": number,"reply"?: string | null,"status"?: string,"storyboard"?: Json | null
                  }
                  Update: {
                    "attempt_id"?: string | null,"base_storyboard_id"?: string | null,"base_storyboard_revision"?: number | null,"created_at"?: string,"failure_code"?: string | null,"id"?: string,"input_snapshot"?: NonNullable<Json>,"lease_until"?: string | null,"message"?: string,"mode"?: string,"owner_id"?: string,"project_id"?: string,"project_revision"?: number,"reply"?: string | null,"status"?: string,"storyboard"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "planning_requests_owner_id_project_id_base_storyboard_id_fkey"
      columns: ["owner_id","project_id","base_storyboard_id"]
isOneToOne: false
      referencedRelation: "planning_requests"
      referencedColumns: ["owner_id","project_id","id"]
    },{
      foreignKeyName: "planning_requests_owner_id_project_id_project_revision_fkey"
      columns: ["owner_id","project_id","project_revision"]
isOneToOne: false
      referencedRelation: "project_revisions"
      referencedColumns: ["owner_id","project_id","revision"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"deletion_status": string,"owner_id": string,"preferences": NonNullable<Json>,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deletion_status"?: string,"owner_id": string,"preferences"?: NonNullable<Json>,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"deletion_status"?: string,"owner_id"?: string,"preferences"?: NonNullable<Json>,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"project_revisions": {
                  Row: {
                    "audience_level": string,"brief": string,"content_hash": string,"created_at": string,"id": string,"owner_id": string,"project_id": string,"reference_text": string,"revision": number,"settings": NonNullable<Json>,"target_duration_ms": number,"title": string,"tone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_level": string,"brief": string,"content_hash": string,"created_at"?: string,"id"?: string,"owner_id": string,"project_id": string,"reference_text": string,"revision": number,"settings": NonNullable<Json>,"target_duration_ms": number,"title": string,"tone": string
                  }
                  Update: {
                    "audience_level"?: string,"brief"?: string,"content_hash"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"project_id"?: string,"reference_text"?: string,"revision"?: number,"settings"?: NonNullable<Json>,"target_duration_ms"?: number,"title"?: string,"tone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_revisions_owner_id_project_id_fkey"
      columns: ["owner_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["owner_id","id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"edit_version": number,"id": string,"owner_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"edit_version"?: number,"id"?: string,"owner_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"edit_version"?: number,"id"?: string,"owner_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_head_revision_fk"
      columns: ["owner_id","id","edit_version"]
isOneToOne: false
      referencedRelation: "project_revisions"
      referencedColumns: ["owner_id","project_id","revision"]
    },{
      foreignKeyName: "projects_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["owner_id"]
    }
                  ]
                },"storyboard_revisions": {
                  Row: {
                    "content": NonNullable<Json>,"content_hash": string,"created_at": string,"id": string,"owner_id": string,"project_id": string,"revision": number,"storyboard_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"content_hash": string,"created_at"?: string,"id"?: string,"owner_id": string,"project_id": string,"revision": number,"storyboard_id": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"content_hash"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"project_id"?: string,"revision"?: number,"storyboard_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "storyboard_revisions_owner_id_project_id_storyboard_id_fkey"
      columns: ["owner_id","project_id","storyboard_id"]
isOneToOne: false
      referencedRelation: "planning_requests"
      referencedColumns: ["owner_id","project_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_brainstorm_request":
{ Args: { "p_id": string,"p_owner_id": string,"p_project_id": string }; Returns: Json
                           },
"create_idea_project":
{ Args: { "p_command": Json,"p_command_key": string }; Returns: Json
                           },
"duplicate_idea_project":
{ Args: { "p_command": Json,"p_command_key": string,"p_id": string }; Returns: Json
                           },
"finish_brainstorm_request":
{ Args: { "p_attempt_id": string,"p_failure_code"?: string,"p_id": string,"p_reply"?: string }; Returns: boolean
                           },
"finish_storyboard_request":
{ Args: { "p_attempt_id": string,"p_failure_code"?: string,"p_id": string,"p_storyboard"?: Json }; Returns: boolean
                           },
"get_idea_project":
{ Args: { "p_id": string }; Returns: Json
                           },
"list_idea_projects":
{ Args: { "p_before_at"?: string,"p_before_id"?: string,"p_limit"?: number }; Returns: Json
                           },
"list_trashed_idea_projects":
{ Args: { "p_before_at"?: string,"p_before_id"?: string,"p_limit"?: number }; Returns: Json
                           },
"restore_idea_project":
{ Args: { "p_command": Json,"p_command_key": string,"p_id": string }; Returns: Json
                           },
"save_idea_project":
{ Args: { "p_command": Json,"p_command_key": string,"p_id": string }; Returns: Json
                           },
"save_storyboard_revision":
{ Args: { "p_command_key": string,"p_content": Json,"p_expected_revision": number,"p_id": string,"p_owner": string }; Returns: Json
                           },
"search_idea_projects":
{ Args: { "p_before_at"?: string,"p_before_id"?: string,"p_limit"?: number,"p_query": string,"p_trashed"?: boolean }; Returns: Json
                           },
"submit_brainstorm_request":
{ Args: { "p_command": Json,"p_command_key": string,"p_id": string }; Returns: Json
                           },
"submit_storyboard_suggestion":
{ Args: { "p_command_key": string,"p_expected_revision": number,"p_id": string,"p_message": string }; Returns: Json
                           },
"trash_idea_project":
{ Args: { "p_command": Json,"p_command_key": string,"p_id": string }; Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
