-- Phase 2: Member Lifecycle
-- Territories: add zip-code list so setters can scope leads without Mapbox
-- polygons. Full GIS boundary work is deferred to Phase 8.

alter table territories add column if not exists zip_codes text[];

create index if not exists idx_territories_zip_codes
  on territories using gin (zip_codes);
