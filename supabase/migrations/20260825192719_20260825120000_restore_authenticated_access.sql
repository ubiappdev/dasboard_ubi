/*
# Restore authenticated access control for the university admin panel

1. Purpose
- The application now requires sign-in (email + password via Supabase Auth).
- The anon role must no longer have open CRUD access to administrative tables.
- Authenticated users (administrative staff) get full CRUD on all tables.

2. Security model
- RLS remains enabled on every table.
- All policies are scoped TO authenticated.
- The anon role loses its open-access policies from the previous migration.
- Authenticated users can read and write all shared administrative data.

3. Tables covered
- alumnos, alumnos_pagos, alumnos_mensualidades, aranceles_conceptos,
  tipos_beca, extractos_bancarios, cajas_recibos, perfiles, buzon_mensajes, alumnos_becas

4. Important note
- This is a shared administrative workspace: any authenticated user can access all records.
- For per-student data isolation, additional ownership policies would be needed.
*/

DO $$
DECLARE
  tbl text;
  pol text;
  op text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'alumnos',
    'alumnos_pagos',
    'alumnos_mensualidades',
    'aranceles_conceptos',
    'tipos_beca',
    'extractos_bancarios',
    'cajas_recibos',
    'perfiles',
    'buzon_mensajes',
    'alumnos_becas'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Remove all existing policies (from both the anon-open and original migrations)
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    END LOOP;

    -- Create authenticated-only CRUD policies
    op := 'select_' || tbl;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', op, tbl);

    op := 'insert_' || tbl;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', op, tbl);

    op := 'update_' || tbl;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', op, tbl);

    op := 'delete_' || tbl;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', op, tbl);
  END LOOP;
END $$;