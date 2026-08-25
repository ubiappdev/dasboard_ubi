create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  ru text not null unique,
  ci text not null unique,
  nombre text not null,
  apellido text not null,
  carrera text not null,
  curso integer not null check (curso between 1 and 10),
  telefono text,
  email text,
  estado text not null default 'al_dia' check (estado in ('al_dia', 'deudor')),
  deuda numeric(12,2) not null default 0 check (deuda >= 0),
  beca_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.scholarship_types (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  porcentaje numeric(5,2) not null check (porcentaje between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.students
  add constraint students_beca_id_fkey foreign key (beca_id) references public.scholarship_types(id) on delete set null;

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  descripcion text not null default '',
  monto numeric(12,2) not null check (monto >= 0),
  categoria text not null check (categoria in ('matricula', 'mensualidad', 'certificados', 'graduacion', 'tramites')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  canal text not null check (canal in ('qr', 'deposito', 'efectivo', 'transferencia')),
  comprobante text not null unique,
  paid_at timestamptz not null default now(),
  status text not null default 'pendiente' check (status in ('pendiente', 'conciliado', 'revision', 'fraude')),
  source text not null default 'app_movil' check (source in ('app_movil', 'ventanilla', 'importacion')),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_documents (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  document_type text not null check (document_type in ('comprobante_qr', 'voucher_deposito', 'recibo_efectivo', 'comprobante_transferencia')),
  storage_path text,
  image_data text,
  ocr_status text not null default 'pendiente' check (ocr_status in ('pendiente', 'procesando', 'validado', 'error')),
  ocr_data jsonb not null default '{}'::jsonb,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  bank_name text not null,
  period_start date,
  period_end date,
  imported_at timestamptz not null default now(),
  imported_by uuid not null default auth.uid() references auth.users(id)
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements(id) on delete cascade,
  operation_date timestamptz not null,
  reference text,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  channel text check (channel in ('qr', 'deposito', 'transferencia', 'desconocido')),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  statement_line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  match_score numeric(5,2) not null default 0 check (match_score between 0 and 100),
  status text not null check (status in ('conciliado', 'revision', 'fraude')),
  reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(payment_id, statement_line_id)
);

create table if not exists public.cash_receipt_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  document_id uuid references public.payment_documents(id),
  total_receipts integer not null default 0 check (total_receipts >= 0),
  accepted_receipts integer not null default 0 check (accepted_receipts >= 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'procesando', 'listo', 'error')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;
alter table public.scholarship_types enable row level security;
alter table public.fee_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_documents enable row level security;
alter table public.bank_statements enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.payment_reconciliations enable row level security;
alter table public.cash_receipt_batches enable row level security;

create policy "authenticated_can_read_students" on public.students for select to authenticated using (true);
create policy "authenticated_can_insert_students" on public.students for insert to authenticated with check (true);
create policy "authenticated_can_update_students" on public.students for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_students" on public.students for delete to authenticated using (true);

create policy "authenticated_can_read_scholarships" on public.scholarship_types for select to authenticated using (true);
create policy "authenticated_can_insert_scholarships" on public.scholarship_types for insert to authenticated with check (true);
create policy "authenticated_can_update_scholarships" on public.scholarship_types for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_scholarships" on public.scholarship_types for delete to authenticated using (true);

create policy "authenticated_can_read_fees" on public.fee_items for select to authenticated using (true);
create policy "authenticated_can_insert_fees" on public.fee_items for insert to authenticated with check (true);
create policy "authenticated_can_update_fees" on public.fee_items for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_fees" on public.fee_items for delete to authenticated using (true);

create policy "authenticated_can_read_payments" on public.payments for select to authenticated using (true);
create policy "authenticated_can_insert_payments" on public.payments for insert to authenticated with check (true);
create policy "authenticated_can_update_payments" on public.payments for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_payments" on public.payments for delete to authenticated using (true);

create policy "authenticated_can_read_payment_documents" on public.payment_documents for select to authenticated using (true);
create policy "authenticated_can_insert_payment_documents" on public.payment_documents for insert to authenticated with check (true);
create policy "authenticated_can_update_payment_documents" on public.payment_documents for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_payment_documents" on public.payment_documents for delete to authenticated using (true);

create policy "authenticated_can_read_statements" on public.bank_statements for select to authenticated using (true);
create policy "authenticated_can_insert_statements" on public.bank_statements for insert to authenticated with check (imported_by = auth.uid());
create policy "authenticated_can_update_statements" on public.bank_statements for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_statements" on public.bank_statements for delete to authenticated using (true);

create policy "authenticated_can_read_statement_lines" on public.bank_statement_lines for select to authenticated using (true);
create policy "authenticated_can_insert_statement_lines" on public.bank_statement_lines for insert to authenticated with check (exists (select 1 from public.bank_statements s where s.id = statement_id and s.imported_by = auth.uid()));
create policy "authenticated_can_update_statement_lines" on public.bank_statement_lines for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_statement_lines" on public.bank_statement_lines for delete to authenticated using (true);

create policy "authenticated_can_read_reconciliations" on public.payment_reconciliations for select to authenticated using (true);
create policy "authenticated_can_insert_reconciliations" on public.payment_reconciliations for insert to authenticated with check (true);
create policy "authenticated_can_update_reconciliations" on public.payment_reconciliations for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_reconciliations" on public.payment_reconciliations for delete to authenticated using (true);

create policy "authenticated_can_read_cash_batches" on public.cash_receipt_batches for select to authenticated using (true);
create policy "authenticated_can_insert_cash_batches" on public.cash_receipt_batches for insert to authenticated with check (created_by = auth.uid());
create policy "authenticated_can_update_cash_batches" on public.cash_receipt_batches for update to authenticated using (true) with check (true);
create policy "authenticated_can_delete_cash_batches" on public.cash_receipt_batches for delete to authenticated using (true);

insert into public.scholarship_types (nombre, porcentaje) values
  ('Beca Total', 100), ('Media Beca', 50), ('Beca Parcial (25%)', 25)
on conflict (nombre) do nothing;

insert into public.fee_items (concepto, descripcion, monto, categoria)
select * from (values
  ('Matrícula Gestión 2026', 'Pago semestral por inscripción', 1800::numeric, 'matricula'),
  ('Mensualidad 1 (Marzo)', 'Primera mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 2 (Abril)', 'Segunda mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 3 (Mayo)', 'Tercera mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 4 (Junio)', 'Cuarta mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 5 (Julio)', 'Quinta mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 6 (Agosto)', 'Sexta mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 7 (Septiembre)', 'Séptima mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 8 (Octubre)', 'Octava mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 9 (Noviembre)', 'Novena mensualidad', 450::numeric, 'mensualidad'),
  ('Mensualidad 10 (Diciembre)', 'Décima mensualidad', 450::numeric, 'mensualidad')
) as seed(concepto, descripcion, monto, categoria)
where not exists (select 1 from public.fee_items where fee_items.concepto = seed.concepto);

create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_paid_at_idx on public.payments(paid_at);
create index if not exists bank_statement_lines_operation_date_idx on public.bank_statement_lines(operation_date);
