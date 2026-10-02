export default async function handler(req, res) {
  // Allow CORS from any origin so your index.html can query this function smoothly
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Retrieve API key from Vercel Environment Variables or URL query param fallback
  const apiKey = process.env.OGADS_API_KEY || req.query.api_key;

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: "OGADS_API_KEY is missing. Please set it in Vercel Environment Variables."
    });
  }

  // Extract real visitor IP address from proxy headers (Vercel / Cloudflare)
  const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = rawIp.split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || 'Mozilla/5.0';
  const acceptLang = req.headers['accept-language'] || 'en-US,en;q=0.9';

  // Build parameters for the OGAds API request
  const params = new URLSearchParams({
    ip: clientIp,
    user_agent: userAgent,
    lang: acceptLang,
    site: req.headers.host || 'localhost'
  });

  if (req.query.ctype) params.append('ctype', req.query.ctype);
  if (req.query.max) params.append('max', req.query.max || '4');
  if (req.query.aff_sub4) params.append('aff_sub4', req.query.aff_sub4);
  if (req.query.aff_sub5) params.append('aff_sub5', req.query.aff_sub5);

  try {
    // Calling official OGAds endpoint: https://trkoffer.net/api/v2
    const ogadsEndpoint = `https://trkoffer.net/api/v2?${params.toString()}`;
    const ogadsResponse = await fetch(ogadsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    const data = await ogadsResponse.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch offers from OGAds: " + err.message
    });
  }
}
