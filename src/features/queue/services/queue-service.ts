import { supabase } from "@/integrations/supabase/client";

export type QueueSideHealth = {
  queued?: number;
  pending?: number;
  due: number;
  retrying: number;
  sent?: number;
  delivered?: number;
  dead_letter: number;
  oldest_due: string | null;
};

export type QueueHealth = {
  emails: QueueSideHealth;
  webhooks: QueueSideHealth;
};

/** Admin-only queue snapshot. The RPC re-checks the admin role server-side. */
export async function getQueueHealth(): Promise<QueueHealth> {
  const { data, error } = await supabase.rpc("get_queue_health");
  if (error) throw error;
  return data as unknown as QueueHealth;
}

export async function requeueEmailJob(id: string): Promise<void> {
  const { error } = await supabase.rpc("requeue_email_job", { _id: id });
  if (error) throw error;
}

export async function requeueWebhookJob(id: string): Promise<void> {
  const { error } = await supabase.rpc("requeue_webhook_job", { _id: id });
  if (error) throw error;
}
