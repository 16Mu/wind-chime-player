/**
 * 🔧 P1修复：颜色提取Worker - 避免阻塞主线程
 * 
 * 将CPU密集型的颜色提取操作移到Web Worker中执行
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorPalette {
  dominant: RGB;
  vibrant: RGB;
  muted: RGB;
  dark: RGB;
  light: RGB;
}

interface ExtractionRequest {
  imageData: ImageData;
  requestId: string;
}

interface ExtractionResponse {
  requestId: string;
  palette: ColorPalette;
  error?: string;
}

/**
 * 将RGB转换为HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [h * 360, s, l];
}

/**
 * 计算颜色的饱和度和亮度权重
 */
function getColorWeight(rgb: RGB): number {
  const [, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return s * (1 - Math.abs(l - 0.5) * 2);
}

/**
 * 从ImageData提取颜色调色板
 */
function extractPaletteFromImageData(imageData: ImageData): ColorPalette {
  const data = imageData.data;
  
  // 颜色统计（使用量化减少计算量）
  const colorMap = new Map<string, { rgb: RGB; count: number; weight: number }>();
  
  // 每隔4个像素采样一次
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // 跳过透明像素和过暗/过亮的像素
    if (a < 128) continue;
    
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 240) continue;
    
    // 量化颜色（减少到32级）
    const qR = Math.floor(r / 8) * 8;
    const qG = Math.floor(g / 8) * 8;
    const qB = Math.floor(b / 8) * 8;
    const key = `${qR},${qG},${qB}`;
    
    const rgb = { r: qR, g: qG, b: qB };
    const weight = getColorWeight(rgb);
    
    if (colorMap.has(key)) {
      const entry = colorMap.get(key)!;
      entry.count++;
      entry.weight += weight;
    } else {
      colorMap.set(key, { rgb, count: 1, weight });
    }
  }

  if (colorMap.size === 0) {
    // 默认深蓝色
    const defaultColor = { r: 30, g: 70, b: 100 };
    return {
      dominant: defaultColor,
      vibrant: { r: 60, g: 120, b: 180 },
      muted: { r: 50, g: 80, b: 110 },
      dark: { r: 20, g: 50, b: 70 },
      light: { r: 80, g: 140, b: 200 }
    };
  }

  // 转换为数组并排序
  const colors = Array.from(colorMap.values());
  
  // 按权重×数量排序，找出主色调
  colors.sort((a, b) => (b.weight * b.count) - (a.weight * a.count));
  const dominant = colors[0].rgb;

  // 按饱和度排序，找出鲜艳色
  colors.sort((a, b) => {
    const [, sA] = rgbToHsl(a.rgb.r, a.rgb.g, a.rgb.b);
    const [, sB] = rgbToHsl(b.rgb.r, b.rgb.g, b.rgb.b);
    return sB - sA;
  });
  const vibrant = colors[0].rgb;

  // 按饱和度反向排序，找出柔和色
  const muted = colors[colors.length - 1].rgb;

  // 按亮度排序，找出深色和浅色
  colors.sort((a, b) => {
    const [, , lA] = rgbToHsl(a.rgb.r, a.rgb.g, a.rgb.b);
    const [, , lB] = rgbToHsl(b.rgb.r, b.rgb.g, b.rgb.b);
    return lA - lB;
  });
  const dark = colors[0].rgb;
  const light = colors[colors.length - 1].rgb;

  return {
    dominant,
    vibrant,
    muted,
    dark,
    light
  };
}

// Worker消息处理
self.onmessage = (e: MessageEvent<ExtractionRequest>) => {
  const { imageData, requestId } = e.data;
  
  try {
    const palette = extractPaletteFromImageData(imageData);
    
    const response: ExtractionResponse = {
      requestId,
      palette
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: ExtractionResponse = {
      requestId,
      palette: {
        dominant: { r: 30, g: 70, b: 100 },
        vibrant: { r: 60, g: 120, b: 180 },
        muted: { r: 50, g: 80, b: 110 },
        dark: { r: 20, g: 50, b: 70 },
        light: { r: 80, g: 140, b: 200 }
      },
      error: error instanceof Error ? error.message : String(error)
    };
    
    self.postMessage(response);
  }
};

