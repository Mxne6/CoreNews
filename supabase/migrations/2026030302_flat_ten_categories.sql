alter table sources
  drop constraint if exists sources_category_flat_ten_check;

alter table events
  drop constraint if exists events_category_flat_ten_check;

update sources
set category = case lower(category)
  when 'ai' then 'tech'
  when 'business' then 'finance'
  when 'markets' then 'finance'
  when 'policy' then 'current-affairs'
  when 'china' then 'domestic'
  when 'us' then 'international'
  when 'japan' then 'international'
  when 'europe' then 'international'
  when 'world' then 'international'
  when 'energy' then 'finance'
  when 'health' then 'lifestyle'
  else lower(category)
end;

update events
set category = case lower(category)
  when 'ai' then 'tech'
  when 'business' then 'finance'
  when 'markets' then 'finance'
  when 'policy' then 'current-affairs'
  when 'china' then 'domestic'
  when 'us' then 'international'
  when 'japan' then 'international'
  when 'europe' then 'international'
  when 'world' then 'international'
  when 'energy' then 'finance'
  when 'health' then 'lifestyle'
  else lower(category)
end;

update sources
set category = 'international'
where category not in (
  'domestic',
  'international',
  'current-affairs',
  'society',
  'finance',
  'tech',
  'sports',
  'entertainment',
  'culture-education',
  'lifestyle'
);

update events
set category = 'international'
where category not in (
  'domestic',
  'international',
  'current-affairs',
  'society',
  'finance',
  'tech',
  'sports',
  'entertainment',
  'culture-education',
  'lifestyle'
);

alter table sources
  add constraint sources_category_flat_ten_check
  check (
    category in (
      'domestic',
      'international',
      'current-affairs',
      'society',
      'finance',
      'tech',
      'sports',
      'entertainment',
      'culture-education',
      'lifestyle'
    )
  );

alter table events
  add constraint events_category_flat_ten_check
  check (
    category in (
      'domestic',
      'international',
      'current-affairs',
      'society',
      'finance',
      'tech',
      'sports',
      'entertainment',
      'culture-education',
      'lifestyle'
    )
  );
