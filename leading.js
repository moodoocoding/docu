const API_KEY = import.meta.env.VITE_LEADING_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
const USE_NETLIFY_FUNCTION = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
const IMAGE_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];

const DEFAULT_PROMPT = `A chest-up portrait of a character based on the uploaded photo. The style must be a Children's 2D cartoon style with a Chibi proportion (3 to 3.5 heads tall). Use Bold, thick black outlines and 2D flat color with simple cell shading. The character should have Simple dot eyes, a Minimalist nose, and a Simple line mouth. Maintain the original hairstyle and clothing features but simplify them. The background must be transparent or solid white. Exclude realism, webtoon, and semi-realism styles. Focus only on the most prominent person in the image`;

const photoInput = document.getElementById('photoInput');
const uploadZone = document.getElementById('uploadZone');
const originalStage = document.getElementById('originalStage');
const resultStage = document.getElementById('resultStage');
const fileName = document.getElementById('fileName');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');

let selectedFile = null;
let selectedDataUrl = '';

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading || !selectedFile;
  generateBtn.classList.toggle('is-loading', isLoading);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  selectedFile = file;
  selectedDataUrl = await readFileAsDataUrl(file);
  fileName.textContent = file.name || '붙여넣은 이미지';
  originalStage.innerHTML = `<img src="${selectedDataUrl}" alt="업로드한 원본 사진">`;
  resultStage.innerHTML = '<p>캐릭터 생성 결과가 여기에 표시됩니다.</p>';
  downloadBtn.href = '#';
  downloadBtn.classList.add('disabled');
  generateBtn.disabled = false;
}

function extractBase64(dataUrl) {
  return dataUrl.split(',')[1];
}

async function requestCharacterImage(model, prompt, file) {
  if (USE_NETLIFY_FUNCTION) {
    const functionBases = location.hostname.includes('vercel.app')
      ? ['/api', '/.netlify/functions']
      : ['/.netlify/functions', '/api'];
    let lastFunctionError = '';

    for (const base of functionBases) {
      const response = await fetch(`${base}/generate-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageBase64: selectedDataUrl,
          mimeType: file.type
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return {
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  mimeType: data.mimeType,
                  data: data.imageBase64
                }
              }]
            }
          }]
        };
      }

      lastFunctionError = data.error || `Function Error ${response.status}`;
      if (response.status === 404) continue;
      throw new Error(lastFunctionError);
    }

    throw new Error(lastFunctionError || 'Function endpoint not found.');
  }

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: file.type,
            data: extractBase64(selectedDataUrl)
          }
        }
      ]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `API Error ${response.status}`);
  }

  return response.json();
}

function findGeneratedImage(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.find(part => part.inlineData?.data);
}

function isQuotaError(error) {
  return /quota|rate-limit|free_tier|billing/i.test(error?.message || '');
}

function getFriendlyImageError(error) {
  if (isQuotaError(error)) {
    return 'Gemini 이미지 생성 할당량을 초과했거나 현재 API 키의 이미지 생성 무료 할당량이 없습니다. Google AI Studio에서 결제/할당량 설정을 확인해주세요.';
  }

  return error?.message || '이미지 생성에 실패했습니다.';
}

async function generateCharacter() {
  if (!USE_NETLIFY_FUNCTION && !API_KEY) {
    showToast('.env의 VITE_GEMINI_API_KEY 값을 확인해주세요.');
    return;
  }
  if (!selectedFile) {
    showToast('먼저 사진을 업로드해주세요.');
    return;
  }

  setLoading(true);
  resultStage.innerHTML = '<p>이미지를 캐릭터로 변환하는 중입니다.</p>';

  let lastError = null;
  try {
    const models = USE_NETLIFY_FUNCTION ? ['netlify-function'] : IMAGE_MODELS;
    for (const model of models) {
      try {
        const data = await requestCharacterImage(model, DEFAULT_PROMPT, selectedFile);
        const imagePart = findGeneratedImage(data);
        if (!imagePart) {
          throw new Error('이미지 응답을 찾지 못했습니다.');
        }

        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
        resultStage.innerHTML = `<img src="${imageUrl}" alt="생성된 2D 캐릭터 이미지">`;
        downloadBtn.href = imageUrl;
        downloadBtn.download = `leading-character-${Date.now()}.${mimeType.includes('jpeg') ? 'jpg' : 'png'}`;
        downloadBtn.classList.remove('disabled');
        showToast('캐릭터 이미지가 생성되었습니다.');
        return;
      } catch (error) {
        lastError = error;
        console.warn(`${model} failed`, error);
        if (isQuotaError(error)) break;
      }
    }

    throw lastError || new Error('이미지 생성에 실패했습니다.');
  } catch (error) {
    console.error(error);
    resultStage.innerHTML = '<p>생성에 실패했습니다. 잠시 후 다시 시도해주세요.</p>';
    showToast(getFriendlyImageError(error));
  } finally {
    setLoading(false);
  }
}

photoInput.addEventListener('change', () => handleFile(photoInput.files[0]));
generateBtn.addEventListener('click', generateCharacter);

['dragenter', 'dragover'].forEach(eventName => {
  uploadZone.addEventListener(eventName, event => {
    event.preventDefault();
    uploadZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  uploadZone.addEventListener(eventName, event => {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
  });
});

uploadZone.addEventListener('drop', event => {
  handleFile(event.dataTransfer.files[0]);
});

document.addEventListener('paste', event => {
  const imageItem = Array.from(event.clipboardData?.items || [])
    .find(item => item.type.startsWith('image/'));

  if (!imageItem) return;

  event.preventDefault();
  const pastedFile = imageItem.getAsFile();
  if (!pastedFile) return;

  const extension = pastedFile.type.split('/')[1] || 'png';
  const file = new File([pastedFile], `pasted-character-source.${extension}`, {
    type: pastedFile.type,
    lastModified: Date.now()
  });

  handleFile(file);
  showToast('붙여넣은 이미지를 불러왔습니다.');
});
