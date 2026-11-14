-- Access administration, not a schema migration or application startup hook.
-- Run explicitly as the trusted owner/DBA after schema setup. No credentials.
BEGIN;

DO $roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['phishing_api', 'phishing_review', 'phishing_history']
  LOOP
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
    -- Refuse to silently repurpose a login, privileged role, or inherited grant.
    IF EXISTS (
      SELECT FROM pg_catalog.pg_roles r WHERE r.rolname = role_name
        AND (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
          OR r.rolreplication OR r.rolbypassrls)
    ) OR EXISTS (
      SELECT FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles r ON r.oid = m.member WHERE r.rolname = role_name
    ) OR EXISTS (
      SELECT FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_roles r ON r.oid = c.relowner WHERE r.rolname = role_name
    ) THEN
      RAISE EXCEPTION 'Unsafe existing access role: %; DBA inspection required', role_name;
    END IF;
    EXECUTE format('ALTER ROLE %I NOINHERIT', role_name);
  END LOOP;
END
$roles$;

-- PUBLIC grants apply to every login. Never grant audit access to PUBLIC.
REVOKE ALL ON public.contact_source_reviews FROM PUBLIC;
REVOKE ALL ON public.contact_source_reviews, public.contact_sources,
  public.companies, public.official_contacts, public.property_aliases,
  public.source_review_notifications, public.usage_counters
  FROM phishing_api, phishing_review, phishing_history;
-- REVOKE at table level does not remove column ACLs.
REVOKE ALL (id, source_id, reviewer, note, recorded_at, "before", "after")
  ON public.contact_source_reviews FROM PUBLIC, phishing_api, phishing_review, phishing_history;
GRANT USAGE ON SCHEMA public TO phishing_api, phishing_review, phishing_history;
GRANT SELECT ON public.companies, public.official_contacts,
  public.contact_sources, public.property_aliases TO phishing_api;
-- Existing optional scheduler uses only delivery bookkeeping, never audit notes.
GRANT SELECT, INSERT, UPDATE ON public.source_review_notifications TO phishing_api;
-- Shared reservations and expiry cleanup; no ownership or DDL privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_counters TO phishing_api;
GRANT SELECT ON public.companies, public.official_contacts, public.contact_sources TO phishing_review;
GRANT UPDATE (source_url, assertion, reviewed_at, expires_at)
  ON public.contact_sources TO phishing_review;
GRANT INSERT ON public.contact_source_reviews TO phishing_review;
GRANT SELECT ON public.contact_source_reviews TO phishing_history;
GRANT SELECT (id) ON public.contact_sources TO phishing_history;

-- SELECT ... FOR UPDATE otherwise requires UPDATE on the provenance tables.
-- This function only locks rows, never changes or returns private data.
-- Its owner MUST be a trusted owner/DBA, never a runtime/operator role.
CREATE OR REPLACE FUNCTION public.lock_contact_review_subject(subject_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $lock$
BEGIN
  PERFORM s.id
  FROM public.contact_sources s
  JOIN public.official_contacts c ON c.id = s.contact_id
  JOIN public.companies co ON co.id = c.company_id
  WHERE s.id = subject_id
  FOR UPDATE OF s, c, co;
END
$lock$;
ALTER FUNCTION public.lock_contact_review_subject(text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.lock_contact_review_subject(text) FROM PUBLIC, phishing_api, phishing_history;
GRANT EXECUTE ON FUNCTION public.lock_contact_review_subject(text) TO phishing_review;
COMMIT;
