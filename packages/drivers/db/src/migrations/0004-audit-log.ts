export const auditLogSql = `
create table audit_log (
  audit_id text primary key,
  actor_id text not null,
  actor_role_codes text not null check (json_valid(actor_role_codes)),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state text check (before_state is null or json_valid(before_state)),
  after_state text check (after_state is null or json_valid(after_state)),
  reason text not null,
  terminal_id text not null,
  origin_node_id text not null,
  occurred_at integer not null,
  correlation_id text not null
);

create index audit_log_entity_time on audit_log(entity_type, entity_id, occurred_at);

create trigger audit_log_no_update
before update on audit_log begin
  select raise(abort, 'audit_log is append-only');
end;

create trigger audit_log_no_delete
before delete on audit_log begin
  select raise(abort, 'audit_log is append-only');
end;
`;
