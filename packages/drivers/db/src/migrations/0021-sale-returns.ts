/** Devoluciones totales (9B.06). La venta y la factura original permanecen inmutables. */
export const saleReturnsSql = `
  create table sale_returns (
    id text primary key not null,
    sale_id text not null,
    original_document_id text not null,
    credit_note_id text not null unique,
    shift_id text not null,
    refund_minor_units integer not null check (refund_minor_units > 0),
    currency_code text not null,
    payment_method_code text not null,
    reason text not null check (length(trim(reason)) > 0),
    actor_id text not null,
    terminal_id text not null,
    origin_node_id text not null,
    occurred_at integer not null,
    foreign key (sale_id) references sales(id),
    foreign key (original_document_id) references fiscal_documents(id),
    foreign key (credit_note_id) references fiscal_documents(id),
    foreign key (shift_id) references shifts(id),
    unique (sale_id)
  );

  create table sale_return_lines (
    id text primary key not null,
    sale_return_id text not null,
    sale_item_id text not null,
    product_id text not null,
    stock_item_id text not null,
    batch_id text,
    quantity_scaled integer not null check (quantity_scaled > 0),
    quantity_scale integer not null check (quantity_scale >= 0),
    unit_cost_minor_units integer,
    cost_currency_code text,
    foreign key (sale_return_id) references sale_returns(id),
    foreign key (stock_item_id) references stock_items(id),
    foreign key (batch_id) references stock_batches(id),
    check ((unit_cost_minor_units is null) = (cost_currency_code is null))
  );

  create index sale_return_lines_return_idx on sale_return_lines(sale_return_id);
  create trigger sale_returns_no_update before update on sale_returns begin
    select raise(abort, 'sale returns are immutable');
  end;
  create trigger sale_returns_no_delete before delete on sale_returns begin
    select raise(abort, 'sale returns cannot be deleted');
  end;
  create trigger sale_return_lines_no_update before update on sale_return_lines begin
    select raise(abort, 'sale return lines are immutable');
  end;
  create trigger sale_return_lines_no_delete before delete on sale_return_lines begin
    select raise(abort, 'sale return lines cannot be deleted');
  end;
`;
