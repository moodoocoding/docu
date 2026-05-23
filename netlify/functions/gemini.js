const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];

// 서버 인메모리 쿨다운 상태 관리
const cooldowns = {};

function getOrderedModels() {
  const now = Date.now();
  const active = [];
  const cooling = [];

  for (const model of MODELS) {
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
  console.warn(`[Smart Fallback] ${model} enters 5-minute cooldown due to API failure.`);
}

function clearCooldown(model) {
  if (cooldowns[model]) {
    delete cooldowns[model];
    console.log(`[Smart Fallback] ${model} cooldown cleared.`);
  }
}

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
    const orderedModels = getOrderedModels();
    
    for (const model of orderedModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
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
          
          if (response.status === 429 || response.status >= 500) {
            setCooldown(model);
          }
          console.warn(`[Smart Fallback] Model ${model} failed with status ${response.status}:`, lastError);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '';
        if (text) {
          clearCooldown(model);
          return jsonResponse(200, { text, model });
        }
      } catch (e) {
        lastError = e.message;
        setCooldown(model);
        console.warn(`[Smart Fallback] Model ${model} network/unexpected error:`, e);
      }
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
