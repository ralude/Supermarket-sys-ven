export const businessEventLedgerSql = `
create table business_event (
  event_id text primary key,
  event_type text not null,
  contract_version integer not null check (contract_version > 0),
  aggregate_id text not null,
  aggregate_type text not null,
  aggregate_version integer not null check (aggregate_version > 0),
  origin_node_id text not null,
  correlation_id text not null,
  actor_id text not null,
  occurred_at integer not null,
  payload text not null check (json_valid(payload)),
  unique (aggregate_type, aggregate_id, aggregate_version)
);

create index business_event_aggregate_order
  on business_event(aggregate_type, aggregate_id, aggregate_version);

create trigger business_event_no_update
before update on business_event begin
  select raise(abort, 'business_event is append-only');
end;

create trigger business_event_no_delete
before delete on business_event begin
  select raise(abort, 'business_event is append-only');
end;
`;
