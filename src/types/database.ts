/**
 * Tipos do banco usados pelo app.
 *
 * Escrito à mão cobrindo o que as telas consomem hoje. Quando você tiver o
 * Supabase CLI logado, substitua este arquivo pelo gerado:
 *
 *   npx supabase gen types typescript --project-id gahbxnjgldmosowgiksc > src/types/database.ts
 */

export type UserRole = 'cliente' | 'tecnico' | 'admin';

export type ServiceStatus =
  | 'aberto'
  | 'em_analise'
  | 'aguardando_tecnico'
  | 'tecnico_atribuido'
  | 'a_caminho'
  | 'em_atendimento'
  | 'aguardando_peca'
  | 'aguardando_aprovacao'
  | 'finalizado'
  | 'cancelado';

export type ServicePriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export type ServiceType =
  | 'instalacao'
  | 'manutencao_preventiva'
  | 'manutencao_corretiva'
  | 'higienizacao'
  | 'pmoc'
  | 'orcamento'
  | 'visita_tecnica';

export type TechnicianStatus = 'disponivel' | 'em_atendimento' | 'a_caminho' | 'indisponivel';

export type AiRole = 'user' | 'assistant' | 'system';

/** Resumo estruturado que a IA monta durante a triagem. */
export type AiSummary = {
  equipamento?: string;
  sintoma?: string;
  inicio?: string;
  codigo_erro?: string;
  resumo?: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  push_token: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  profile_id: string | null;
  name: string;
  doc: string | null;
  doc_type: 'cpf' | 'cnpj' | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientAddress = {
  id: string;
  client_id: string;
  label: string;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type Equipment = {
  id: string;
  client_id: string;
  address_id: string | null;
  environment: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  kind: string | null;
  btu_capacity: number | null;
  gas_type: string | null;
  technology: string | null;
  installed_at: string | null;
  warranty_until: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Technician = {
  id: string;
  profile_id: string;
  registration: string | null;
  specialties: string[];
  status: TechnicianStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Laudo do técnico sobre a condição física do equipamento. */
export type EquipmentConditionLevel = 'critica' | 'alerta' | 'otimo';

export type ServiceCall = {
  id: string;
  code: number;
  client_id: string;
  equipment_id: string | null;
  address_id: string | null;
  technician_id: string | null;
  status: ServiceStatus;
  priority: ServicePriority;
  service_type: ServiceType;
  title: string;
  description: string | null;
  ai_summary: AiSummary | null;
  diagnosis: string | null;
  solution: string | null;
  /**
   * Não confundir com `service_ratings.equipment_condition`, que é a
   * percepção do cliente. Este campo é o laudo de quem executou.
   */
  equipment_condition: EquipmentConditionLevel | null;
  scheduled_for: string | null;
  /** Fim previsto. Com scheduled_for forma o intervalo reservado (migração 0034). */
  scheduled_end: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceCallStatusHistory = {
  id: string;
  service_call_id: string;
  from_status: ServiceStatus | null;
  to_status: ServiceStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
};

export type MaintenanceSchedule = {
  id: string;
  equipment_id: string;
  service_type: ServiceType;
  frequency_months: number;
  last_done_at: string | null;
  next_due_at: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AiConversation = {
  id: string;
  profile_id: string | null;
  client_id: string | null;
  service_call_id: string | null;
  channel: 'app' | 'whatsapp';
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  role: AiRole;
  content: string;
  metadata: Record<string, unknown>;
  tokens: number | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  profile_id: string;
  title: string;
  body: string | null;
  kind: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/** PMOC — uma linha por rotina executada, base do certificado. */
export type PmocExecutionRow = {
  id: string;
  pmoc_item_id: string;
  technician_id: string | null;
  executed_at: string;
  conforme: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/** PMOC — documento numerado, com o responsável técnico congelado. */
export type PmocCertificateRow = {
  id: string;
  pmoc_id: string;
  number: string;
  period_start: string;
  period_end: string;
  responsible_name: string;
  responsible_registration: string | null;
  signer_name: string | null;
  signature_path: string | null;
  storage_path: string | null;
  issued_by: string | null;
  issued_at: string;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      pmoc_executions: Table<
        PmocExecutionRow,
        Pick<PmocExecutionRow, 'pmoc_item_id'> & Partial<PmocExecutionRow>
      >;
      pmoc_certificates: Table<
        PmocCertificateRow,
        Pick<PmocCertificateRow, 'pmoc_id' | 'number' | 'period_start' | 'period_end' | 'responsible_name'> &
          Partial<PmocCertificateRow>
      >;
      clients: Table<Client>;
      client_addresses: Table<ClientAddress>;
      equipment: Table<Equipment>;
      technicians: Table<Technician>;
      service_calls: Table<
        ServiceCall,
        Pick<ServiceCall, 'client_id' | 'title'> & Partial<ServiceCall>
      >;
      service_call_status_history: Table<ServiceCallStatusHistory>;
      maintenance_schedules: Table<MaintenanceSchedule>;
      ai_conversations: Table<AiConversation>;
      ai_messages: Table<AiMessage, Pick<AiMessage, 'conversation_id' | 'role' | 'content'>>;
      notifications: Table<NotificationRow>;
    };
    Views: Record<string, never>;
    // Funções chamadas com o cliente tipado. As demais RPCs do banco passam
    // por `(supabase as any).rpc(...)` nos serviços e não entram aqui.
    Functions: {
      next_pmoc_certificate_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      report_technician_location: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_accuracy?: number | null;
          p_heading?: number | null;
          p_speed?: number | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      service_status: ServiceStatus;
      service_priority: ServicePriority;
      service_type: ServiceType;
      technician_status: TechnicianStatus;
      equipment_condition_level: EquipmentConditionLevel;
    };
    CompositeTypes: Record<string, never>;
  };
};
