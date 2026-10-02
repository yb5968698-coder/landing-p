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
  const apiKey = (process.env.OGADS_API_KEY || req.query.api_key || '').trim();

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: "OGADS_API_KEY is missing. Please set your OGAds API key in Vercel Environment Variables or pass ?api_key=YOUR_KEY"
    });
  }

  // Extract real visitor IP address or fallback
  let clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || req.query.ip || '';
  
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }

  // Sanitize IPv6 mapped IPv4 address
  clientIp = clientIp.replace(/^::ffff:/, '');

  // Check if IP is local/private/empty and assign public fallback for dev testing
  const isPrivateIp = !clientIp || 
    clientIp === '127.0.0.1' || 
    clientIp === '::1' || 
    clientIp.includes('localhost') || 
    clientIp.startsWith('192.168.') || 
    clientIp.startsWith('10.') ||
    clientIp.startsWith('172.16.');

  if (isPrivateIp) {
    clientIp = '104.28.0.1'; // Standard US Public IP for local testing
  }

  const userAgent = req.headers['user-agent'] || req.query.user_agent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  const acceptLang = req.headers['accept-language'] || req.query.lang || 'en-US,en;q=0.9';
  const pageSite = req.query.site || req.headers.referer || req.headers.host || 'spoofer-hub';

  // Build query parameters based on OGAds API v2 specifications
  const params = new URLSearchParams({
    ip: clientIp,
    user_agent: userAgent,
    lang: acceptLang,
    site: pageSite
  });

  if (req.query.ctype) params.append('ctype', req.query.ctype);
  if (req.query.max) params.append('max', req.query.max || '4');
  if (req.query.min) params.append('min', req.query.min);
  if (req.query.aff_sub4) params.append('aff_sub4', req.query.aff_sub4);
  if (req.query.aff_sub5) params.append('aff_sub5', req.query.aff_sub5);

  try {
    const ogadsEndpoint = `https://trkoffer.net/api/v2?${params.toString()}`;
    const ogadsResponse = await fetch(ogadsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    const data = await ogadsResponse.json();
    
    // Inject debug information for easier troubleshooting in browser console
    return res.status(ogadsResponse.status || 200).json({
      ...data,
      _debug: {
        detected_ip: clientIp,
        user_agent: userAgent
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch offers from OGAds: " + err.message
    });
  }
}
