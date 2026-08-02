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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_content_reports: {
        Row: {
          attempt_id: string | null
          created_at: string
          feature: string
          id: string
          note: string | null
          question_id: string | null
          reason: string
          reported_text: string
          request_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          feature: string
          id?: string
          note?: string | null
          question_id?: string | null
          reason: string
          reported_text: string
          request_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          feature?: string
          id?: string
          note?: string | null
          question_id?: string | null
          reason?: string
          reported_text?: string
          request_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_reports_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feature_flags: {
        Row: {
          created_at: string
          description: string
          is_enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description: string
          is_enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          is_enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_interview_sessions: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          planned_questions: number
          questions_asked: number
          status: string
          style: string
          title: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          id?: string
          planned_questions?: number
          questions_asked?: number
          status?: string
          style: string
          title?: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          planned_questions?: number
          questions_asked?: number
          status?: string
          style?: string
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_interview_turns: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          sort_order: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          sort_order: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_interview_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          attempt_id: string | null
          completion_tokens: number | null
          created_at: string
          error_code: string | null
          feature: string
          id: string
          latency_ms: number | null
          metadata: Json
          model: string | null
          prompt_tokens: number | null
          request_id: string | null
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_code?: string | null
          feature: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          prompt_tokens?: number | null
          request_id?: string | null
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_code?: string | null
          feature?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          prompt_tokens?: number | null
          request_id?: string | null
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          method: string
          organization_id: string | null
          outcome: string
          path: string
          request_id: string | null
          status_code: number
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          method: string
          organization_id?: string | null
          outcome: string
          path: string
          request_id?: string | null
          status_code: number
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          method?: string
          organization_id?: string | null
          outcome?: string
          path?: string
          request_id?: string | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "organization_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_settings: {
        Row: {
          application_name: string
          application_version: string
          created_at: string
          default_exam_duration_minutes: number
          default_passing_scaled_score: number
          footer_disclaimer: string
          id: string
          support_email: string
          tagline: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_name?: string
          application_version?: string
          created_at?: string
          default_exam_duration_minutes?: number
          default_passing_scaled_score?: number
          footer_disclaimer?: string
          id?: string
          support_email?: string
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_name?: string
          application_version?: string
          created_at?: string
          default_exam_duration_minutes?: number
          default_passing_scaled_score?: number
          footer_disclaimer?: string
          id?: string
          support_email?: string
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attempt_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          earned_points: number | null
          id: string
          is_correct: boolean | null
          marked_for_review: boolean
          question_id: string
          selected_option_ids: string[]
          statement_responses: Json
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          earned_points?: number | null
          id?: string
          is_correct?: boolean | null
          marked_for_review?: boolean
          question_id: string
          selected_option_ids?: string[]
          statement_responses?: Json
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          earned_points?: number | null
          id?: string
          is_correct?: boolean | null
          marked_for_review?: boolean
          question_id?: string
          selected_option_ids?: string[]
          statement_responses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_questions: {
        Row: {
          attempt_id: string
          created_at: string
          domain_id: string | null
          id: string
          is_pilot: boolean
          option_order: string[]
          points: number
          position: number
          question_id: string
          scoring_method: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          domain_id?: string | null
          id?: string
          is_pilot?: boolean
          option_order?: string[]
          points?: number
          position: number
          question_id: string
          scoring_method?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          domain_id?: string | null
          id?: string
          is_pilot?: boolean
          option_order?: string[]
          points?: number
          position?: number
          question_id?: string
          scoring_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_questions_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          available_points: number | null
          blueprint_id: string | null
          blueprint_snapshot: Json
          cancelled_at: string | null
          created_at: string
          duration_seconds: number | null
          earned_points: number | null
          exam_id: string
          expires_at: string | null
          id: string
          max_score: number | null
          mode: string
          passed: boolean | null
          percentage: number | null
          pilot_count: number
          raw_score: number | null
          scaled_score: number | null
          score: number | null
          scored_count: number
          scoring_model_version: string | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          available_points?: number | null
          blueprint_id?: string | null
          blueprint_snapshot?: Json
          cancelled_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          earned_points?: number | null
          exam_id: string
          expires_at?: string | null
          id?: string
          max_score?: number | null
          mode?: string
          passed?: boolean | null
          percentage?: number | null
          pilot_count?: number
          raw_score?: number | null
          scaled_score?: number | null
          score?: number | null
          scored_count?: number
          scoring_model_version?: string | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          available_points?: number | null
          blueprint_id?: string | null
          blueprint_snapshot?: Json
          cancelled_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          earned_points?: number | null
          exam_id?: string
          expires_at?: string | null
          id?: string
          max_score?: number | null
          mode?: string
          passed?: boolean | null
          percentage?: number | null
          pilot_count?: number
          raw_score?: number | null
          scaled_score?: number | null
          score?: number | null
          scored_count?: number
          scoring_model_version?: string | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "exam_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_scoring_model_version_fkey"
            columns: ["scoring_model_version"]
            isOneToOne: false
            referencedRelation: "scoring_models"
            referencedColumns: ["version"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          created_at: string
          gstin: string | null
          id: string
          is_business: boolean
          legal_name: string
          place_of_supply: string | null
          postal_code: string | null
          state_code: string | null
          state_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          gstin?: string | null
          id?: string
          is_business?: boolean
          legal_name: string
          place_of_supply?: string | null
          postal_code?: string | null
          state_code?: string | null
          state_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          gstin?: string | null
          id?: string
          is_business?: boolean
          legal_name?: string
          place_of_supply?: string | null
          postal_code?: string | null
          state_code?: string | null
          state_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      case_studies: {
        Row: {
          business_requirements: string | null
          certification_id: string
          constraints: string | null
          created_at: string
          created_by: string | null
          exhibits: Json
          existing_environment: string | null
          id: string
          is_active: boolean
          organization_overview: string | null
          security_requirements: string | null
          technical_requirements: string | null
          title: string
          updated_at: string
        }
        Insert: {
          business_requirements?: string | null
          certification_id: string
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          exhibits?: Json
          existing_environment?: string | null
          id?: string
          is_active?: boolean
          organization_overview?: string | null
          security_requirements?: string | null
          technical_requirements?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          business_requirements?: string | null
          certification_id?: string
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          exhibits?: Json
          existing_environment?: string | null
          id?: string
          is_active?: boolean
          organization_overview?: string | null
          security_requirements?: string | null
          technical_requirements?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_studies_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          allow_new_attempts: boolean
          code: string
          created_at: string
          description: string | null
          effective_at: string | null
          exam_code: string | null
          family_id: string
          id: string
          is_active: boolean
          lifecycle_status: string
          name: string
          provider: string
          retired_at: string | null
          supersedes_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          allow_new_attempts?: boolean
          code: string
          created_at?: string
          description?: string | null
          effective_at?: string | null
          exam_code?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          lifecycle_status?: string
          name: string
          provider?: string
          retired_at?: string | null
          supersedes_id?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          allow_new_attempts?: boolean
          code?: string
          created_at?: string
          description?: string | null
          effective_at?: string | null
          exam_code?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          lifecycle_status?: string
          name?: string
          provider?: string
          retired_at?: string | null
          supersedes_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_minor: number
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_minor: number
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_minor?: number
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          per_user_limit: number
          redemption_count: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          per_user_limit?: number
          redemption_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          per_user_limit?: number
          redemption_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          byte_size: number
          created_at: string
          download_count: number
          expires_at: string
          id: string
          organization_id: string | null
          payload: Json
          requested_at: string
          scope: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          byte_size?: number
          created_at?: string
          download_count?: number
          expires_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          requested_at?: string
          scope: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          download_count?: number
          expires_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          requested_at?: string
          scope?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived: boolean
          category: Database["public"]["Enums"]["document_category"]
          certification_id: string | null
          created_at: string
          description: string | null
          domain_id: string | null
          exam_id: string | null
          file_extension: string
          folder_id: string | null
          id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          tags: string[]
          title: string
          topic_id: string | null
          updated_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        Insert: {
          archived?: boolean
          category?: Database["public"]["Enums"]["document_category"]
          certification_id?: string | null
          created_at?: string
          description?: string | null
          domain_id?: string | null
          exam_id?: string | null
          file_extension: string
          folder_id?: string | null
          id?: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          tags?: string[]
          title: string
          topic_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Update: {
          archived?: boolean
          category?: Database["public"]["Enums"]["document_category"]
          certification_id?: string | null
          created_at?: string
          description?: string | null
          domain_id?: string | null
          exam_id?: string | null
          file_extension?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          title?: string
          topic_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          certification_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          weight_percent: number | null
        }
        Insert: {
          certification_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          weight_percent?: number | null
        }
        Update: {
          certification_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          weight_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          attempt_id: string | null
          attempts: number
          body: string
          created_at: string
          dead_lettered_at: string | null
          exam_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          refund_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          attempts?: number
          body: string
          created_at?: string
          dead_lettered_at?: string | null
          exam_id?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string | null
          refund_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject: string
          template: string
          to_email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          attempts?: number
          body?: string
          created_at?: string
          dead_lettered_at?: string | null
          exam_id?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string | null
          refund_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          access_scope: string
          certification_id: string | null
          created_at: string
          exam_id: string | null
          expires_at: string | null
          granted_by: string | null
          id: string
          order_id: string | null
          product_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          source: string
          starts_at: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_scope: string
          certification_id?: string | null
          created_at?: string
          exam_id?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          source: string
          starts_at?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_scope?: string
          certification_id?: string | null
          created_at?: string
          exam_id?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          source?: string
          starts_at?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_blueprint_domains: {
        Row: {
          blueprint_id: string
          created_at: string
          domain_id: string
          id: string
          max_percent: number
          min_percent: number
          sort_order: number
          topic_quotas: Json
          updated_at: string
        }
        Insert: {
          blueprint_id: string
          created_at?: string
          domain_id: string
          id?: string
          max_percent: number
          min_percent: number
          sort_order?: number
          topic_quotas?: Json
          updated_at?: string
        }
        Update: {
          blueprint_id?: string
          created_at?: string
          domain_id?: string
          id?: string
          max_percent?: number
          min_percent?: number
          sort_order?: number
          topic_quotas?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_blueprint_domains_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "exam_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_blueprint_domains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_blueprints: {
        Row: {
          allow_case_study_return: boolean
          allow_partial_credit: boolean
          allow_repeats: boolean
          allowed_question_types: string[]
          case_study_count: number
          certification_id: string
          created_at: string
          created_by: string | null
          default_question_count: number
          description: string | null
          difficulty_distribution: Json
          duration_minutes: number | null
          id: string
          is_published: boolean
          max_question_count: number
          max_repeat_count: number
          min_question_count: number
          mode: string
          name: string
          passing_scaled_score: number
          pilot_question_count: number
          randomize_options: boolean
          randomize_questions: boolean
          repetition_cooldown_days: number
          scoring_model_version: string
          updated_at: string
        }
        Insert: {
          allow_case_study_return?: boolean
          allow_partial_credit?: boolean
          allow_repeats?: boolean
          allowed_question_types?: string[]
          case_study_count?: number
          certification_id: string
          created_at?: string
          created_by?: string | null
          default_question_count?: number
          description?: string | null
          difficulty_distribution?: Json
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          max_question_count?: number
          max_repeat_count?: number
          min_question_count?: number
          mode?: string
          name: string
          passing_scaled_score?: number
          pilot_question_count?: number
          randomize_options?: boolean
          randomize_questions?: boolean
          repetition_cooldown_days?: number
          scoring_model_version?: string
          updated_at?: string
        }
        Update: {
          allow_case_study_return?: boolean
          allow_partial_credit?: boolean
          allow_repeats?: boolean
          allowed_question_types?: string[]
          case_study_count?: number
          certification_id?: string
          created_at?: string
          created_by?: string | null
          default_question_count?: number
          description?: string | null
          difficulty_distribution?: Json
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          max_question_count?: number
          max_repeat_count?: number
          min_question_count?: number
          mode?: string
          name?: string
          passing_scaled_score?: number
          pilot_question_count?: number
          randomize_options?: boolean
          randomize_questions?: boolean
          repetition_cooldown_days?: number
          scoring_model_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_blueprints_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_blueprints_scoring_model_version_fkey"
            columns: ["scoring_model_version"]
            isOneToOne: false
            referencedRelation: "scoring_models"
            referencedColumns: ["version"]
          },
        ]
      }
      exam_questions: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          allow_practice: boolean
          allow_timed: boolean
          blueprint_id: string | null
          certification_id: string
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          is_active: boolean
          is_published: boolean
          passing_score: number
          question_count: number
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_practice?: boolean
          allow_timed?: boolean
          blueprint_id?: string | null
          certification_id: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_published?: boolean
          passing_score?: number
          question_count?: number
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_practice?: boolean
          allow_timed?: boolean
          blueprint_id?: string | null
          certification_id?: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_published?: boolean
          passing_score?: number
          question_count?: number
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "exam_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          amount_minor: number | null
          created_at: string
          currency: string | null
          details: Json
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          amount_minor?: number | null
          created_at?: string
          currency?: string | null
          details?: Json
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          amount_minor?: number | null
          created_at?: string
          currency?: string | null
          details?: Json
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          attestation_statement: string | null
          attested_at: string | null
          attested_by: string | null
          certification_id: string | null
          commit_report: Json
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string
          duplicate_scanned_at: string | null
          error_rows: number
          expires_at: string
          failed_rows: number
          file_type: string
          filename: string
          flagged_rows: number
          id: string
          imported_rows: number
          notes: string | null
          status: string
          total_rows: number
          updated_at: string
          valid_rows: number
        }
        Insert: {
          attestation_statement?: string | null
          attested_at?: string | null
          attested_by?: string | null
          certification_id?: string | null
          commit_report?: Json
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by: string
          duplicate_scanned_at?: string | null
          error_rows?: number
          expires_at?: string
          failed_rows?: number
          file_type?: string
          filename: string
          flagged_rows?: number
          id?: string
          imported_rows?: number
          notes?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Update: {
          attestation_statement?: string | null
          attested_at?: string | null
          attested_by?: string | null
          certification_id?: string | null
          commit_report?: Json
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string
          duplicate_scanned_at?: string | null
          error_rows?: number
          expires_at?: string
          failed_rows?: number
          file_type?: string
          filename?: string
          flagged_rows?: number
          id?: string
          imported_rows?: number
          notes?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      import_staged_rows: {
        Row: {
          batch_id: string
          committed_at: string | null
          created_at: string
          duplicate_matches: Json
          duplicate_score: number | null
          duplicate_status: string
          errors: Json
          external_id: string | null
          id: string
          is_valid: boolean
          normalized: Json
          question_id: string | null
          raw: Json
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          row_number: number
        }
        Insert: {
          batch_id: string
          committed_at?: string | null
          created_at?: string
          duplicate_matches?: Json
          duplicate_score?: number | null
          duplicate_status?: string
          errors?: Json
          external_id?: string | null
          id?: string
          is_valid?: boolean
          normalized?: Json
          question_id?: string | null
          raw?: Json
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_number: number
        }
        Update: {
          batch_id?: string
          committed_at?: string | null
          created_at?: string
          duplicate_matches?: Json
          duplicate_score?: number | null
          duplicate_status?: string
          errors?: Json
          external_id?: string | null
          id?: string
          is_valid?: boolean
          normalized?: Json
          question_id?: string | null
          raw?: Json
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_staged_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_staged_rows_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          buyer_details: Json
          buyer_gstin: string | null
          created_at: string
          currency: string
          discount_minor: number
          document_url: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          order_id: string
          place_of_supply: string | null
          seller_details: Json
          status: string
          subtotal_minor: number
          tax_breakdown: Json
          tax_minor: number
          tax_note: string
          total_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_details?: Json
          buyer_gstin?: string | null
          created_at?: string
          currency?: string
          discount_minor?: number
          document_url?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          order_id: string
          place_of_supply?: string | null
          seller_details?: Json
          status?: string
          subtotal_minor?: number
          tax_breakdown?: Json
          tax_minor?: number
          tax_note?: string
          total_minor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_details?: Json
          buyer_gstin?: string | null
          created_at?: string
          currency?: string
          discount_minor?: number
          document_url?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          order_id?: string
          place_of_supply?: string | null
          seller_details?: Json
          status?: string
          subtotal_minor?: number
          tax_breakdown?: Json
          tax_minor?: number
          tax_note?: string
          total_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          context: string
          doc_type: string
          document_id: string
          id: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          context?: string
          doc_type: string
          document_id: string
          id?: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          context?: string
          doc_type?: string
          document_id?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          body: string
          created_at: string
          doc_type: string
          effective_at: string | null
          id: string
          is_current: boolean
          is_placeholder: boolean
          summary: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          body: string
          created_at?: string
          doc_type: string
          effective_at?: string | null
          id?: string
          is_current?: boolean
          is_placeholder?: boolean
          summary?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          doc_type?: string
          effective_at?: string | null
          id?: string
          is_current?: boolean
          is_placeholder?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_id: string
          product_id: string
          product_name: string
          quantity: number
          total_minor: number
          unit_amount_minor: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price_id: string
          product_id: string
          product_name: string
          quantity?: number
          total_minor: number
          unit_amount_minor: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total_minor?: number
          unit_amount_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          discount_minor: number
          id: string
          notes: string | null
          order_number: string
          paid_at: string | null
          placed_at: string | null
          status: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_minor?: number
          id?: string
          notes?: string | null
          order_number: string
          paid_at?: string | null
          placed_at?: string | null
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_minor?: number
          id?: string
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          placed_at?: string | null
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          rate_limit_per_hour: number
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          rate_limit_per_hour?: number
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          rate_limit_per_hour?: number
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          accent_color: string
          app_name: string
          background_color: string
          created_at: string
          custom_domain: string | null
          custom_domain_verification_token: string
          custom_domain_verified: boolean
          email_footer_text: string
          email_from_name: string
          email_header_color: string
          email_reply_to: string | null
          favicon_url: string | null
          foreground_color: string
          id: string
          is_published: boolean
          logo_url: string | null
          organization_id: string
          primary_color: string
          support_email: string | null
          surface_color: string
          tagline: string
          theme_mode: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          app_name?: string
          background_color?: string
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string
          custom_domain_verified?: boolean
          email_footer_text?: string
          email_from_name?: string
          email_header_color?: string
          email_reply_to?: string | null
          favicon_url?: string | null
          foreground_color?: string
          id?: string
          is_published?: boolean
          logo_url?: string | null
          organization_id: string
          primary_color?: string
          support_email?: string | null
          surface_color?: string
          tagline?: string
          theme_mode?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          app_name?: string
          background_color?: string
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string
          custom_domain_verified?: boolean
          email_footer_text?: string
          email_from_name?: string
          email_header_color?: string
          email_reply_to?: string | null
          favicon_url?: string | null
          foreground_color?: string
          id?: string
          is_published?: boolean
          logo_url?: string | null
          organization_id?: string
          primary_color?: string
          support_email?: string | null
          surface_color?: string
          tagline?: string
          theme_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_deletion_requests: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_deletion_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_entitlements: {
        Row: {
          access_scope: string
          certification_id: string | null
          created_at: string
          exam_id: string | null
          expires_at: string | null
          granted_by: string | null
          id: string
          organization_id: string
          revoke_reason: string | null
          revoked_at: string | null
          seats: number | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          access_scope: string
          certification_id?: string | null
          created_at?: string
          exam_id?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          seats?: number | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_scope?: string
          certification_id?: string | null
          created_at?: string
          exam_id?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          seats?: number | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_entitlements_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_entitlements_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          removed_at: string | null
          status: Database["public"]["Enums"]["org_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          removed_at?: string | null
          status?: Database["public"]["Enums"]["org_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          removed_at?: string | null
          status?: Database["public"]["Enums"]["org_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          allow_domain_join: boolean
          allowed_email_domains: string[]
          created_at: string
          default_certification_id: string | null
          id: string
          organization_id: string
          seat_limit: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_domain_join?: boolean
          allowed_email_domains?: string[]
          created_at?: string
          default_certification_id?: string | null
          id?: string
          organization_id: string
          seat_limit?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_domain_join?: boolean
          allowed_email_domains?: string[]
          created_at?: string
          default_certification_id?: string | null
          id?: string
          organization_id?: string
          seat_limit?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_default_certification_id_fkey"
            columns: ["default_certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sso_configurations: {
        Row: {
          allowed_redirect_urls: string[]
          client_id: string | null
          created_at: string
          display_name: string | null
          email_domains: string[]
          id: string
          is_enforced: boolean
          issuer_url: string | null
          metadata_url: string | null
          method: string
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          allowed_redirect_urls?: string[]
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          email_domains?: string[]
          id?: string
          is_enforced?: boolean
          issuer_url?: string | null
          metadata_url?: string | null
          method?: string
          notes?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          allowed_redirect_urls?: string[]
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          email_domains?: string[]
          id?: string
          is_enforced?: boolean
          issuer_url?: string | null
          metadata_url?: string | null
          method?: string
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_sso_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          event_types: string[]
          id: string
          last_delivery_at: string | null
          last_delivery_status: string | null
          name: string
          organization_id: string
          secret: string
          status: string
          target_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_types?: string[]
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          name: string
          organization_id: string
          secret: string
          status?: string
          target_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_types?: string[]
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          name?: string
          organization_id?: string
          secret?: string
          status?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          metadata: Json
          method: string | null
          order_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          method?: string | null
          order_id: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          method?: string | null
          order_id?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          amount_minor: number
          billing_interval: string | null
          created_at: string
          currency: string
          id: string
          interval_count: number
          is_active: boolean
          product_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          billing_interval?: string | null
          created_at?: string
          currency?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          product_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          billing_interval?: string | null
          created_at?: string
          currency?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          access_days: number | null
          access_scope: string
          certification_id: string | null
          code: string
          created_at: string
          description: string | null
          exam_id: string | null
          id: string
          is_active: boolean
          name: string
          product_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          access_days?: number | null
          access_scope?: string
          certification_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          exam_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          access_days?: number | null
          access_scope?: string
          certification_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          exam_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_exposure: {
        Row: {
          attempt_ids: string[]
          first_presented_at: string
          last_attempt_id: string | null
          last_marked_for_review: boolean
          last_presented_at: string
          last_result: string | null
          last_time_spent_seconds: number | null
          question_id: string
          times_presented: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_ids?: string[]
          first_presented_at?: string
          last_attempt_id?: string | null
          last_marked_for_review?: boolean
          last_presented_at?: string
          last_result?: string | null
          last_time_spent_seconds?: number | null
          question_id: string
          times_presented?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_ids?: string[]
          first_presented_at?: string
          last_attempt_id?: string | null
          last_marked_for_review?: boolean
          last_presented_at?: string
          last_result?: string | null
          last_time_spent_seconds?: number | null
          question_id?: string
          times_presented?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_exposure_last_attempt_id_fkey"
            columns: ["last_attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_exposure_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          content: string
          created_at: string
          id: string
          is_correct: boolean
          label: string | null
          question_id: string
          sort_order: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_correct?: boolean
          label?: string | null
          question_id: string
          sort_order?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          label?: string | null
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          case_study_id: string | null
          certification_id: string
          created_at: string
          difficulty: string
          exam_id: string | null
          explanation: string | null
          governance_status: string
          id: string
          import_batch_id: string | null
          is_active: boolean
          is_archived: boolean
          is_pilot_eligible: boolean
          points: number
          question_type: string
          review_flag: boolean
          scenario: string | null
          scoring_method: string
          sort_order: number
          source_page: string | null
          stem: string
          tags: string[]
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          case_study_id?: string | null
          certification_id: string
          created_at?: string
          difficulty?: string
          exam_id?: string | null
          explanation?: string | null
          governance_status?: string
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          is_archived?: boolean
          is_pilot_eligible?: boolean
          points?: number
          question_type?: string
          review_flag?: boolean
          scenario?: string | null
          scoring_method?: string
          sort_order?: number
          source_page?: string | null
          stem: string
          tags?: string[]
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          case_study_id?: string | null
          certification_id?: string
          created_at?: string
          difficulty?: string
          exam_id?: string | null
          explanation?: string | null
          governance_status?: string
          id?: string
          import_batch_id?: string | null
          is_active?: boolean
          is_archived?: boolean
          is_pilot_eligible?: boolean
          points?: number
          question_type?: string
          review_flag?: boolean
          scenario?: string | null
          scoring_method?: string
          sort_order?: number
          source_page?: string | null
          stem?: string
          tags?: string[]
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_case_study_id_fkey"
            columns: ["case_study_id"]
            isOneToOne: false
            referencedRelation: "case_studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          order_id: string
          payment_attempt_id: string | null
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          order_id: string
          payment_attempt_id?: string | null
          provider_reference?: string | null
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          order_id?: string
          payment_attempt_id?: string | null
          provider_reference?: string | null
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_attempt_id_fkey"
            columns: ["payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          ai_log_retention_days: number
          api_log_retention_days: number
          attempt_retention_days: number | null
          created_at: string
          deletion_grace_days: number
          export_ttl_hours: number
          id: string
          notes: string | null
          organization_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_log_retention_days?: number
          api_log_retention_days?: number
          attempt_retention_days?: number | null
          created_at?: string
          deletion_grace_days?: number
          export_ttl_hours?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_log_retention_days?: number
          api_log_retention_days?: number
          attempt_retention_days?: number | null
          created_at?: string
          deletion_grace_days?: number
          export_ttl_hours?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_runs: {
        Row: {
          created_at: string
          errors: Json
          finished_at: string | null
          id: string
          report: Json
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          report?: Json
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          report?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      scim_provisioning_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          revoked_at: string | null
          status: string
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          revoked_at?: string | null
          status?: string
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          revoked_at?: string | null
          status?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_provisioning_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_models: {
        Row: {
          created_at: string
          default_threshold: number
          description: string
          formula: string
          is_active: boolean
          label: string
          max_scaled_score: number
          min_scaled_score: number
          version: string
        }
        Insert: {
          created_at?: string
          default_threshold?: number
          description: string
          formula: string
          is_active?: boolean
          label: string
          max_scaled_score?: number
          min_scaled_score?: number
          version: string
        }
        Update: {
          created_at?: string
          default_threshold?: number
          description?: string
          formula?: string
          is_active?: boolean
          label?: string
          max_scaled_score?: number
          min_scaled_score?: number
          version?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          price_id: string
          product_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          price_id: string
          product_id: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          price_id?: string
          product_id?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          dead_lettered_at: string | null
          delivered_at: string | null
          event_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string
          response_status: number | null
          signature: string | null
          status: string
          updated_at: string
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dead_lettered_at?: string | null
          delivered_at?: string | null
          event_id: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id: string
          response_status?: number | null
          signature?: string | null
          status?: string
          updated_at?: string
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dead_lettered_at?: string | null
          delivered_at?: string | null
          event_id?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id?: string
          response_status?: number | null
          signature?: string | null
          status?: string
          updated_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "organization_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          organization_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          organization_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_current_legal_documents: {
        Args: { _context?: string }
        Returns: number
      }
      accept_organization_invitation: {
        Args: { _org_id: string }
        Returns: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          removed_at: string | null
          status: Database["public"]["Enums"]["org_member_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_cancel_subscription: {
        Args: { _note?: string; _subscription_id: string }
        Returns: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          price_id: string
          product_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_test_order: {
        Args: { _outcome?: string; _product_id: string; _user_id: string }
        Returns: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          discount_minor: number
          id: string
          notes: string | null
          order_number: string
          paid_at: string | null
          placed_at: string | null
          status: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      allocate_blueprint_domains: {
        Args: { _blueprint_id: string; _total: number }
        Returns: {
          domain_id: string
          target: number
        }[]
      }
      apply_retention_policies: { Args: never; Returns: Json }
      attach_upi_payment_reference: {
        Args: { _metadata?: Json; _order_id: string; _reference: string }
        Returns: undefined
      }
      attempt_item_set: {
        Args: { _attempt_id: string }
        Returns: {
          is_pilot: boolean
          option_order: string[]
          points: number
          question_id: string
          scoring_method: string
          sort_order: number
        }[]
      }
      attest_import_batch: {
        Args: { _batch_id: string; _statement: string }
        Returns: {
          attestation_statement: string | null
          attested_at: string | null
          attested_by: string | null
          certification_id: string | null
          commit_report: Json
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string
          duplicate_scanned_at: string | null
          error_rows: number
          expires_at: string
          failed_rows: number
          file_type: string
          filename: string
          flagged_rows: number
          id: string
          imported_rows: number
          notes: string | null
          status: string
          total_rows: number
          updated_at: string
          valid_rows: number
        }
        SetofOptions: {
          from: "*"
          to: "import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_add_question_tags: {
        Args: { _question_ids: string[]; _tags: string[] }
        Returns: number
      }
      cancel_account_deletion: {
        Args: never
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_attempt: {
        Args: { _attempt_id: string }
        Returns: {
          available_points: number | null
          blueprint_id: string | null
          blueprint_snapshot: Json
          cancelled_at: string | null
          created_at: string
          duration_seconds: number | null
          earned_points: number | null
          exam_id: string
          expires_at: string | null
          id: string
          max_score: number | null
          mode: string
          passed: boolean | null
          percentage: number | null
          pilot_count: number
          raw_score: number | null
          scaled_score: number | null
          score: number | null
          scored_count: number
          scoring_model_version: string | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_organization_deletion: {
        Args: { _organization_id: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_upi_order: { Args: { _order_id: string }; Returns: undefined }
      claim_email_jobs: {
        Args: { _lease_seconds?: number; _limit?: number }
        Returns: {
          attempt_id: string | null
          attempts: number
          body: string
          created_at: string
          dead_lettered_at: string | null
          exam_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          refund_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_webhook_jobs: {
        Args: { _lease_seconds?: number; _limit?: number }
        Returns: {
          attempts: number
          delivery_id: string
          event_created_at: string
          event_id: string
          event_type: string
          idempotency_key: string
          max_attempts: number
          organization_id: string
          payload: Json
          secret: string
          target_url: string
          webhook_id: string
        }[]
      }
      commit_import_batch: { Args: { _batch_id: string }; Returns: Json }
      complete_email_job: {
        Args: { _error?: string; _id: string }
        Returns: {
          attempt_id: string | null
          attempts: number
          body: string
          created_at: string
          dead_lettered_at: string | null
          exam_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          refund_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "email_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_payment_webhook: {
        Args: {
          _error?: string
          _event_id: string
          _provider?: string
          _status: string
        }
        Returns: undefined
      }
      complete_webhook_job: {
        Args: {
          _delivery_id: string
          _error?: string
          _response_status?: number
          _signature?: string
        }
        Returns: {
          attempts: number
          created_at: string
          dead_lettered_at: string | null
          delivered_at: string | null
          event_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string
          response_status: number | null
          signature: string | null
          status: string
          updated_at: string
          webhook_id: string
        }
        SetofOptions: {
          from: "*"
          to: "webhook_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_certification_version: {
        Args: {
          _clone_taxonomy?: boolean
          _effective_at?: string
          _exam_code?: string
          _source_id: string
          _version: string
        }
        Returns: {
          allow_new_attempts: boolean
          code: string
          created_at: string
          description: string | null
          effective_at: string | null
          exam_code: string | null
          family_id: string
          id: string
          is_active: boolean
          lifecycle_status: string
          name: string
          provider: string
          retired_at: string | null
          supersedes_id: string | null
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "certifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization: {
        Args: {
          _contact_email?: string
          _name: string
          _owner_id?: string
          _slug: string
        }
        Returns: {
          contact_email: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization_api_key: {
        Args: {
          _expires_at?: string
          _name: string
          _organization_id: string
          _rate_limit_per_hour?: number
          _scopes: string[]
        }
        Returns: Json
      }
      create_organization_webhook: {
        Args: {
          _event_types: string[]
          _name: string
          _organization_id: string
          _target_url: string
        }
        Returns: Json
      }
      create_upi_order: {
        Args: { _product_id: string; _ttl_minutes?: number }
        Returns: {
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          discount_minor: number
          id: string
          notes: string | null
          order_number: string
          paid_at: string | null
          placed_at: string | null
          status: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_account_deletion: {
        Args: { _decision: string; _note?: string; _request_id: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_organization_deletion: {
        Args: { _decision: string; _note?: string; _request_id: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_refund: {
        Args: { _decision: string; _note?: string; _refund_id: string }
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          order_id: string
          payment_attempt_id: string | null
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      digest_secret: { Args: { _secret: string }; Returns: string }
      enqueue_email_notification: {
        Args: {
          _attempt_id?: string
          _body: string
          _exam_id?: string
          _idempotency_key: string
          _order_id?: string
          _refund_id?: string
          _scheduled_for?: string
          _subject: string
          _template: string
          _user_id: string
        }
        Returns: string
      }
      enqueue_webhook_event: {
        Args: {
          _event_type: string
          _idempotency_key: string
          _organization_id: string
          _payload?: Json
        }
        Returns: string
      }
      exam_is_available: { Args: { _exam_id: string }; Returns: boolean }
      exam_requires_purchase: { Args: { _exam_id: string }; Returns: boolean }
      execute_account_deletion: { Args: { _request_id: string }; Returns: Json }
      execute_organization_deletion: {
        Args: { _request_id: string }
        Returns: Json
      }
      expire_due_access: { Args: never; Returns: Json }
      expire_stale_upi_orders: { Args: never; Returns: number }
      export_my_data: {
        Args: never
        Returns: {
          byte_size: number
          created_at: string
          download_count: number
          expires_at: string
          id: string
          organization_id: string | null
          payload: Json
          requested_at: string
          scope: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "data_export_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      export_organization_data: {
        Args: { _organization_id: string }
        Returns: {
          byte_size: number
          created_at: string
          download_count: number
          expires_at: string
          id: string
          organization_id: string | null
          payload: Json
          requested_at: string
          scope: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "data_export_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_upi_payment: {
        Args: {
          _code?: string
          _message?: string
          _order_id: string
          _provider_reference: string
        }
        Returns: Json
      }
      get_attempt_case_studies: {
        Args: { _attempt_id: string }
        Returns: {
          business_requirements: string
          constraints: string
          exhibits: Json
          existing_environment: string
          id: string
          organization_overview: string
          question_ids: string[]
          security_requirements: string
          technical_requirements: string
          title: string
        }[]
      }
      get_attempt_questions: {
        Args: { _attempt_id: string }
        Returns: {
          case_study_id: string
          options: Json
          points: number
          question_id: string
          question_type: string
          scenario: string
          sort_order: number
          stem: string
        }[]
      }
      get_attempt_result: {
        Args: { _attempt_id: string }
        Returns: {
          attempt_id: string
          available_points: number
          blueprint_duration_minutes: number
          blueprint_name: string
          blueprint_snapshot: Json
          correct_count: number
          domains: Json
          duration_seconds: number
          earned_points: number
          exam_title: string
          incorrect_count: number
          max_score: number
          mode: string
          passed: boolean
          passing_score: number
          percentage: number
          pilot_count: number
          raw_score: number
          scaled_score: number
          scored_count: number
          scoring_model_version: string
          submitted_at: string
          total_questions: number
          unanswered_count: number
        }[]
      }
      get_attempt_review: {
        Args: { _attempt_id: string }
        Returns: {
          case_study_id: string
          case_study_title: string
          difficulty: string
          domain_name: string
          earned_points: number
          explanation: string
          is_pilot: boolean
          marked_for_review: boolean
          options: Json
          points: number
          question_id: string
          question_type: string
          scenario: string
          selected_option_ids: string[]
          sort_order: number
          statement_responses: Json
          status: string
          stem: string
          topic_name: string
        }[]
      }
      get_attempt_time_remaining: {
        Args: { _attempt_id: string }
        Returns: number
      }
      get_blueprint_readiness: {
        Args: { _blueprint_id: string }
        Returns: Json
      }
      get_branding_for_domain: {
        Args: { _host: string }
        Returns: {
          accent_color: string
          app_name: string
          background_color: string
          favicon_url: string
          foreground_color: string
          logo_url: string
          primary_color: string
          surface_color: string
          tagline: string
          theme_mode: string
        }[]
      }
      get_exam_access_map: { Args: never; Returns: Json }
      get_public_certifications: {
        Args: never
        Returns: {
          allow_new_attempts: boolean
          code: string
          description: string
          domains: Json
          effective_at: string
          exam_code: string
          exam_count: number
          id: string
          lifecycle_status: string
          name: string
          provider: string
          retired_at: string
          topic_count: number
          version: string
        }[]
      }
      get_question_bank_readiness: {
        Args: { _certification_id: string }
        Returns: Json
      }
      get_question_explanations: {
        Args: { _question_ids: string[] }
        Returns: {
          explanation: string
          question_id: string
        }[]
      }
      get_question_options: {
        Args: { _question_id: string }
        Returns: {
          content: string
          id: string
          label: string
          question_id: string
          sort_order: number
        }[]
      }
      get_question_stats: {
        Args: { _question_ids: string[] }
        Returns: {
          attempt_count: number
          correct_count: number
          pass_rate: number
          question_id: string
          usage_count: number
        }[]
      }
      get_queue_health: { Args: never; Returns: Json }
      get_upi_payment_status: { Args: { _order_id: string }; Returns: Json }
      grant_admin_role: { Args: { _email: string }; Returns: string }
      has_exam_access: {
        Args: { _exam_id: string; _user_id: string }
        Returns: boolean
      }
      has_org_exam_access: {
        Args: { _exam_id: string; _user_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_organization_member: {
        Args: {
          _email: string
          _org_id: string
          _role?: Database["public"]["Enums"]["org_role"]
        }
        Returns: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          removed_at: string | null
          status: Database["public"]["Enums"]["org_member_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      list_organization_webhooks: {
        Args: { _organization_id: string }
        Returns: {
          created_at: string
          event_types: string[]
          id: string
          last_delivery_at: string
          last_delivery_status: string
          name: string
          organization_id: string
          secret_fingerprint: string
          status: string
          target_url: string
        }[]
      }
      log_financial_action: {
        Args: {
          _action: string
          _actor_type: string
          _details?: Json
          _entity_id: string
          _entity_label: string
          _entity_type: string
        }
        Returns: undefined
      }
      log_retention_action: {
        Args: {
          _action: string
          _details?: Json
          _entity_id: string
          _entity_label: string
          _entity_type: string
          _organization_id?: string
        }
        Returns: undefined
      }
      mark_notification_sent: {
        Args: { _error?: string; _notification_id: string }
        Returns: {
          attempt_id: string | null
          attempts: number
          body: string
          created_at: string
          dead_lettered_at: string | null
          exam_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          refund_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "email_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_refund_processed: {
        Args: { _provider_reference?: string; _refund_id: string }
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          order_id: string
          payment_attempt_id: string | null
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      normalize_content: { Args: { _text: string }; Returns: string }
      notify_result_available: {
        Args: { _attempt_id: string }
        Returns: string
      }
      options_fingerprint: { Args: { _question_id: string }; Returns: string }
      owns_attempt: {
        Args: { _attempt_id: string; _require_active: boolean }
        Returns: boolean
      }
      record_export_download: {
        Args: { _export_id: string }
        Returns: undefined
      }
      record_payment_webhook: {
        Args: {
          _event_id: string
          _event_type: string
          _order_id: string
          _payload: Json
          _provider?: string
        }
        Returns: boolean
      }
      remove_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          removed_at: string | null
          status: Database["public"]["Enums"]["org_member_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_account_deletion: {
        Args: { _reason?: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string | null
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_exam_reminder: {
        Args: { _exam_id: string; _remind_at: string }
        Returns: string
      }
      request_organization_deletion: {
        Args: { _organization_id: string; _reason?: string }
        Returns: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_refund: {
        Args: { _order_id: string; _reason: string }
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          order_id: string
          payment_attempt_id: string | null
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_subscription_cancellation: {
        Args: { _reason?: string; _subscription_id: string }
        Returns: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          price_id: string
          product_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      requeue_email_job: {
        Args: { _id: string }
        Returns: {
          attempt_id: string | null
          attempts: number
          body: string
          created_at: string
          dead_lettered_at: string | null
          exam_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          refund_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "email_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      requeue_webhook_job: {
        Args: { _id: string }
        Returns: {
          attempts: number
          created_at: string
          dead_lettered_at: string | null
          delivered_at: string | null
          event_id: string
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string
          response_status: number | null
          signature: string | null
          status: string
          updated_at: string
          webhook_id: string
        }
        SetofOptions: {
          from: "*"
          to: "webhook_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retire_certification_version: {
        Args: {
          _allow_new_attempts?: boolean
          _certification_id: string
          _retired_at?: string
        }
        Returns: {
          allow_new_attempts: boolean
          code: string
          created_at: string
          description: string | null
          effective_at: string | null
          exam_code: string | null
          family_id: string
          id: string
          is_active: boolean
          lifecycle_status: string
          name: string
          provider: string
          retired_at: string | null
          supersedes_id: string | null
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "certifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_admin_role: { Args: { _email: string }; Returns: string }
      revoke_organization_api_key: {
        Args: { _api_key_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          rate_limit_per_hour: number
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_api_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_nightly_retention: { Args: { _force?: boolean }; Returns: Json }
      scan_import_duplicates: { Args: { _batch_id: string }; Returns: number }
      select_attempt_questions: {
        Args: {
          _attempt_id: string
          _blueprint_id: string
          _domain_filter?: string
          _total: number
        }
        Returns: Json
      }
      set_organization_webhook_status: {
        Args: { _status: string; _webhook_id: string }
        Returns: boolean
      }
      settle_upi_payment: {
        Args: {
          _method?: string
          _order_id: string
          _payload?: Json
          _provider_reference: string
        }
        Returns: Json
      }
      start_attempt: {
        Args: {
          _domain_id?: string
          _exam_id: string
          _mode: string
          _question_count?: number
        }
        Returns: {
          available_points: number | null
          blueprint_id: string | null
          blueprint_snapshot: Json
          cancelled_at: string | null
          created_at: string
          duration_seconds: number | null
          earned_points: number | null
          exam_id: string
          expires_at: string | null
          id: string
          max_score: number | null
          mode: string
          passed: boolean | null
          percentage: number | null
          pilot_count: number
          raw_score: number | null
          scaled_score: number | null
          score: number | null
          scored_count: number
          scoring_model_version: string | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_attempt: {
        Args: { _attempt_id: string }
        Returns: {
          available_points: number | null
          blueprint_id: string | null
          blueprint_snapshot: Json
          cancelled_at: string | null
          created_at: string
          duration_seconds: number | null
          earned_points: number | null
          exam_id: string
          expires_at: string | null
          id: string
          max_score: number | null
          mode: string
          passed: boolean | null
          percentage: number | null
          pilot_count: number
          raw_score: number | null
          scaled_score: number | null
          score: number | null
          scored_count: number
          scoring_model_version: string | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_organization_sso: {
        Args: {
          _allowed_redirect_urls?: string[]
          _client_id?: string
          _display_name?: string
          _email_domains?: string[]
          _is_enforced?: boolean
          _issuer_url?: string
          _metadata_url?: string
          _method: string
          _organization_id: string
          _status?: string
        }
        Returns: {
          allowed_redirect_urls: string[]
          client_id: string | null
          created_at: string
          display_name: string | null
          email_domains: string[]
          id: string
          is_enforced: boolean
          issuer_url: string | null
          metadata_url: string | null
          method: string
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organization_sso_configurations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_retention_policy: {
        Args: {
          _ai_log_retention_days: number
          _api_log_retention_days: number
          _attempt_retention_days?: number
          _deletion_grace_days: number
          _export_ttl_hours: number
          _notes?: string
          _organization_id: string
        }
        Returns: {
          ai_log_retention_days: number
          api_log_retention_days: number
          attempt_retention_days: number | null
          created_at: string
          deletion_grace_days: number
          export_ttl_hours: number
          id: string
          notes: string | null
          organization_id: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "retention_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_subscription_cancellation: {
        Args: { _subscription_id: string }
        Returns: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          price_id: string
          product_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "student" | "admin"
      document_category:
        | "study_notes"
        | "course_material"
        | "revision_guide"
        | "practice_material"
        | "reference"
        | "policy"
        | "trainer_internal"
      document_visibility:
        | "admin_only"
        | "trainer"
        | "students"
        | "exam_assigned"
      org_member_status: "invited" | "active" | "removed"
      org_role: "owner" | "admin" | "manager" | "member"
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
      app_role: ["student", "admin"],
      document_category: [
        "study_notes",
        "course_material",
        "revision_guide",
        "practice_material",
        "reference",
        "policy",
        "trainer_internal",
      ],
      document_visibility: [
        "admin_only",
        "trainer",
        "students",
        "exam_assigned",
      ],
      org_member_status: ["invited", "active", "removed"],
      org_role: ["owner", "admin", "manager", "member"],
    },
  },
} as const
