// ArcSliceSource - 零拷贝音频源
// 
// 从Arc<[i16]>中读取音频样本，避免大量内存复制
// 特别适用于seek操作，可以大幅提升性能

use std::sync::Arc;
use std::time::Duration;
use rodio::Source;

/// 基于Arc切片的零拷贝音频源
pub struct ArcSliceSource {
    /// 音频样本数据（Arc共享，零成本clone）
    samples: Arc<[i16]>,
    
    /// 当前读取位置（样本索引）
    position: usize,
    
    /// 声道数
    channels: u16,
    
    /// 采样率
    sample_rate: u32,
}

impl ArcSliceSource {
    /// 创建新的Arc切片音频源
    /// 
    /// # 参数
    /// - `samples`: Arc共享的音频样本数据
    /// - `channels`: 声道数
    /// - `sample_rate`: 采样率
    /// - `start_offset`: 起始偏移量（样本数）
    pub fn new(
        samples: Arc<[i16]>,
        channels: u16,
        sample_rate: u32,
        start_offset: usize,
    ) -> Self {
        Self {
            samples,
            position: start_offset,
            channels,
            sample_rate,
        }
    }
    
    /// 创建从头开始的音频源
    pub fn from_start(
        samples: Arc<[i16]>,
        channels: u16,
        sample_rate: u32,
    ) -> Self {
        Self::new(samples, channels, sample_rate, 0)
    }
}

impl Iterator for ArcSliceSource {
    type Item = i16;
    
    fn next(&mut self) -> Option<Self::Item> {
        if self.position < self.samples.len() {
            let sample = self.samples[self.position];
            self.position += 1;
            Some(sample)
        } else {
            None
        }
    }
    
    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.samples.len().saturating_sub(self.position);
        (remaining, Some(remaining))
    }
}

impl ExactSizeIterator for ArcSliceSource {
    fn len(&self) -> usize {
        self.samples.len().saturating_sub(self.position)
    }
}

impl Source for ArcSliceSource {
    fn current_frame_len(&self) -> Option<usize> {
        Some(self.samples.len().saturating_sub(self.position))
    }
    
    fn channels(&self) -> u16 {
        self.channels
    }
    
    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    
    fn total_duration(&self) -> Option<Duration> {
        let remaining_samples = self.samples.len().saturating_sub(self.position);
        let frames = remaining_samples / self.channels as usize;
        let duration_secs = frames as f64 / self.sample_rate as f64;
        Some(Duration::from_secs_f64(duration_secs))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_arc_slice_source_basic() {
        let samples: Arc<[i16]> = Arc::new([1, 2, 3, 4, 5, 6, 7, 8]);
        let source = ArcSliceSource::from_start(samples.clone(), 2, 44100);
        
        assert_eq!(source.channels(), 2);
        assert_eq!(source.sample_rate(), 44100);
        assert_eq!(source.len(), 8);
    }
    
    #[test]
    fn test_arc_slice_source_with_offset() {
        let samples: Arc<[i16]> = Arc::new([1, 2, 3, 4, 5, 6, 7, 8]);
        let mut source = ArcSliceSource::new(samples.clone(), 2, 44100, 4);
        
        assert_eq!(source.len(), 4);
        assert_eq!(source.next(), Some(5));
        assert_eq!(source.next(), Some(6));
        assert_eq!(source.len(), 2);
    }
    
    #[test]
    fn test_arc_slice_source_iterator() {
        let samples: Arc<[i16]> = Arc::new([10, 20, 30, 40]);
        let source = ArcSliceSource::from_start(samples.clone(), 1, 44100);
        
        let collected: Vec<i16> = source.collect();
        assert_eq!(collected, vec![10, 20, 30, 40]);
    }
}








