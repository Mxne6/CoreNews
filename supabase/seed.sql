insert into sources (name, rss_url, authority_weight, category, is_active)
values
  ('Reuters World', 'https://feeds.reuters.com/reuters/worldNews', 1.2, 'world', true),
  ('BBC World', 'http://feeds.bbci.co.uk/news/world/rss.xml', 1.1, 'world', true),
  ('NHK', 'https://www3.nhk.or.jp/rss/news/cat0.xml', 1.1, 'japan', true),
  ('TechCrunch', 'https://techcrunch.com/feed/', 1.0, 'tech', true)
on conflict (rss_url) do nothing;
