export const outboxSql = `
create table outbox_event (
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
  status text not null check (status in ('PENDING', 'PROCESSING', 'PUBLISHED')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at integer not null,
  lease_until integer,
  last_error text,
  published_at integer,
  created_at integer not null
);

create index outbox_event_delivery
  on outbox_event(status, next_attempt_at, lease_until, created_at);
`;
