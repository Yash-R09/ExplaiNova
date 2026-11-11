insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('explainova-videos', 'explainova-videos', false, 50000000, array['video/mp4', 'application/x-subrip'])
on conflict (id) do nothing;
