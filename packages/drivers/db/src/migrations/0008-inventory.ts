export const inventorySql = `
create table stock_items (
  id text primary key not null,
  product_id text not null unique,
  unit_code text not null,
  quantity_scale integer not null check (quantity_scale >= 0),
  tracks_batches integer not null check (tracks_batches in (0, 1))
);

create table stock_batches (
  id text primary key not null,
  stock_item_id text not null,
  lot_number text not null,
  expires_at integer,
  foreign key (stock_item_id) references stock_items(id),
  unique (stock_item_id, lot_number),
  unique (id, stock_item_id)
);

create table stock_movements (
  id text primary key not null,
  stock_item_id text not null,
  event_id text not null unique,
  aggregate_version integer not null check (aggregate_version > 0),
  type text not null check (
    type in ('PURCHASE_RECEIPT', 'SALE_ISSUE', 'WASTE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')
  ),
  direction text not null check (direction in ('IN', 'OUT')),
  quantity_scaled integer not null check (quantity_scaled > 0),
  quantity_scale integer not null check (quantity_scale >= 0),
  batch_id text,
  actor_id text not null,
  reason text not null,
  reference_id text not null,
  occurred_at integer not null,
  foreign key (stock_item_id) references stock_items(id),
  foreign key (batch_id, stock_item_id) references stock_batches(id, stock_item_id),
  unique (stock_item_id, aggregate_version)
);

create index stock_batches_stock_item_idx on stock_batches(stock_item_id);
create index stock_movements_stock_item_occurred_at_idx
  on stock_movements(stock_item_id, occurred_at);
create index stock_movements_batch_occurred_at_idx
  on stock_movements(batch_id, occurred_at);
create index stock_movements_reference_idx on stock_movements(reference_id);

create trigger stock_items_immutable_update
before update on stock_items begin
  select raise(abort, 'stock items are immutable');
end;
create trigger stock_items_immutable_delete
before delete on stock_items begin
  select raise(abort, 'stock items are immutable');
end;
create trigger stock_batches_immutable_update
before update on stock_batches begin
  select raise(abort, 'stock batches are immutable');
end;
create trigger stock_batches_immutable_delete
before delete on stock_batches begin
  select raise(abort, 'stock batches are immutable');
end;
create trigger stock_movements_append_only_update
before update on stock_movements begin
  select raise(abort, 'stock movements are append-only');
end;
create trigger stock_movements_append_only_delete
before delete on stock_movements begin
  select raise(abort, 'stock movements are append-only');
end;
`;
