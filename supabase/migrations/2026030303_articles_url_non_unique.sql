alter table articles
  drop constraint if exists uq_articles_url;

drop index if exists uq_articles_url;

create index if not exists idx_articles_url
  on articles(url);
