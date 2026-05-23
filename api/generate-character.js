const IMAGE_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];

// 서버 인메모리 쿨다운 상태 관리
const cooldowns = {};

function getOrderedImageModels() {
  const now = Date.now();
  const active = [];
  const cooling = [];

  for (const model of IMAGE_MODELS) {
    if (cooldowns[model] && cooldowns[model] > now) {
      cooling.push(model);
    } else {
      active.push(model);
    }
  }
  return [...active, ...cooling];
}

function setCooldown(model) {
  cooldowns[model] = Date.now() + 5 * 60 * 1000; // 5분간 쿨다운
  console.warn(`[Smart Fallback Image] ${model} enters 5-minute cooldown due to API failure.`);
}

function clearCooldown(model) {
  if (cooldowns[model]) {
    delete cooldowns[model];
    console.log(`[Smart Fallback Image] ${model} cooldown cleared.`);
  }
}

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

    const orderedModels = getOrderedImageModels();

    for (const model of orderedModels) {
      try {
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
          
          if (response.status === 429 || response.status >= 500) {
            setCooldown(model);
          }
          console.warn(`[Smart Fallback Image] Model ${model} failed with status ${response.status}:`, lastError);
          
          if (/quota|rate-limit|free_tier|billing/i.test(lastError)) {
            setCooldown(model);
            break;
          }
          continue;
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data);
        if (imagePart) {
          clearCooldown(model); // 성공한 모델 쿨다운 해제
          return res.status(200).json({
            model,
            mimeType: imagePart.inlineData.mimeType || 'image/png',
            imageBase64: imagePart.inlineData.data
          });
        }

        lastError = '이미지 응답을 찾지 못했습니다.';
      } catch (e) {
        lastError = e.message;
        setCooldown(model);
        console.warn(`[Smart Fallback Image] Model ${model} error:`, e);
      }
    }

    return res.status(502).json({ error: lastError || '이미지 생성에 실패했습니다.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
