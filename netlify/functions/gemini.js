const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const { promptContext, docInstruction, fileDataList = [], customSysInstruction, systemInstruction } = JSON.parse(event.body || '{}');
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
      if (text) return jsonResponse(200, { text, model });
    }

    return jsonResponse(502, { error: lastError || 'Gemini response was empty.' });
  } catch (error) {
    return jsonResponse(500, { error: error.message });
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
