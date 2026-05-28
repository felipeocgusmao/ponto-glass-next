-- v11 → geofencing per employee
-- workplace_lat/lng: coordinates of the employee's workplace (or null = no restriction)
-- max_distance_meters: reject punches beyond this radius (null = no restriction)
-- Both must be set together to activate geofencing for a given employee.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS workplace_lat      DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS workplace_lng      DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS max_distance_meters INT;
