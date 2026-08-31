const evidenceIsInvalid = (prefix: '' | 'last_'): string => {
  const dispatch = `new.${prefix}dispatch_state`;
  const effect = `new.${prefix}command_effect`;
  const commit = `new.${prefix}fiscal_commit`;
  const delivery = `new.${prefix}print_delivery`;
  return `not (
    (${dispatch} is null and ${effect} is null and ${commit} is null and ${delivery} is null)
    or (
      ${dispatch} is not null and ${effect} is not null and
      ${commit} is not null and ${delivery} is not null
      and not (
        (${dispatch} = 'NOT_STARTED' and not (
          ${effect} = 'NOT_APPLIED' and ${commit} = 'NOT_COMMITTED' and
          ${delivery} = 'INCOMPLETE'
        ))
        or (${delivery} = 'COMPLETE' and not (
          ${effect} = 'APPLIED' and ${commit} = 'COMMITTED'
        ))
        or (${commit} = 'COMMITTED' and ${effect} <> 'APPLIED')
        or (${effect} = 'NOT_APPLIED' and ${commit} <> 'NOT_COMMITTED')
        or (${effect} = 'REJECTED' and ${commit} = 'COMMITTED')
      )
    )
  )`;
};

const evidenceGuards = (
  table: string,
  triggerPrefix: string,
  prefix: '' | 'last_'
): string => `
create trigger ${triggerPrefix}_evidence_insert_valid
before insert on ${table}
when ${evidenceIsInvalid(prefix)}
begin
  select raise(abort, 'fiscal operation evidence is invalid');
end;

create trigger ${triggerPrefix}_evidence_update_valid
before update on ${table}
when ${evidenceIsInvalid(prefix)}
begin
  select raise(abort, 'fiscal operation evidence is invalid');
end;
`;

export const fiscalIntegrityGuardsSql = `
drop trigger fiscal_documents_issued_immutable;
drop trigger fiscal_reports_issued_immutable;
drop trigger fiscal_transitions_no_update;
drop trigger fiscal_report_transitions_no_update;

update fiscal_documents set last_certainty = null where last_certainty is not null;
update fiscal_document_transitions set certainty = null where certainty is not null;
update fiscal_reports set last_certainty = null where last_certainty is not null;
update fiscal_report_transitions set certainty = null where certainty is not null;

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

${evidenceGuards('fiscal_documents', 'fiscal_documents', 'last_')}
${evidenceGuards('fiscal_document_transitions', 'fiscal_document_transitions', '')}
${evidenceGuards('fiscal_reports', 'fiscal_reports', 'last_')}
${evidenceGuards('fiscal_report_transitions', 'fiscal_report_transitions', '')}

create trigger fiscal_documents_legacy_certainty_insert_null
before insert on fiscal_documents
when new.last_certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_documents_legacy_certainty_update_null
before update on fiscal_documents
when new.last_certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_document_transitions_legacy_certainty_insert_null
before insert on fiscal_document_transitions
when new.certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_document_transitions_legacy_certainty_update_null
before update on fiscal_document_transitions
when new.certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_reports_legacy_certainty_insert_null
before insert on fiscal_reports
when new.last_certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_reports_legacy_certainty_update_null
before update on fiscal_reports
when new.last_certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_report_transitions_legacy_certainty_insert_null
before insert on fiscal_report_transitions
when new.certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;
create trigger fiscal_report_transitions_legacy_certainty_update_null
before update on fiscal_report_transitions
when new.certainty is not null
begin
  select raise(abort, 'legacy fiscal certainty is read-only');
end;

create trigger fiscal_lines_no_late_insert
before insert on fiscal_document_lines
when exists (
  select 1 from fiscal_document_transitions
  where document_id = new.document_id
)
begin
  select raise(abort, 'fiscal document content is sealed');
end;
create trigger fiscal_payments_no_late_insert
before insert on fiscal_document_payments
when exists (
  select 1 from fiscal_document_transitions
  where document_id = new.document_id
)
begin
  select raise(abort, 'fiscal document content is sealed');
end;

create trigger fiscal_report_transition_day_matches_report
before insert on fiscal_report_transitions
when not exists (
  select 1 from fiscal_reports
  where id = new.report_id and day_id = new.day_id
)
begin
  select raise(abort, 'fiscal report transition day does not match report');
end;
`;
