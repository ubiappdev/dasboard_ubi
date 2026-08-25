/*
# Allow public access for the single-tenant university app

1. Purpose
- The application no longer has a sign-in screen or user accounts.
- The browser uses the anonymous Supabase key for its entire lifetime.

2. Security model
- This is an intentionally shared, single-tenant administrative workspace.
- RLS remains enabled on every table.
- The anon and authenticated roles receive separate CRUD policies so the app can read and write its shared records without a provider or login.

3. Tables covered
- students: student records and balances.
- scholarship_types: scholarship catalog.
- fee_items: payment catalog.
- payments: tuition and fee payments.
- payment_documents: payment receipts and OCR results.
- bank_statements: imported bank statement files.
- bank_statement_lines: statement movements.
- payment_reconciliations: payment-to-bank matching decisions.
- cash_receipt_batches: bulk cash receipt batches.

4. Important note
- Because there is no authentication, any client with access to the application can access the shared workspace. Authentication should be restored before exposing this system beyond a controlled institutional environment.
*/

DO $$
DECLARE
  table_name text;
  policy_name text;
  operation text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'students',
    'scholarship_types',
    'fee_items',
    'payments',
    'payment_documents',
    'bank_statements',
    'bank_statement_lines',
    'payment_reconciliations',
    'cash_receipt_batches'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOREACH operation IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      policy_name := format('public_%s_%s', table_name, operation);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
      IF operation = 'select' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', policy_name, table_name);
      ELSIF operation = 'insert' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', policy_name, table_name);
      ELSIF operation = 'update' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', policy_name, table_name);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO anon, authenticated USING (true)', policy_name, table_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;