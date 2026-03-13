alter table sources
  drop constraint if exists authority_weight_range;

alter table sources
  add constraint authority_weight_range
  check (authority_weight between 0.80 and 1.30);
