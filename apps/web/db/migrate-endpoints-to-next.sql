-- Point marketplace listings at same-origin Next routes (local).
UPDATE apis SET endpoint_url = 'http://localhost:3000/api/generate-image'
WHERE endpoint_url LIKE '%/api/generate-image';
UPDATE apis SET endpoint_url = 'http://localhost:3000/api/generate-video'
WHERE endpoint_url LIKE '%/api/generate-video';
