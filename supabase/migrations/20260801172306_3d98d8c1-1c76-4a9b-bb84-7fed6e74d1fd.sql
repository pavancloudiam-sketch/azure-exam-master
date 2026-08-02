REVOKE EXECUTE ON FUNCTION public.options_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scan_import_duplicates(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.attest_import_batch(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalize_content(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.scan_import_duplicates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attest_import_batch(uuid, text) TO authenticated;