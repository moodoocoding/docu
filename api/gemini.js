const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const { promptContext, docInstruction, fileDataList = [], customSysInstruction, systemInstruction } = req.body || {};
    const parts = [];

    for (const fd of fileDataList) {
      parts.push({
        inlineData: {
          data: String(fd.base64 || '').split(',')[1] || fd.base64,
          mimeType: fd.mimeType
        }
      });
    }

    parts.push({
      text: `${docInstruction}\n\n[입력 정보 및 요청사항]:\n${promptContext}`
    });

    let lastError = '';
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: customSysInstruction || systemInstruction || '' }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.3 }
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        lastError = errorBody.error?.message || `API Error ${response.status}`;
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '';
      if (text) return res.status(200).json({ text, model });
    }

    return res.status(502).json({ error: lastError || 'Gemini response was empty.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
