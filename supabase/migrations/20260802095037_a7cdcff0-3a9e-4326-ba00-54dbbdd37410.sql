-- Email queue: retry/backoff/dead-letter support
ALTER TABLE public.email_notifications
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

ALTER TABLE public.email_notifications DROP CONSTRAINT IF EXISTS email_notifications_status_check;
ALTER TABLE public.email_notifications ADD CONSTRAINT email_notifications_status_check
  CHECK (status = ANY (ARRAY['queued','sent','failed','cancelled','dead_letter']));

CREATE INDEX IF NOT EXISTS email_notifications_due_idx
  ON public.email_notifications (next_attempt_at) WHERE status = 'queued';

-- Webhook deliveries: retry/backoff/dead-letter support
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

ALTER TABLE public.webhook_deliveries DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;
ALTER TABLE public.webhook_deliveries ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status = ANY (ARRAY['pending','delivered','failed','dead_letter']));

CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON public.webhook_deliveries (next_attempt_at) WHERE status = 'pending';

-- Claim due email jobs (lease-based, concurrency safe)
CREATE OR REPLACE FUNCTION public.claim_email_jobs(_limit integer DEFAULT 10, _lease_seconds integer DEFAULT 120)
RETURNS SETOF public.email_notifications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT id FROM public.email_notifications
    WHERE status = 'queued'
      AND scheduled_for <= now()
      AND next_attempt_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - make_interval(secs => _lease_seconds))
    ORDER BY next_attempt_at
    LIMIT greatest(1, least(_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_notifications e
  SET locked_at = now()
  FROM due WHERE e.id = due.id
  RETURNING e.*;
$$;

-- Record an email job outcome; exponential backoff, dead-letter on exhaustion
CREATE OR REPLACE FUNCTION public.complete_email_job(_id uuid, _error text DEFAULT NULL)
RETURNS public.email_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n public.email_notifications; v_attempts integer; v_backoff integer;
BEGIN
  SELECT * INTO n FROM public.email_notifications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found'; END IF;
  IF n.status = 'sent' THEN RETURN n; END IF;

  v_attempts := n.attempts + 1;

  IF _error IS NULL THEN
    UPDATE public.email_notifications
      SET status='sent', attempts=v_attempts, sent_at=now(), last_error=NULL, locked_at=NULL
      WHERE id=_id RETURNING * INTO n;
  ELSIF v_attempts >= n.max_attempts THEN
    UPDATE public.email_notifications
      SET status='dead_letter', attempts=v_attempts, last_error=left(_error, 500),
          dead_lettered_at=now(), locked_at=NULL
      WHERE id=_id RETURNING * INTO n;
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
    VALUES (NULL, 'queue.email_dead_lettered', 'email_notification', n.id, n.template,
            jsonb_build_object('attempts', v_attempts, 'error', left(_error, 300)));
  ELSE
    v_backoff := least(3600, 30 * power(2, v_attempts - 1)::integer);
    UPDATE public.email_notifications
      SET status='queued', attempts=v_attempts, last_error=left(_error, 500),
          next_attempt_at = now() + make_interval(secs => v_backoff), locked_at=NULL
      WHERE id=_id RETURNING * INTO n;
  END IF;

  RETURN n;
END;
$$;

-- Claim due webhook deliveries with everything the worker needs
CREATE OR REPLACE FUNCTION public.claim_webhook_jobs(_limit integer DEFAULT 10, _lease_seconds integer DEFAULT 120)
RETURNS TABLE (
  delivery_id uuid, webhook_id uuid, organization_id uuid, event_id uuid,
  event_type text, payload jsonb, target_url text, secret text,
  attempts integer, max_attempts integer, idempotency_key text, event_created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT d.id FROM public.webhook_deliveries d
    JOIN public.organization_webhooks w ON w.id = d.webhook_id
    WHERE d.status = 'pending'
      AND w.status = 'active'
      AND d.next_attempt_at <= now()
      AND (d.locked_at IS NULL OR d.locked_at < now() - make_interval(secs => _lease_seconds))
    ORDER BY d.next_attempt_at
    LIMIT greatest(1, least(_limit, 50))
    FOR UPDATE OF d SKIP LOCKED
  ), claimed AS (
    UPDATE public.webhook_deliveries d SET locked_at = now()
    FROM due WHERE d.id = due.id
    RETURNING d.*
  )
  SELECT c.id, c.webhook_id, c.organization_id, c.event_id,
         e.event_type, e.payload, w.target_url, w.secret,
         c.attempts, c.max_attempts, e.idempotency_key, e.created_at
  FROM claimed c
  JOIN public.webhook_events e ON e.id = c.event_id
  JOIN public.organization_webhooks w ON w.id = c.webhook_id;
$$;

CREATE OR REPLACE FUNCTION public.complete_webhook_job(
  _delivery_id uuid, _signature text DEFAULT NULL,
  _response_status integer DEFAULT NULL, _error text DEFAULT NULL)
RETURNS public.webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.webhook_deliveries; v_attempts integer; v_backoff integer;
BEGIN
  SELECT * INTO d FROM public.webhook_deliveries WHERE id = _delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  IF d.status = 'delivered' THEN RETURN d; END IF;

  v_attempts := d.attempts + 1;

  IF _error IS NULL THEN
    UPDATE public.webhook_deliveries
      SET status='delivered', attempts=v_attempts, signature=_signature,
          response_status=_response_status, last_error=NULL,
          delivered_at=now(), locked_at=NULL
      WHERE id=_delivery_id RETURNING * INTO d;
  ELSIF v_attempts >= d.max_attempts THEN
    UPDATE public.webhook_deliveries
      SET status='dead_letter', attempts=v_attempts, signature=_signature,
          response_status=_response_status, last_error=left(_error, 500),
          dead_lettered_at=now(), locked_at=NULL
      WHERE id=_delivery_id RETURNING * INTO d;
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
    VALUES (NULL, 'queue.webhook_dead_lettered', 'webhook_delivery', d.id, d.webhook_id::text,
            jsonb_build_object('attempts', v_attempts, 'error', left(_error, 300),
                               'response_status', _response_status), d.organization_id);
  ELSE
    v_backoff := least(3600, 30 * power(2, v_attempts - 1)::integer);
    UPDATE public.webhook_deliveries
      SET status='pending', attempts=v_attempts, signature=_signature,
          response_status=_response_status, last_error=left(_error, 500),
          next_attempt_at = now() + make_interval(secs => v_backoff), locked_at=NULL
      WHERE id=_delivery_id RETURNING * INTO d;
  END IF;

  UPDATE public.organization_webhooks
    SET last_delivery_at = now(), last_delivery_status = d.status
    WHERE id = d.webhook_id;

  RETURN d;
END;
$$;

-- Admin: queue health snapshot
CREATE OR REPLACE FUNCTION public.get_queue_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;

  SELECT jsonb_build_object(
    'emails', (SELECT jsonb_build_object(
        'queued', count(*) FILTER (WHERE status='queued'),
        'due', count(*) FILTER (WHERE status='queued' AND next_attempt_at <= now() AND scheduled_for <= now()),
        'retrying', count(*) FILTER (WHERE status='queued' AND attempts > 0),
        'sent', count(*) FILTER (WHERE status='sent'),
        'dead_letter', count(*) FILTER (WHERE status='dead_letter'),
        'oldest_due', min(next_attempt_at) FILTER (WHERE status='queued')
      ) FROM public.email_notifications),
    'webhooks', (SELECT jsonb_build_object(
        'pending', count(*) FILTER (WHERE status='pending'),
        'due', count(*) FILTER (WHERE status='pending' AND next_attempt_at <= now()),
        'retrying', count(*) FILTER (WHERE status='pending' AND attempts > 0),
        'delivered', count(*) FILTER (WHERE status='delivered'),
        'dead_letter', count(*) FILTER (WHERE status='dead_letter'),
        'oldest_due', min(next_attempt_at) FILTER (WHERE status='pending')
      ) FROM public.webhook_deliveries)
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin: requeue a dead-lettered job
CREATE OR REPLACE FUNCTION public.requeue_email_job(_id uuid)
RETURNS public.email_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n public.email_notifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  UPDATE public.email_notifications
    SET status='queued', next_attempt_at=now(), locked_at=NULL, dead_lettered_at=NULL,
        max_attempts = greatest(max_attempts, attempts + 3)
    WHERE id=_id AND status IN ('dead_letter','failed') RETURNING * INTO n;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification is not requeueable'; END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), 'queue.email_requeued', 'email_notification', n.id, n.template, '{}'::jsonb);
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_webhook_job(_id uuid)
RETURNS public.webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.webhook_deliveries;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  UPDATE public.webhook_deliveries
    SET status='pending', next_attempt_at=now(), locked_at=NULL, dead_lettered_at=NULL,
        max_attempts = greatest(max_attempts, attempts + 3)
    WHERE id=_id AND status IN ('dead_letter','failed') RETURNING * INTO d;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery is not requeueable'; END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'queue.webhook_requeued', 'webhook_delivery', d.id, d.webhook_id::text, '{}'::jsonb, d.organization_id);
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_jobs(integer,integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_email_job(uuid,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_webhook_jobs(integer,integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_webhook_job(uuid,text,integer,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_email_job(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_webhook_jobs(integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_webhook_job(uuid,text,integer,text) TO service_role;

REVOKE ALL ON FUNCTION public.get_queue_health() FROM public, anon;
REVOKE ALL ON FUNCTION public.requeue_email_job(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.requeue_webhook_job(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_queue_health() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.requeue_email_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.requeue_webhook_job(uuid) TO authenticated, service_role;