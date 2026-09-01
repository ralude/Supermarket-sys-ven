const evidenceColumn = (
  row: string,
  prefix: '' | 'last_',
  name: 'dispatch_state' | 'command_effect' | 'fiscal_commit' | 'print_delivery'
): string => `${row}.${prefix}${name}`;

const migrationEventIdSql = `lower(
  substr(printf('%012x', cast(
    (julianday('now') - 2440587.5) * 86400000 as integer
  )), 1, 8) || '-' ||
  substr(printf('%012x', cast(
    (julianday('now') - 2440587.5) * 86400000 as integer
  )), 9, 4) || '-7' ||
  substr(hex(randomblob(2)), 2, 3) || '-8' ||
  substr(hex(randomblob(2)), 2, 3) || '-' ||
  hex(randomblob(6))
)`;

const evidenceIsInvalid = (row: string, prefix: '' | 'last_'): string => {
  const dispatch = evidenceColumn(row, prefix, 'dispatch_state');
  const effect = evidenceColumn(row, prefix, 'command_effect');
  const commit = evidenceColumn(row, prefix, 'fiscal_commit');
  const delivery = evidenceColumn(row, prefix, 'print_delivery');
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

const terminalFailureIsSafe = (row: string, prefix: '' | 'last_'): string => `(
  coalesce(${evidenceColumn(row, prefix, 'command_effect')}, '') = 'NOT_APPLIED'
  and coalesce(${evidenceColumn(row, prefix, 'fiscal_commit')}, '') = 'NOT_COMMITTED'
  and coalesce(${evidenceColumn(row, prefix, 'print_delivery')}, '') = 'INCOMPLETE'
)`;

const stateEvidenceIsInvalid = (
  row: string,
  statusColumn: 'status' | 'to_status',
  prefix: '' | 'last_',
  referenceNumberColumn?: 'fiscal_number' | 'report_number'
): string => {
  const status = `${row}.${statusColumn}`;
  const dispatch = evidenceColumn(row, prefix, 'dispatch_state');
  const effect = evidenceColumn(row, prefix, 'command_effect');
  const commit = evidenceColumn(row, prefix, 'fiscal_commit');
  const delivery = evidenceColumn(row, prefix, 'print_delivery');
  const anyEvidence = `(
    ${dispatch} is not null or ${effect} is not null or
    ${commit} is not null or ${delivery} is not null
  )`;
  const missingEvidence = `(
    ${dispatch} is null or ${effect} is null or
    ${commit} is null or ${delivery} is null
  )`;
  const referenceInvalid = referenceNumberColumn === undefined
    ? ''
    : ` or ${row}.${referenceNumberColumn} is null
      or trim(${row}.${referenceNumberColumn}) = ''`;
  return `(
    (${status} in ('PENDING', 'PRINTING') and ${anyEvidence})
    or (${status} = 'ERROR' and (${missingEvidence} or ${delivery} = 'COMPLETE'))
    or (${status} = 'RETRYING' and not ${terminalFailureIsSafe(row, prefix)})
    or (${status} = 'FAILED' and not ${terminalFailureIsSafe(row, prefix)})
    or (${status} = 'ISSUED' and (
      ${missingEvidence} or ${effect} <> 'APPLIED' or ${commit} <> 'COMMITTED'
      ${referenceInvalid}
    ))
  )`;
};

const stateGuards = (
  table: string,
  triggerPrefix: string,
  statusColumn: 'status' | 'to_status',
  prefix: '' | 'last_',
  referenceNumberColumn?: 'fiscal_number' | 'report_number'
): string => {
  const issuedUpdateIsImmutable = referenceNumberColumn === undefined
    ? ''
    : ` and old.${statusColumn} <> 'ISSUED'`;
  return `
create trigger ${triggerPrefix}_status_insert_valid
before insert on ${table}
when not (${evidenceIsInvalid('new', prefix)})
  and ${stateEvidenceIsInvalid('new', statusColumn, prefix, referenceNumberColumn)}
begin
  select raise(abort, 'fiscal status evidence is invalid');
end;

create trigger ${triggerPrefix}_status_update_valid
before update on ${table}
when not (${evidenceIsInvalid('new', prefix)})
  and ${stateEvidenceIsInvalid('new', statusColumn, prefix, referenceNumberColumn)}
  ${issuedUpdateIsImmutable}
begin
  select raise(abort, 'fiscal status evidence is invalid');
end;
`;
};

const documentSequenceIsCorrupt = `exists (
  select 1 from fiscal_documents d
  where (select count(*) from fiscal_document_transitions t
    where t.document_id = d.id) <> d.version
    or coalesce((select min(t.aggregate_version) from fiscal_document_transitions t
      where t.document_id = d.id), 0) <> 1
    or coalesce((select max(t.aggregate_version) from fiscal_document_transitions t
      where t.document_id = d.id), 0) <> d.version
    or not exists (
      select 1 from fiscal_document_transitions t
      where t.document_id = d.id
        and t.aggregate_version = d.version
        and t.to_status = d.status
    )
)`;

const reportSequenceIsCorrupt = `exists (
  select 1 from fiscal_days d
  where (select count(*) from fiscal_report_transitions t
    where t.day_id = d.id) <> d.version - 1
    or coalesce((select min(t.aggregate_version) from fiscal_report_transitions t
      where t.day_id = d.id), 1) <> case when d.version = 1 then 1 else 2 end
    or coalesce((select max(t.aggregate_version) from fiscal_report_transitions t
      where t.day_id = d.id), 1) <> d.version
    or exists (
      select 1 from fiscal_reports r
      where r.day_id = d.id
        and not exists (
          select 1 from fiscal_report_transitions t
          where t.day_id = d.id
            and t.report_id = r.id
            and t.to_status = r.status
            and t.aggregate_version = (
              select max(last.aggregate_version)
              from fiscal_report_transitions last
              where last.day_id = d.id and last.report_id = r.id
            )
        )
    )
)`;

const reportDayIsCorrupt = `exists (
  select 1
  from fiscal_report_transitions t
  join fiscal_reports r on r.id = t.report_id
  where t.day_id <> r.day_id
)`;

export const fiscalRecoveryIntegritySql = `
create temp table fiscal_integrity_preflight_0012 (
  ok integer not null check (ok = 1)
);
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where ${documentSequenceIsCorrupt};
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where ${reportSequenceIsCorrupt};
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where ${reportDayIsCorrupt};
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where exists (
  select 1 from fiscal_documents d where ${evidenceIsInvalid('d', 'last_')}
);
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where exists (
  select 1 from fiscal_document_transitions t where ${evidenceIsInvalid('t', '')}
);
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where exists (
  select 1 from fiscal_reports r where ${evidenceIsInvalid('r', 'last_')}
);
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where exists (
  select 1 from fiscal_report_transitions t where ${evidenceIsInvalid('t', '')}
);

insert into fiscal_document_transitions (
  event_id, document_id, aggregate_version, from_status, to_status,
  actor_id, occurred_at, error_code, certainty,
  dispatch_state, command_effect, fiscal_commit, print_delivery
)
select
  ${migrationEventIdSql},
  d.id,
  d.version + 1,
  d.status,
  'ERROR',
  'system:migration-0012',
  coalesce((select max(t.occurred_at) + 1 from fiscal_document_transitions t
    where t.document_id = d.id), d.created_at),
  d.last_error_code,
  null,
  d.last_dispatch_state,
  d.last_command_effect,
  d.last_fiscal_commit,
  d.last_print_delivery
from fiscal_documents d
where d.status in ('FAILED', 'RETRYING')
  and not ${terminalFailureIsSafe('d', 'last_')};

update fiscal_documents
set status = 'ERROR', version = version + 1
where status in ('FAILED', 'RETRYING')
  and not ${terminalFailureIsSafe('fiscal_documents', 'last_')};

with candidates as (
  select
    r.id,
    r.day_id,
    r.status,
    r.last_error_code,
    r.last_dispatch_state,
    r.last_command_effect,
    r.last_fiscal_commit,
    r.last_print_delivery,
    d.version + row_number() over (
      partition by r.day_id order by r.requested_at, r.id
    ) as correction_version,
    coalesce((select max(t.occurred_at) from fiscal_report_transitions t
      where t.day_id = r.day_id), d.opened_at) + row_number() over (
      partition by r.day_id order by r.requested_at, r.id
    ) as correction_at
  from fiscal_reports r
  join fiscal_days d on d.id = r.day_id
  where r.status in ('FAILED', 'RETRYING')
    and not ${terminalFailureIsSafe('r', 'last_')}
)
insert into fiscal_report_transitions (
  event_id, day_id, report_id, aggregate_version, from_status, to_status,
  actor_id, occurred_at, error_code, certainty,
  dispatch_state, command_effect, fiscal_commit, print_delivery
)
select
  ${migrationEventIdSql},
  day_id,
  id,
  correction_version,
  status,
  'ERROR',
  'system:migration-0012',
  correction_at,
  last_error_code,
  null,
  last_dispatch_state,
  last_command_effect,
  last_fiscal_commit,
  last_print_delivery
from candidates;

update fiscal_days
set version = version + (
  select count(*) from fiscal_reports r
  where r.day_id = fiscal_days.id
    and r.status in ('FAILED', 'RETRYING')
    and not ${terminalFailureIsSafe('r', 'last_')}
)
where exists (
  select 1 from fiscal_reports r
  where r.day_id = fiscal_days.id
    and r.status in ('FAILED', 'RETRYING')
    and not ${terminalFailureIsSafe('r', 'last_')}
);

update fiscal_reports
set status = 'ERROR'
where status in ('FAILED', 'RETRYING')
  and not ${terminalFailureIsSafe('fiscal_reports', 'last_')};

insert into fiscal_integrity_preflight_0012 (ok)
select 0 where ${documentSequenceIsCorrupt};
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where ${reportSequenceIsCorrupt};
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where exists (
  select 1 from fiscal_documents
  where ${stateEvidenceIsInvalid(
    'fiscal_documents', 'status', 'last_', 'fiscal_number'
  )}
);
insert into fiscal_integrity_preflight_0012 (ok)
select 0 where exists (
  select 1 from fiscal_reports
  where ${stateEvidenceIsInvalid(
    'fiscal_reports', 'status', 'last_', 'report_number'
  )}
);
drop table fiscal_integrity_preflight_0012;

${stateGuards(
  'fiscal_documents', 'fiscal_documents', 'status', 'last_', 'fiscal_number'
)}
${stateGuards(
  'fiscal_document_transitions', 'fiscal_document_transitions', 'to_status', ''
)}
${stateGuards(
  'fiscal_reports', 'fiscal_reports', 'status', 'last_', 'report_number'
)}
${stateGuards(
  'fiscal_report_transitions', 'fiscal_report_transitions', 'to_status', ''
)}

create trigger fiscal_document_transition_version_contiguous
before insert on fiscal_document_transitions
when new.aggregate_version <> coalesce((
  select max(aggregate_version) from fiscal_document_transitions
  where document_id = new.document_id
), 0) + 1
begin
  select raise(abort, 'fiscal document transition version is not contiguous');
end;

create trigger fiscal_report_transition_version_contiguous
before insert on fiscal_report_transitions
when new.aggregate_version <> coalesce((
  select max(aggregate_version) from fiscal_report_transitions
  where day_id = new.day_id
), 1) + 1
begin
  select raise(abort, 'fiscal report transition version is not contiguous');
end;
`;
