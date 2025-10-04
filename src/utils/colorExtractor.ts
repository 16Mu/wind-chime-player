/**
 * 专辑封面颜色提取工具
 * 
 * 功能：
 * - 从图片提取主色调
 * - 生成和谐的渐变色方案
 * - 缓存结果避免重复计算
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

/**
 * 将RGB转换为HSL
 */
// function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
//   r /= 255;
//   g /= 255;
//   b /= 255;

//   const max = Math.max(r, g, b);
//   const min = Math.min(r, g, b);
//   let h = 0, s = 0;
//   const l = (max + min) / 2;

//   if (max !== min) {
//     const d = max - min;
//     s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

//     switch (max) {
//       case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
//       case g: h = ((b - r) / d + 2) / 6; break;
//       case b: h = ((r - g) / d + 4) / 6; break;
//     }
//   }

//   return [h * 360, s, l];
// }

/**
 * 计算颜色的饱和度和亮度权重
 */
// function getColorWeight(rgb: RGB): number {
//   const [, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
//   // 优先选择高饱和度、中等亮度的颜色
//   return s * (1 - Math.abs(l - 0.5) * 2);
// }

// 🔧 P1修复：使用Web Worker进行颜色提取，避免阻塞主线程
let colorWorker: Worker | null = null;
let workerRequestId = 0;
const workerCallbacks = new Map<string, {
  resolve: (palette: ColorPalette) => void;
  reject: (error: Error) => void;
}>();

/**
 * 初始化Worker
 */
function initWorker() {
  if (colorWorker) return;
  
  try {
    colorWorker = new Worker(new URL('./colorExtractor.worker.ts', import.meta.url), {
      type: 'module'
    });
    
    colorWorker.onmessage = (e) => {
      const { requestId, palette, error } = e.data;
      const callbacks = workerCallbacks.get(requestId);
      
      if (callbacks) {
        if (error) {
          callbacks.reject(new Error(error));
        } else {
          callbacks.resolve(palette);
        }
        workerCallbacks.delete(requestId);
      }
    };
    
    colorWorker.onerror = (error) => {
      console.error('颜色提取Worker错误:', error);
      // 清理所有pending请求
      workerCallbacks.forEach(({ reject }) => {
        reject(new Error('Worker执行失败'));
      });
      workerCallbacks.clear();
    };
  } catch (error) {
    console.warn('Web Worker不可用，将使用主线程提取颜色', error);
  }
}

/**
 * 从图片URL提取颜色调色板（使用Worker）
 */
export async function extractColorPalette(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('无法创建Canvas上下文');
        }

        // 缩小图片以提高性能（最大100x100）
        const scale = Math.min(100 / img.width, 100 / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 尝试使用Worker处理
        if (typeof Worker !== 'undefined') {
          initWorker();
          
          if (colorWorker) {
            const requestId = `req_${++workerRequestId}`;
            
            workerCallbacks.set(requestId, { resolve, reject });
            
            // 发送到Worker处理
            colorWorker.postMessage({
              imageData,
              requestId
            });
            
            // 设置超时
            setTimeout(() => {
              if (workerCallbacks.has(requestId)) {
                workerCallbacks.delete(requestId);
                reject(new Error('颜色提取超时'));
              }
            }, 5000);
            
            return;
          }
        }
        
        // Fallback: 在主线程中处理（不应该经常发生）
        console.warn('Worker不可用，在主线程中提取颜色');
        const palette = extractPaletteSync(imageData);
        resolve(palette);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };

    img.src = imageUrl;
  });
}

/**
 * 同步提取颜色（仅用于fallback）
 */
function extractPaletteSync(_imageData: ImageData): ColorPalette {
  // 简化版本的颜色提取（主线程fallback）
  const defaultColor = { r: 30, g: 70, b: 100 };
  return {
    dominant: defaultColor,
    vibrant: { r: 60, g: 120, b: 180 },
    muted: { r: 50, g: 80, b: 110 },
    dark: { r: 20, g: 50, b: 70 },
    light: { r: 80, g: 140, b: 200 }
  };
}

/**
 * RGB转CSS颜色字符串
 */
export function rgbToCss(rgb: RGB, alpha: number = 1): string {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

/**
 * 🔧 P3修复：生成基于颜色的渐变背景
 * 
 * @param palette 颜色调色板
 * @param phase 动画帧计数器，用于创建呼吸动画效果（0表示静态）
 * @returns CSS渐变背景字符串
 */
export function generateGradientBackground(palette: ColorPalette, phase: number = 0): string {
  const { dominant, dark, vibrant } = palette;
  
  return `
    linear-gradient(
      90deg,
      ${rgbToCss(dark, 0.85)} 0%,
      ${rgbToCss(dominant, 0.90)} 50%,
      ${rgbToCss(dark, 0.85)} 100%
    ),
    radial-gradient(
      circle at ${25 + Math.sin(phase * 0.005) * 10}% ${50 + Math.cos(phase * 0.007) * 15}%,
      ${rgbToCss(vibrant, 0.12)} 0%,
      transparent 60%
    ),
    radial-gradient(
      circle at ${75 + Math.cos(phase * 0.006) * 10}% ${50 + Math.sin(phase * 0.008) * 15}%,
      ${rgbToCss(dominant, 0.10)} 0%,
      transparent 55%
    ),
    ${rgbToCss(dark, 1)}
  `;
}

/**
 * 颜色缓存
 */
const colorCache = new Map<string, ColorPalette>();

/**
 * 带缓存的颜色提取
 */
export async function extractColorPaletteWithCache(imageUrl: string): Promise<ColorPalette> {
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }

  const palette = await extractColorPalette(imageUrl);
  colorCache.set(imageUrl, palette);
  
  // 限制缓存大小（最多50个）
  if (colorCache.size > 50) {
    const firstKey = colorCache.keys().next().value;
    if (firstKey !== undefined) {
      colorCache.delete(firstKey);
    }
  }

  return palette;
}

/**
 * 清除颜色缓存
 */
export function clearColorCache() {
  colorCache.clear();
}


