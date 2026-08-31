export const fiscalOperationEvidenceSql = `
alter table fiscal_documents add column last_dispatch_state text
  check (last_dispatch_state in ('NOT_STARTED', 'STARTED', 'RESULT_RECEIVED'));
alter table fiscal_documents add column last_command_effect text
  check (last_command_effect in ('APPLIED', 'NOT_APPLIED', 'REJECTED', 'UNKNOWN'));
alter table fiscal_documents add column last_fiscal_commit text
  check (last_fiscal_commit in ('COMMITTED', 'NOT_COMMITTED', 'UNKNOWN'));
alter table fiscal_documents add column last_print_delivery text
  check (last_print_delivery in ('COMPLETE', 'INCOMPLETE', 'UNKNOWN'));

alter table fiscal_document_transitions add column dispatch_state text
  check (dispatch_state in ('NOT_STARTED', 'STARTED', 'RESULT_RECEIVED'));
alter table fiscal_document_transitions add column command_effect text
  check (command_effect in ('APPLIED', 'NOT_APPLIED', 'REJECTED', 'UNKNOWN'));
alter table fiscal_document_transitions add column fiscal_commit text
  check (fiscal_commit in ('COMMITTED', 'NOT_COMMITTED', 'UNKNOWN'));
alter table fiscal_document_transitions add column print_delivery text
  check (print_delivery in ('COMPLETE', 'INCOMPLETE', 'UNKNOWN'));

alter table fiscal_reports add column last_dispatch_state text
  check (last_dispatch_state in ('NOT_STARTED', 'STARTED', 'RESULT_RECEIVED'));
alter table fiscal_reports add column last_command_effect text
  check (last_command_effect in ('APPLIED', 'NOT_APPLIED', 'REJECTED', 'UNKNOWN'));
alter table fiscal_reports add column last_fiscal_commit text
  check (last_fiscal_commit in ('COMMITTED', 'NOT_COMMITTED', 'UNKNOWN'));
alter table fiscal_reports add column last_print_delivery text
  check (last_print_delivery in ('COMPLETE', 'INCOMPLETE', 'UNKNOWN'));

alter table fiscal_report_transitions add column dispatch_state text
  check (dispatch_state in ('NOT_STARTED', 'STARTED', 'RESULT_RECEIVED'));
alter table fiscal_report_transitions add column command_effect text
  check (command_effect in ('APPLIED', 'NOT_APPLIED', 'REJECTED', 'UNKNOWN'));
alter table fiscal_report_transitions add column fiscal_commit text
  check (fiscal_commit in ('COMMITTED', 'NOT_COMMITTED', 'UNKNOWN'));
alter table fiscal_report_transitions add column print_delivery text
  check (print_delivery in ('COMPLETE', 'INCOMPLETE', 'UNKNOWN'));

drop trigger fiscal_documents_issued_immutable;
drop trigger fiscal_reports_issued_immutable;
drop trigger fiscal_transitions_no_update;
drop trigger fiscal_report_transitions_no_update;

update fiscal_documents set
  last_dispatch_state = case
    when status = 'ISSUED' or last_certainty = 'REJECTED' then 'RESULT_RECEIVED'
    else 'STARTED'
  end,
  last_command_effect = case
    when status = 'ISSUED' then 'APPLIED'
    when last_certainty = 'REJECTED' then 'REJECTED'
    else 'UNKNOWN'
  end,
  last_fiscal_commit = case when status = 'ISSUED' then 'COMMITTED' else 'UNKNOWN' end,
  last_print_delivery = 'UNKNOWN'
where status = 'ISSUED' or last_certainty is not null;

update fiscal_document_transitions set
  dispatch_state = case
    when to_status = 'ISSUED' or certainty = 'REJECTED' then 'RESULT_RECEIVED'
    else 'STARTED'
  end,
  command_effect = case
    when to_status = 'ISSUED' then 'APPLIED'
    when certainty = 'REJECTED' then 'REJECTED'
    else 'UNKNOWN'
  end,
  fiscal_commit = case when to_status = 'ISSUED' then 'COMMITTED' else 'UNKNOWN' end,
  print_delivery = 'UNKNOWN'
where to_status = 'ISSUED' or certainty is not null;

update fiscal_reports set
  last_dispatch_state = case
    when status = 'ISSUED' or last_certainty = 'REJECTED' then 'RESULT_RECEIVED'
    else 'STARTED'
  end,
  last_command_effect = case
    when status = 'ISSUED' then 'APPLIED'
    when last_certainty = 'REJECTED' then 'REJECTED'
    else 'UNKNOWN'
  end,
  last_fiscal_commit = case when status = 'ISSUED' then 'COMMITTED' else 'UNKNOWN' end,
  last_print_delivery = 'UNKNOWN'
where status = 'ISSUED' or last_certainty is not null;

update fiscal_report_transitions set
  dispatch_state = case
    when to_status = 'ISSUED' or certainty = 'REJECTED' then 'RESULT_RECEIVED'
    else 'STARTED'
  end,
  command_effect = case
    when to_status = 'ISSUED' then 'APPLIED'
    when certainty = 'REJECTED' then 'REJECTED'
    else 'UNKNOWN'
  end,
  fiscal_commit = case when to_status = 'ISSUED' then 'COMMITTED' else 'UNKNOWN' end,
  print_delivery = 'UNKNOWN'
where to_status = 'ISSUED' or certainty is not null;

create trigger fiscal_documents_issued_immutable
before update on fiscal_documents
when old.status = 'ISSUED'
begin
  select raise(abort, 'issued fiscal documents are immutable');
end;

create trigger fiscal_reports_issued_immutable
before update on fiscal_reports
when old.status = 'ISSUED'
begin
  select raise(abort, 'issued fiscal reports are immutable');
end;

create trigger fiscal_transitions_no_update
before update on fiscal_document_transitions begin
  select raise(abort, 'fiscal document transitions are append-only');
end;

create trigger fiscal_report_transitions_no_update
before update on fiscal_report_transitions begin
  select raise(abort, 'fiscal report transitions are append-only');
end;
`;
