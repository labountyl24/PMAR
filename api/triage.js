export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided.' });

  const system = `You are a healthcare clinic triage assistant specializing in patient message routing. Analyze patient PMAR messages and determine correct routing.

ROUTING RULES:
- PMAR: Administrative tasks, routine stable medication refills, form/document requests, scheduling, referral status, simple non-clinical questions
- E-Visit: New symptoms, worsening conditions, clinical judgment needed, medication changes/reactions, mental health concerns, billable clinical encounters
- Urgent: Self-harm, suicidal ideation, chest pain, severe breathing difficulty, stroke symptoms, emergencies
- Unclear: Cannot determine without more information

Respond ONLY with a valid JSON object, no markdown, no extra text:
{"routing":"PMAR|E-Visit|Urgent|Unclear","message_type":"brief category 3-5 words","reasoning":"1-2 sentences","suggested_action":"specific staff next step 1-2 sentences","draft_reply":"professional empathetic patient reply 2-4 sentences","flag":null}

For flag use: null, "billing_opportunity", "clinical_review_needed", or "emergency"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: `Patient PMAR message: "${message}"` }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });

    const raw = data.content.map(i => i.type === 'text' ? i.text : '').join('').trim()
      .replace(/^```json\s*/, '').replace(/```$/, '').trim();

    const result = JSON.parse(raw);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
