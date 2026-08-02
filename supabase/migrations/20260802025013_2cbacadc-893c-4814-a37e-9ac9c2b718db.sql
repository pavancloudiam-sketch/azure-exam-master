REVOKE EXECUTE ON FUNCTION
  public.log_financial_action(text, text, text, uuid, text, jsonb),
  public.enqueue_email_notification(uuid, text, text, text, text, uuid, uuid, uuid, uuid, timestamptz),
  public.request_refund(uuid, text),
  public.decide_refund(uuid, text, text),
  public.mark_refund_processed(uuid, text),
  public.request_subscription_cancellation(uuid, text),
  public.withdraw_subscription_cancellation(uuid),
  public.admin_cancel_subscription(uuid, text),
  public.expire_due_access(),
  public.request_exam_reminder(uuid, timestamptz),
  public.notify_result_available(uuid),
  public.mark_notification_sent(uuid, text),
  public.admin_create_test_order(uuid, uuid, text)
FROM PUBLIC, anon;

-- Internal helpers: not callable from the Data API at all.
REVOKE EXECUTE ON FUNCTION
  public.log_financial_action(text, text, text, uuid, text, jsonb),
  public.enqueue_email_notification(uuid, text, text, text, text, uuid, uuid, uuid, uuid, timestamptz),
  public.expire_due_access()
FROM authenticated;

GRANT EXECUTE ON FUNCTION
  public.request_refund(uuid, text),
  public.decide_refund(uuid, text, text),
  public.mark_refund_processed(uuid, text),
  public.request_subscription_cancellation(uuid, text),
  public.withdraw_subscription_cancellation(uuid),
  public.admin_cancel_subscription(uuid, text),
  public.request_exam_reminder(uuid, timestamptz),
  public.notify_result_available(uuid),
  public.mark_notification_sent(uuid, text),
  public.admin_create_test_order(uuid, uuid, text)
TO authenticated;