const IMAGE_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.LEADING_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'LEADING_GEMINI_API_KEY or GEMINI_API_KEY is not configured.' });
  }

  try {
    const { prompt, imageBase64, mimeType } = req.body || {};
    let lastError = '';

    for (const model of IMAGE_MODELS) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: String(imageBase64 || '').split(',')[1] || imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        lastError = errorBody.error?.message || `API Error ${response.status}`;
        if (/quota|rate-limit|free_tier|billing/i.test(lastError)) break;
        continue;
      }

      const data = await response.json();
      const imagePart = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data);
      if (imagePart) {
        return res.status(200).json({
          model,
          mimeType: imagePart.inlineData.mimeType || 'image/png',
          imageBase64: imagePart.inlineData.data
        });
      }

      lastError = '이미지 응답을 찾지 못했습니다.';
    }

    return res.status(502).json({ error: lastError || '이미지 생성에 실패했습니다.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
