export const fiscalSql = `
create table fiscal_documents (
  id text primary key not null,
  reference_id text not null,
  document_type text not null check (document_type in ('INVOICE', 'CREDIT_NOTE')),
  currency_code text not null,
  total_minor_units integer not null check (total_minor_units > 0),
  idempotency_key text not null,
  request_fingerprint text not null,
  terminal_id text not null,
  origin_node_id text not null,
  created_by text not null,
  created_at integer not null,
  status text not null check (
    status in ('PENDING', 'PRINTING', 'ISSUED', 'ERROR', 'RETRYING', 'FAILED')
  ),
  version integer not null check (version > 0),
  attempts integer not null check (attempts >= 0),
  fiscal_number text,
  last_error_code text,
  last_certainty text check (last_certainty in ('NOT_SENT', 'REJECTED', 'UNKNOWN')),
  last_failure_retryable integer not null check (last_failure_retryable in (0, 1)),
  unique (origin_node_id, idempotency_key),
  unique (origin_node_id, document_type, reference_id)
);

create table fiscal_document_lines (
  document_id text not null,
  sequence integer not null check (sequence >= 0),
  line_id text not null,
  description text not null,
  quantity_scaled integer not null check (quantity_scaled > 0),
  quantity_scale integer not null check (quantity_scale between 0 and 6),
  unit_price_minor_units integer not null check (unit_price_minor_units >= 0),
  tax_rate_basis_points integer not null check (tax_rate_basis_points between 0 and 10000),
  total_minor_units integer not null check (total_minor_units >= 0),
  primary key (document_id, sequence),
  foreign key (document_id) references fiscal_documents(id)
);

create table fiscal_document_payments (
  document_id text not null,
  sequence integer not null check (sequence >= 0),
  method_code text not null,
  amount_minor_units integer not null check (amount_minor_units > 0),
  primary key (document_id, sequence),
  foreign key (document_id) references fiscal_documents(id)
);

create table fiscal_document_transitions (
  event_id text primary key not null,
  document_id text not null,
  aggregate_version integer not null check (aggregate_version > 0),
  from_status text,
  to_status text not null,
  actor_id text not null,
  occurred_at integer not null,
  error_code text,
  certainty text check (certainty in ('NOT_SENT', 'REJECTED', 'UNKNOWN')),
  foreign key (document_id) references fiscal_documents(id),
  unique (document_id, aggregate_version)
);

create table fiscal_days (
  id text primary key not null,
  business_date text not null,
  terminal_id text not null,
  origin_node_id text not null,
  opened_by text not null,
  opened_at integer not null,
  state text not null check (state in ('DAY_OPEN', 'Z_PENDING', 'DAY_CLOSED')),
  version integer not null check (version > 0),
  unique (terminal_id, business_date)
);

create table fiscal_reports (
  id text primary key not null,
  day_id text not null,
  origin_node_id text not null,
  report_type text not null check (report_type in ('X', 'Z')),
  idempotency_key text not null,
  request_fingerprint text not null,
  status text not null check (
    status in ('PENDING', 'PRINTING', 'ISSUED', 'ERROR', 'RETRYING', 'FAILED')
  ),
  attempts integer not null check (attempts >= 0),
  report_number text,
  last_error_code text,
  last_certainty text check (last_certainty in ('NOT_SENT', 'REJECTED', 'UNKNOWN')),
  retryable integer not null check (retryable in (0, 1)),
  requested_by text not null,
  requested_at integer not null,
  foreign key (day_id) references fiscal_days(id),
  unique (origin_node_id, idempotency_key)
);

create table fiscal_report_transitions (
  event_id text primary key not null,
  day_id text not null,
  report_id text not null,
  aggregate_version integer not null check (aggregate_version > 0),
  from_status text,
  to_status text not null,
  actor_id text not null,
  occurred_at integer not null,
  error_code text,
  certainty text check (certainty in ('NOT_SENT', 'REJECTED', 'UNKNOWN')),
  foreign key (day_id) references fiscal_days(id),
  foreign key (report_id) references fiscal_reports(id),
  unique (day_id, aggregate_version)
);

create index fiscal_documents_status_idx on fiscal_documents(status);
create index fiscal_transitions_document_idx
  on fiscal_document_transitions(document_id, aggregate_version);
create index fiscal_days_terminal_state_idx on fiscal_days(terminal_id, state);
create index fiscal_reports_day_idx on fiscal_reports(day_id);
create index fiscal_report_transitions_day_idx
  on fiscal_report_transitions(day_id, aggregate_version);

create trigger fiscal_documents_content_immutable
before update on fiscal_documents
when old.id <> new.id
  or old.reference_id <> new.reference_id
  or old.document_type <> new.document_type
  or old.currency_code <> new.currency_code
  or old.total_minor_units <> new.total_minor_units
  or old.idempotency_key <> new.idempotency_key
  or old.request_fingerprint <> new.request_fingerprint
  or old.terminal_id <> new.terminal_id
  or old.origin_node_id <> new.origin_node_id
  or old.created_by <> new.created_by
  or old.created_at <> new.created_at
begin
  select raise(abort, 'fiscal document content is immutable');
end;

create trigger fiscal_documents_issued_immutable
before update on fiscal_documents
when old.status = 'ISSUED'
begin
  select raise(abort, 'issued fiscal documents are immutable');
end;

create trigger fiscal_documents_no_delete
before delete on fiscal_documents begin
  select raise(abort, 'fiscal documents cannot be deleted');
end;
create trigger fiscal_lines_no_update
before update on fiscal_document_lines begin
  select raise(abort, 'fiscal document lines are immutable');
end;
create trigger fiscal_lines_no_delete
before delete on fiscal_document_lines begin
  select raise(abort, 'fiscal document lines are immutable');
end;
create trigger fiscal_payments_no_update
before update on fiscal_document_payments begin
  select raise(abort, 'fiscal document payments are immutable');
end;
create trigger fiscal_payments_no_delete
before delete on fiscal_document_payments begin
  select raise(abort, 'fiscal document payments are immutable');
end;
create trigger fiscal_transitions_no_update
before update on fiscal_document_transitions begin
  select raise(abort, 'fiscal document transitions are append-only');
end;
create trigger fiscal_transitions_no_delete
before delete on fiscal_document_transitions begin
  select raise(abort, 'fiscal document transitions are append-only');
end;

create trigger fiscal_days_content_immutable
before update on fiscal_days
when old.id <> new.id
  or old.business_date <> new.business_date
  or old.terminal_id <> new.terminal_id
  or old.origin_node_id <> new.origin_node_id
  or old.opened_by <> new.opened_by
  or old.opened_at <> new.opened_at
begin
  select raise(abort, 'fiscal day identity is immutable');
end;
create trigger fiscal_days_closed_immutable
before update on fiscal_days
when old.state = 'DAY_CLOSED'
begin
  select raise(abort, 'closed fiscal days are immutable');
end;
create trigger fiscal_days_no_delete
before delete on fiscal_days begin
  select raise(abort, 'fiscal days cannot be deleted');
end;
create trigger fiscal_reports_content_immutable
before update on fiscal_reports
when old.id <> new.id
  or old.day_id <> new.day_id
  or old.origin_node_id <> new.origin_node_id
  or old.report_type <> new.report_type
  or old.idempotency_key <> new.idempotency_key
  or old.request_fingerprint <> new.request_fingerprint
  or old.requested_by <> new.requested_by
  or old.requested_at <> new.requested_at
begin
  select raise(abort, 'fiscal report identity is immutable');
end;
create trigger fiscal_reports_issued_immutable
before update on fiscal_reports
when old.status = 'ISSUED'
begin
  select raise(abort, 'issued fiscal reports are immutable');
end;
create trigger fiscal_reports_no_delete
before delete on fiscal_reports begin
  select raise(abort, 'fiscal reports cannot be deleted');
end;
create trigger fiscal_report_transitions_no_update
before update on fiscal_report_transitions begin
  select raise(abort, 'fiscal report transitions are append-only');
end;
create trigger fiscal_report_transitions_no_delete
before delete on fiscal_report_transitions begin
  select raise(abort, 'fiscal report transitions are append-only');
end;
`;
