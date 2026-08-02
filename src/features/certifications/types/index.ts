export type PublicCertificationDomain = {
  id: string;
  name: string;
  weight_percent: number | null;
  sort_order: number;
  topic_count: number;
};

export type PublicCertification = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  provider: string;
  exam_code: string | null;
  version: string;
  effective_at: string | null;
  retired_at: string | null;
  lifecycle_status: string;
  allow_new_attempts: boolean;
  exam_count: number;
  topic_count: number;
  domains: PublicCertificationDomain[];
};
